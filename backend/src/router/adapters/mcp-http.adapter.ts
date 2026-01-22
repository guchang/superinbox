/**
 * MCP HTTP Adapter
 * Distributes items to MCP-compatible services via HTTP
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AdapterType,
  type Item,
  type DistributionResult,
  type MCPAdapterConfig,
  type DistributionConfig
} from '../../types/index.js';
import { BaseAdapter } from '../adapter.interface.js';
import { HttpMcpClient } from '../mcp/http-mcp-client.js';
import { getLLMMappingService } from '../mcp/llm-mapping.service.js';
import { logger } from '../../middleware/logger.js';

/**
 * MCP HTTP Adapter
 *
 * @example
 * // Configuration for Notion MCP Server
 * {
 *   serverUrl: "https://mcp.notion.com/mcp",
 *   authType: "api_key",
 *   apiKey: "ntn_xxx",
 *   serverType: "notion",
 *   defaultToolName: "notion-create-pages"
 * }
 */
export class MCPHttpAdapter extends BaseAdapter {
  readonly type: AdapterType = AdapterType.MCP_HTTP;
  readonly name = 'MCP HTTP Adapter';

  private mcpConfig?: MCPAdapterConfig;
  private mcpClient?: HttpMcpClient;
  private distributionConfig?: DistributionConfig;

  /**
   * Validate MCP configuration
   */
  validate(config: Record<string, unknown>): boolean {
    const mcpConfig = config as Partial<MCPAdapterConfig>;
    return (
      typeof mcpConfig.serverUrl === 'string' &&
      mcpConfig.serverUrl.length > 0 &&
      typeof mcpConfig.serverType === 'string' &&
      mcpConfig.serverType.length > 0 &&
      (mcpConfig.authType === 'api_key' || mcpConfig.authType === 'oauth')
    );
  }

  /**
   * Initialize the adapter
   */
  async initialize(config: Record<string, unknown>): Promise<void> {
    this.mcpConfig = config as MCPAdapterConfig;

    // Initialize HTTP MCP client
    this.mcpClient = new HttpMcpClient({
      serverUrl: this.mcpConfig.serverUrl,
      authToken: this.getAuthToken(),
      timeout: this.mcpConfig.timeout || 30000,
      maxRetries: this.mcpConfig.maxRetries || 3
    });

    // Health check
    const isHealthy = await this.mcpClient.healthCheck();
    if (!isHealthy) {
      throw new Error(`MCP server health check failed for ${this.mcpConfig.serverUrl}`);
    }

    logger.info(`MCP HTTP Adapter initialized for ${this.mcpConfig.name}`);
  }

  /**
   * Set distribution config (for routing context)
   */
  setDistributionConfig(config: DistributionConfig): void {
    this.distributionConfig = config;
  }

