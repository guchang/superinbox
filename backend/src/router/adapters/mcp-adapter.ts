/**
 * Unified MCP Adapter
 * Distributes items to MCP-compatible services via HTTP or stdio
 *
 * This adapter automatically detects the transport type and creates
 * the appropriate client (HttpMcpClient or StdioMcpClient).
 *
 * @example
 * // Configuration for Notion MCP Server (stdio)
 * {
 *   serverUrl: "notion",
 *   serverType: "notion",
 *   transportType: "stdio",
 *   command: "npx @modelcontextprotocol/server-notion",
 *   env: { NOTION_TOKEN: "ntn_xxx" }
 * }
 *
 * @example
 * // Configuration for GitHub MCP Server (HTTP)
 * {
 *   serverUrl: "https://api.github.com/mcp",
 *   serverType: "github",
 *   transportType: "http",
 *   authType: "api_key",
 *   apiKey: "ghp_xxx"
 * }
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AdapterType,
  type Item,
  type DistributionResult,
  type MCPAdapterConfig,
  type DistributionConfig,
  type MCPToolCallResponse
} from '../../types/index.js';
import { BaseAdapter } from '../adapter.interface.js';
import { HttpMcpClient } from '../mcp/http-mcp-client.js';
import { StdioMcpClient } from '../mcp/stdio-mcp-client.js';
import { getLLMMappingService } from '../mcp/llm-mapping.service.js';
import { logger } from '../../middleware/logger.js';

/**
 * Unified interface for MCP clients
 */
interface MCPClient {
  listTools(forceRefresh?: boolean): Promise<any[]>;
  getToolSchema(toolName: string): Promise<any | undefined>;
  callTool(request: { name: string; arguments: Record<string, unknown> }): Promise<MCPToolCallResponse>;
  healthCheck(): Promise<boolean>;
  clearCache?(): void;
}

export class MCPAdapter extends BaseAdapter {
  readonly type: AdapterType = AdapterType.MCP_HTTP;
  readonly name = 'MCP Adapter';

  private mcpConfig?: MCPAdapterConfig;
  private mcpClient?: MCPClient;
  private distributionConfig?: DistributionConfig;
  private transportType: 'http' | 'stdio' = 'http';

  /**
   * Validate MCP configuration
   */
  validate(config: Record<string, unknown>): boolean {
    const mcpConfig = config as Partial<MCPAdapterConfig>;
    const transportType = (mcpConfig.transportType || 'http') as 'http' | 'stdio';

    if (transportType === 'stdio') {
      // Validate stdio configuration
      return (
        typeof mcpConfig.serverType === 'string' &&
        mcpConfig.serverType.length > 0 &&
        typeof mcpConfig.command === 'string' &&
        mcpConfig.command.length > 0
      );
    }

    // Validate HTTP configuration
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
    this.transportType = (this.mcpConfig.transportType || 'http') as 'http' | 'stdio';

    if (this.transportType === 'stdio') {
      await this.initializeStdioClient();
    } else {
      await this.initializeHttpClient();
    }

    logger.info(`MCP Adapter initialized for ${this.mcpConfig.name} (${this.transportType})`);
  }

  /**
   * Initialize HTTP MCP client
   */
  private async initializeHttpClient(): Promise<void> {
    this.mcpClient = new HttpMcpClient({
      serverUrl: this.mcpConfig!.serverUrl,
      authToken: this.getAuthToken(),
      timeout: this.mcpConfig!.timeout || 30000,
      maxRetries: this.mcpConfig!.maxRetries || 3
    });

    const isHealthy = await this.mcpClient.healthCheck();
    if (!isHealthy) {
      throw new Error(`MCP server health check failed for ${this.mcpConfig!.serverUrl}`);
    }
  }

