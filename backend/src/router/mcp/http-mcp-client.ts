/**
 * HTTP MCP Client
 * Handles communication with HTTP-based MCP servers using fetch
 */

import type { HttpMcpClientConfig, MCPTool, MCPToolCallRequest, MCPToolCallResponse } from '../../types/index.js';
import { logger } from '../../middleware/logger.js';

export class HttpMcpClient {
  private config: HttpMcpClientConfig;
  private toolsCache: Map<string, MCPTool[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  constructor(config: HttpMcpClientConfig) {
    this.config = config;
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(forceRefresh = false): Promise<MCPTool[]> {
    const cacheKey = this.config.serverUrl;
    const now = Date.now();
    const ttl = this.config.maxRetries ? this.config.maxRetries * 1000 : 300000; // Default 5 min

    // Return cached tools if available and not expired
    if (!forceRefresh && this.toolsCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && now < expiry) {
        return this.toolsCache.get(cacheKey)!;
      }
    }

    try {
      const response = await this.fetch('/tools', {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to list tools: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const tools: MCPTool[] = data.tools || [];

      // Cache the results
      this.toolsCache.set(cacheKey, tools);
      this.cacheExpiry.set(cacheKey, now + ttl);

      return tools;
    } catch (error) {
      logger.error('Failed to list tools from MCP server:', error);
      throw error;
    }
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    try {
      const response = await this.fetch('/tools/call', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: request.name,
          arguments: request.arguments
        })
      });

      if (!response.ok) {
        throw new Error(`Tool call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result as MCPToolCallResponse;
    } catch (error) {
      logger.error(`Failed to call tool ${request.name}:`, error);
      throw error;
    }
  }

  /**
   * Health check for the MCP server
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch('/health', {
        method: 'GET',
        headers: this.getHeaders()
      });

      // If health endpoint doesn't exist, try listing tools instead
      if (response.status === 404) {
        await this.listTools();
        return true;
      }

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get tool schema by name
   */
  async getToolSchema(toolName: string): Promise<MCPTool | undefined> {
    const tools = await this.listTools();
    return tools.find(t => t.name === toolName);
  }

  /**
   * Clear the tools cache
   */
  clearCache(): void {
    this.toolsCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Internal fetch with retry logic
   */
  private async fetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = new URL(path, this.config.serverUrl).toString();
    const maxRetries = this.config.maxRetries ?? 3;
    const timeout = this.config.timeout ?? 30000;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // If successful, return the response
        return response;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }

        // Wait before retry with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        logger.debug(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Get headers for HTTP requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    return headers;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const retryablePatterns = [
        /ECONNRESET/,
        /ETIMEDOUT/,
        /socket hang up/,
        /Broken pipe/,
        /fetch failed/,
        /network error/i
      ];
      return retryablePatterns.some(pattern => pattern.test(error.message));
    }
    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
