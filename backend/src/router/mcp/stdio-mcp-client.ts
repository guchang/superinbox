/**
 * Stdio MCP Client
 * Handles communication with stdio-based MCP servers using child_process
 *
 * This client connects to MCP servers that communicate over stdin/stdout
 * using the JSON-RPC 2.0 protocol.
 *
 * @example
 * // Connect to Notion MCP Server
 * const client = new StdioMcpClient({
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-notion'],
 *   env: { NOTION_TOKEN: 'ntn_xxx' }
 * });
 */

import { spawn } from 'child_process';
import type { StdioMcpClientConfig, MCPTool, MCPToolCallRequest, MCPToolCallResponse } from '../../types/index.js';
import { logger } from '../../middleware/logger.js';

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface PendingRequest {
  resolve: (value: JSONRPCResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class StdioMcpClient {
  private config: StdioMcpClientConfig;
  private process?: import('child_process').ChildProcess;
  private requestId = 0;
  private pendingRequests = new Map<number | string, PendingRequest>();
  private toolsCache: MCPTool[] | null = null;
  private isInitialized = false;
  private initializePromise?: Promise<void>;

  constructor(config: StdioMcpClientConfig) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  /**
   * Initialize the stdio connection
   * Sends the initialize request to the MCP server
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this._initialize();
    await this.initializePromise;
  }

  private async _initialize(): Promise<void> {
    try {
      // Parse command and args
      const parts = this.config.command.split(' ');
      const cmd = parts[0];
      const args = [...(parts.slice(1) || []), ...(this.config.args || [])];

      logger.info(`Starting MCP server: ${cmd} ${args.join(' ')}`);

      // Spawn the MCP server process
      this.process = spawn(cmd, args, {
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Set up error handling
      this.process.on('error', (error) => {
        logger.error('MCP server process error:', error);
        this.rejectAllPending(error);
      });

      this.process.on('exit', (code, signal) => {
        logger.info(`MCP server process exited: code=${code}, signal=${signal}`);
        this.rejectAllPending(new Error(`MCP server process exited: ${signal || code}`));
      });

      // Handle stderr output
      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            logger.debug(`MCP server stderr: ${output}`);
          }
        });
      }

      // Handle stdout (JSON-RPC responses)
      if (this.process.stdout) {
        let buffer = '';

        this.process.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line) as JSONRPCResponse;
                this.handleResponse(response);
              } catch (error) {
                logger.error('Failed to parse MCP server response:', error, line);
              }
            }
          }
        });
      }

      // Send initialize request
      const initResponse = await this.sendRequest({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'superinbox',
            version: '1.0.0'
          }
        }
      });

      if (initResponse.error) {
        throw new Error(`MCP initialize failed: ${initResponse.error.message}`);
      }

      // Send initialized notification
      this.sendNotification({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });

      this.isInitialized = true;
      logger.info('MCP server initialized successfully');
    } catch (error) {
      this.kill();
      throw error;
    }
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(forceRefresh = false): Promise<MCPTool[]> {
    await this.initialize();

    if (!forceRefresh && this.toolsCache) {
      return this.toolsCache;
    }

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'tools/list'
    });

    if (response.error) {
      throw new Error(`Failed to list tools: ${response.error.message}`);
    }

    const result = response.result as { tools?: MCPTool[] };
    this.toolsCache = result.tools || [];
    return this.toolsCache;
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    await this.initialize();

    logger.info(`[StdioMcpClient] Calling tool: ${request.name}`, {
      args: request.arguments
    });

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: request.name,
        arguments: request.arguments
      }
    });

    logger.info(`[StdioMcpClient] Tool response:`, JSON.stringify({
      hasError: !!response.error,
      errorMessage: response.error?.message,
      hasResult: !!response.result,
      resultKeys: response.result ? Object.keys(response.result) : [],
      fullResponse: response
    }, null, 2));

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result as MCPToolCallResponse;
  }

  /**
   * Health check for the MCP server
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      await this.listTools();
      return true;
    } catch (error) {
      logger.error('MCP server health check failed:', error);
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
    this.toolsCache = null;
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private sendRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const timeout = this.config.timeout || 30000;

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutHandle });

      this.send({ ...request, id });
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private sendNotification(notification: JSONRPCRequest): void {
    this.send(notification);
  }

  /**
   * Send data to the MCP server
   */
  private send(data: JSONRPCRequest): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('MCP server process not available');
    }

    const message = JSON.stringify(data) + '\n';
    this.process.stdin.write(message);
  }

  /**
   * Handle a response from the MCP server
   */
  private handleResponse(response: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(response.id);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);

      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response);
      }
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Kill the MCP server process
   */
  kill(): void {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    this.isInitialized = false;
    this.toolsCache = null;
    this.initializePromise = undefined;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.kill();
  }
}