  /**
   * Initialize stdio MCP client
   */
  private async initializeStdioClient(): Promise<void> {
    const env = {
      ...(this.mcpConfig!.env || {})
    };

    if (this.mcpConfig!.serverType === 'notion') {
      delete (env as Record<string, string>).NOTION_API_KEY;
      delete (env as Record<string, string>).NOTION_AUTH_TOKEN;
      if (this.mcpConfig!.apiKey) {
        env.NOTION_TOKEN = this.mcpConfig!.apiKey;
      }
    }

    let command = this.mcpConfig!.command || this.getDefaultCommand(this.mcpConfig!.serverType);
    let args: string[] = [];

    if (this.mcpConfig!.serverType === 'todoist') {
      let token = this.mcpConfig!.oauthAccessToken;

      // Debug: Log OAuth token status
      logger.info(`[Todoist MCP] oauthAccessToken exists: ${!!token}, length: ${token?.length || 0}`);

      // Fallback to API Key if no OAuth token
      if (!token && this.mcpConfig!.apiKey) {
        token = this.mcpConfig!.apiKey;
        logger.info(`[Todoist MCP] Using API key as fallback, length: ${token.length}`);
      }

      // Fallback to env variable if present
      if (!token) {
         const key = Object.keys(env as Record<string, string>).find(k =>
           k.toUpperCase().includes('TODOIST') &&
           (k.toUpperCase().includes('TOKEN') || k.toUpperCase().includes('KEY'))
         );
         if (key) {
           token = (env as Record<string, string>)[key];
           logger.info(`[Todoist MCP] Using env var ${key}, length: ${token.length}`);
         }
      }

      if (token) {
        // Set TODOIST_API_KEY environment variable (for local MCP servers)
        (env as Record<string, string>).TODOIST_API_KEY = token;
        logger.info(`[Todoist MCP] Set env.TODOIST_API_KEY, length: ${token.length}, prefix: ${token.substring(0, 10)}...`);

        // Parse command into executable and args
        // Default command: "npx -y mcp-remote https://ai.todoist.net/mcp"
        const parts = command.trim().split(/\s+/);
        const cmd = parts[0]; // "npx"
        args = parts.slice(1); // ["-y", "mcp-remote", "https://ai.todoist.net/mcp"]

        // Add --header as a separate argument (no quotes needed in args array)
        args.push('--header', `Authorization: Bearer ${token}`);
        logger.info(`[Todoist MCP] Added --header argument via args array, token prefix: ${token.substring(0, 10)}...`);

        // Override command with just the executable
        command = cmd;
      } else {
        logger.error(`[Todoist MCP] No token found! OAuth: ${!!this.mcpConfig!.oauthAccessToken}, API Key: ${!!this.mcpConfig!.apiKey}`);
      }
    }

    this.mcpClient = new StdioMcpClient({
      command,
      args,
      env,
      timeout: this.mcpConfig!.timeout || 30000
    });

    const isHealthy = await this.mcpClient.healthCheck();
    if (!isHealthy) {
      throw new Error(`MCP server health check failed for ${this.mcpConfig!.name}`);
    }
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
      logger.info(`Distributing item ${item.id} to MCP tool ${toolName} via ${this.transportType}`);

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
        transformedData = this.simpleMapping(item, toolName);
      }

      // Step 3: Call MCP tool
      const logTag = `[${this.mcpConfig!.serverType} MCP]`;
      logger.info(`${logTag} Calling tool: ${toolName} with args:`, {
        ...this.distributionConfig?.config?.toolArgs,
        ...transformedData
      });

      const result = await this.mcpClient!.callTool({
        name: toolName,
        arguments: {
          ...this.distributionConfig?.config?.toolArgs,
          ...transformedData
        }
      });