  /**
   * Distribute item to MCP server
   */
  async distribute(item: Item): Promise<DistributionResult> {
    this.ensureInitialized();

    const targetId = this.distributionConfig?.id || this.mcpConfig!.id;
    const toolName = this.distributionConfig?.config?.toolName as string
      || this.mcpConfig!.defaultToolName
      || this.inferToolName(this.mcpConfig!.serverType);

    try {
      logger.info(`Distributing item ${item.id} to MCP tool ${toolName}`);

      // Step 1: Get tool schema
      const toolSchema = await this.mcpClient!.getToolSchema(toolName);
      if (!toolSchema) {
        const tools = await this.mcpClient!.listTools(true);
        const availableTools = tools
          .map((tool: { name?: string }) => tool?.name)
          .filter(Boolean)
          .join(', ');
        throw new Error(
          `Tool ${toolName} not found on MCP server` +
            (availableTools ? `. Available tools: ${availableTools}` : '')
        );
      }

      // Step 2: Transform data using LLM if instructions provided
      let transformedData: Record<string, unknown>;

      const processingInstructions = this.distributionConfig?.processingInstructions as string
        || this.getDefaultInstructions(this.mcpConfig!.serverType);

      if (processingInstructions) {
        const llmService = getLLMMappingService();
        transformedData = await llmService.transform(item, {
          instructions: processingInstructions,
          targetSchema: toolSchema.inputSchema as Record<string, unknown>,
          toolName
        });
      } else {
        // Use simple mapping
        transformedData = this.simpleMapping(item, toolName);
      }

      // Step 3: Call MCP tool
      const result = await this.mcpClient!.callTool({
        name: toolName,
        arguments: {
          ...this.distributionConfig?.config?.toolArgs,
          ...transformedData
        }
      });

      if (result?.isError) {
        throw new Error(this.getToolErrorMessage(result));
      }

      // Extract external ID and URL from result
      const externalId = this.extractExternalId(result);
      const externalUrl = this.extractExternalUrl(result);

      logger.info(`Successfully distributed item ${item.id} to ${toolName}`);

      return this.createResult(targetId, 'success', {
        externalId,
        externalUrl
      });
    } catch (error) {
      logger.error(`Failed to distribute item ${item.id} to MCP:`, error);
      return this.createResult(targetId, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    this.ensureInitialized();
    return this.mcpClient!.healthCheck();
  }

  /**
   * Get authentication token from config
   */
  private getAuthToken(): string | undefined {
    if (this.mcpConfig?.authType === 'api_key' && this.mcpConfig.apiKey) {
      return this.mcpConfig.apiKey;
    }

    if (this.mcpConfig?.authType === 'oauth' && this.mcpConfig.oauthAccessToken) {
      return this.mcpConfig.oauthAccessToken;
    }

    return undefined;
  }

  /**
   * Infer tool name from server type
   */
  private inferToolName(serverType: string): string {
    const toolMapping: Record<string, string> = {
      notion: 'API-post-page',
      github: 'github-create-issue',
      obsidian: 'obsidian-create-note'
    };

    return toolMapping[serverType] || 'create-resource';
  }

  /**
   * Get default processing instructions for server type
   */
  private getDefaultInstructions(serverType: string): string {
    const instructions: Record<string, string> = {
      notion: `Convert to Notion page format:
- Use suggestedTitle for the page title (Name property)
- Use originalContent for the page content
- Map category to tags if applicable
- Map dates to Notion date format`,
      github: `Convert to GitHub issue format:
- Use suggestedTitle as issue title
- Use originalContent as issue body
- Include category as labels if applicable`,
      obsidian: `Convert to Obsidian note format:
- Use suggestedTitle as note filename
- Use originalContent as note content
- Add metadata YAML frontmatter`
    };

    return instructions[serverType] || `Convert the item to the target format for ${serverType}`;
  }

  /**
   * Simple field mapping fallback
   */
  private simpleMapping(item: Item, toolName: string): Record<string, unknown> {
    if (toolName === 'API-update-a-block') {
      const targetId = this.distributionConfig?.config?.databaseId as string | undefined;
      return {
        ...(targetId ? { block_id: targetId } : {}),
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: item.originalContent
              }
            }
          ]
        }
      };
    }

    if (toolName === 'API-patch-block-children') {
      const targetId = this.distributionConfig?.config?.databaseId as string | undefined;
      return {
        ...(targetId ? { block_id: targetId } : {}),
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: item.originalContent
                  }
                }
              ]
            }
          }
        ]
      };
    }

    if (toolName.startsWith('notion') || toolName === 'API-post-page') {
      const parentId = this.distributionConfig?.config?.databaseId as string | undefined;
      const parentType = this.distributionConfig?.config?.parentType === 'page_id'
        ? 'page_id'
        : 'database_id';
      const parent = parentId ? { [parentType]: parentId } : undefined;

      return {
        ...(parent ? { parent } : {}),
        properties: {
          Name: {
            title: [{
              text: {
                content: item.suggestedTitle || item.originalContent.substring(0, 50)
              }
            }]
          }
        }
      };
    }

    // Generic mapping
    return {
      title: item.suggestedTitle || item.originalContent.substring(0, 50),
      content: item.originalContent,
      metadata: {
        category: item.category,
        contentType: item.contentType,
        source: item.source
      }
    };
  }

  /**
   * Extract external ID from MCP tool result
   */
  private extractExternalId(result: Record<string, unknown>): string | undefined {
    if (typeof result.id === 'string') {
      return result.id;
    }

    if (result.content && typeof result.content === 'object') {
      const content = result.content as Record<string, unknown>;
      if (typeof content.id === 'string') {
        return content.id;
      }
    }

    return undefined;
  }

  /**
   * Extract external URL from MCP tool result
   */
  private extractExternalUrl(result: Record<string, unknown>): string | undefined {
    if (typeof result.url === 'string') {
      return result.url;
    }

    if (result.content && typeof result.content === 'object') {
      const content = result.content as Record<string, unknown>;
      if (typeof content.url === 'string') {
        return content.url;
      }
    }

    return undefined;
  }

  /**
   * Extract a readable error message from a tool result
   */
  private getToolErrorMessage(result: { content?: unknown }): string {
    const content = result?.content;
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      const textParts = content
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (entry && typeof entry === 'object' && 'text' in entry) {
            const text = (entry as { text?: string }).text;
            return typeof text === 'string' ? text : '';
          }
          return '';
        })
        .filter(Boolean);
      if (textParts.length > 0) {
        return textParts.join(' ');
      }
    }
    if (content && typeof content === 'object') {
      try {
        return JSON.stringify(content);
      } catch {
        return 'Tool call failed';
      }
    }
    return 'Tool call failed';
  }

  /**
   * Create a distribution result
   */
  protected createResult(
    targetId: string,
    status: 'success' | 'failed',
    extras?: { externalId?: string; externalUrl?: string; error?: string }
  ): DistributionResult {
    return {
      id: uuidv4(),
      targetId,
      adapterType: this.type,
      status,
      ...extras,
      timestamp: new Date()
    };
  }

  /**
   * Ensure adapter is initialized
   */
  protected ensureInitialized(): void {
    if (!this.mcpConfig || !this.mcpClient) {
      throw new Error('MCP HTTP Adapter not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
export const mcpHttpAdapter = new MCPHttpAdapter();