      logger.info(`${logTag} Tool result:`, {
        isError: result?.isError,
        hasContent: !!result?.content,
        contentPreview: result?.content ? JSON.stringify(result.content).substring(0, 200) : 'no content'
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
   * Fetch tool schema from MCP server
   */
  async getToolSchema(toolName: string): Promise<Record<string, unknown> | undefined> {
    this.ensureInitialized();
    return this.mcpClient!.getToolSchema(toolName);
  }

  /**
   * List available tools from MCP server
   */
  async listTools(forceRefresh = false): Promise<any[]> {
    this.ensureInitialized();
    return this.mcpClient!.listTools(forceRefresh);
  }

  /**
   * Call a tool directly on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResponse> {
    this.ensureInitialized();

    const logTag = `[${this.mcpConfig!.serverType} MCP]`;
    logger.info(`${logTag} Direct callTool: ${name}`, {
      argsKeys: Object.keys(args),
      args: args
    });

    const result = await this.mcpClient!.callTool({
      name,
      arguments: args
    });

    logger.info(`${logTag} Direct callTool result for ${name}:`, {
      isError: result?.isError,
      hasContent: !!result?.content,
      contentPreview: result?.content ? JSON.stringify(result.content).substring(0, 500) : 'no content'
    });

    if (result?.isError) {
      throw new Error(this.getToolErrorMessage(result));
    }

    return result;
  }

  /**
   * Get authentication token from config (for HTTP clients)
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
   * Get default command for server type
   */
  private getDefaultCommand(serverType: string): string {
    const commandMapping: Record<string, string> = {
      notion: 'npx -y @notionhq/notion-mcp-server',
      github: 'npx -y @modelcontextprotocol/server-github',
      obsidian: 'npx -y @modelcontextprotocol/server-obsidian',
      todoist: 'npx -y mcp-remote https://ai.todoist.net/mcp'
    };

    return commandMapping[serverType] || `npx @modelcontextprotocol/server-${serverType}`;
  }

  /**
   * Infer tool name from server type
   */
  private inferToolName(serverType: string): string {
    const toolMapping: Record<string, string> = {
      notion: 'API-post-page',
      github: 'github-create-issue',
      obsidian: 'obsidian-create-note',
      todoist: 'addTasks'
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
- Add metadata YAML frontmatter`,
      todoist: `Convert to Todoist task format:
- Use suggestedTitle (or first 50 chars of originalContent) as task content
- Use originalContent as task description if it's longer
- Map dueDate to Todoist due string (e.g., "tomorrow at 10:00")
- Map priority: LOW->1, MEDIUM->2, HIGH->3, URGENT->4
- Map tags/labels from entities.tags
- Map project ID from config.projectId if provided`
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

    // Todoist addTasks tool mapping
    if (toolName === 'addTasks' || toolName.startsWith('todoist')) {
      // Map priority to Todoist format (1=low, 2=medium, 3=high, 4=urgent)
      const priorityMap: Record<string, number> = {
        low: 1,
        medium: 2,
        high: 3,
        urgent: 4
      };

      // Build task object
      const task: Record<string, unknown> = {
        content: item.suggestedTitle || item.originalContent.substring(0, 50)
      };

      // Add description if content is longer than title
      if (item.originalContent.length > 50) {
        task.description = item.originalContent;
      }

      // Add priority
      if (item.priority) {
        task.priority = priorityMap[item.priority] || 2;
      }

      // Add due date if available
      if (item.entities.dueDate) {
        task.dueString = item.entities.dueDate.toISOString().split('T')[0];
      }

      // Add tags/labels
      if (item.entities.tags && item.entities.tags.length > 0) {
        task.labels = item.entities.tags;
      }

      // Add project ID from config
      const projectId = this.distributionConfig?.config?.projectId as string | undefined;
      if (projectId) {
        task.projectId = projectId;
      }

      return {
        tasks: [task]
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
      throw new Error('MCP Adapter not initialized. Call initialize() first.');
    }
  }

  /**
   * Cleanup resources (especially for stdio clients)
   */
  cleanup(): void {
    if (this.mcpClient && 'cleanup' in this.mcpClient) {
      (this.mcpClient as StdioMcpClient).cleanup();
    }
    this.mcpClient = undefined;
    this.mcpConfig = undefined;
  }
}

// Export singleton instance
export const mcpAdapter = new MCPAdapter();
