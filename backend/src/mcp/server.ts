/**
 * SuperInbox MCP Server (stdio)
 */

import axios from 'axios';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

const getApiKey = (): string | undefined => process.env.SUPERINBOX_API_KEY;
const getBaseUrl = (): string => process.env.SUPERINBOX_BASE_URL || DEFAULT_BASE_URL;

const http = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000
});

const toolError = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true
});

const toolOk = (payload: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }]
});

const request = async <T>(
  method: 'GET' | 'POST',
  url: string,
  options?: { params?: Record<string, unknown>; data?: Record<string, unknown> }
): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, message: 'SUPERINBOX_API_KEY is not set' };
  }

  try {
    const response = await http.request<T>({
      method,
      url,
      params: options?.params,
      data: options?.data,
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    return { ok: true, data: response.data };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const details = typeof data === 'string' ? data : JSON.stringify(data ?? {});
      const statusText = status ? ` (HTTP ${status})` : '';
      return { ok: false, message: `SuperInbox request failed${statusText}: ${details}` };
    }

    return { ok: false, message: `SuperInbox request failed: ${String(error)}` };
  }
};

const mcpServer = new McpServer({
  name: 'superinbox-mcp',
  version: '0.1.0'
});

const itemTypeSchema = z.enum(['text', 'image', 'url', 'audio', 'file', 'mixed']);
const createItemSchema = z.object({
  content: z.string().min(1),
  type: itemTypeSchema.optional(),
  source: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional()
});
const listItemsSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  source: z.string().optional(),
  query: z.string().optional(),
  since: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.string().optional()
});
const searchItemsSchema = z.object({
  q: z.string().min(1),
  category: z.string().optional(),
  limit: z.number().int().positive().max(100).optional()
});
const getItemSchema = z.object({
  id: z.string().min(1)
});

mcpServer.registerTool(
  'inbox.create',
  {
    description: 'Create a new inbox item (text/url content only).',
    inputSchema: createItemSchema
  },
  async (args) => {
    const result = await request('POST', '/v1/inbox', { data: args });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(result.data);
  }
);

mcpServer.registerTool(
  'inbox_create',
  {
    description: 'Create a new inbox item (text/url content only).',
    inputSchema: createItemSchema
  },
  async (args) => {
    const result = await request('POST', '/v1/inbox', { data: args });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(result.data);
  }
);

mcpServer.registerTool(
  'inbox.list',
  {
    description: 'List inbox items with optional filtering and pagination.',
    inputSchema: listItemsSchema
  },
  async (args) => {
    const result = await request('GET', '/v1/inbox', { params: args });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(result.data);
  }
);

mcpServer.registerTool(
  'inbox_list',
  {
    description: 'List inbox items with optional filtering and pagination.',
    inputSchema: listItemsSchema
  },
  async (args) => {
    const result = await request('GET', '/v1/inbox', { params: args });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(result.data);
  }
);

mcpServer.registerTool(
  'inbox.search',
  {
    description: 'Search inbox items by keyword.',
    inputSchema: searchItemsSchema
  },
  async (args) => {
    const result = await request('GET', '/v1/inbox/search', { params: args });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(result.data);
  }
);

mcpServer.registerTool(
  'inbox_search',
  {
    description: 'Search inbox items by keyword.',
    inputSchema: searchItemsSchema
  },
  async (args) => {
    const result = await request('GET', '/v1/inbox/search', { params: args });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(result.data);
  }
);

mcpServer.registerTool(
  'inbox.get',
  {
    description: 'Get an inbox item by id.',
    inputSchema: getItemSchema
  },
  async ({ id }) => {
    const result = await request('GET', `/v1/inbox/${id}`);
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(result.data);
  }
);

mcpServer.registerTool(
  'inbox_get',
  {
    description: 'Get an inbox item by id.',
    inputSchema: getItemSchema
  },
  async ({ id }) => {
    const result = await request('GET', `/v1/inbox/${id}`);
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(result.data);
  }
);

const start = async () => {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('SuperInbox MCP server running on stdio');
};

start().catch((error) => {
  console.error('SuperInbox MCP server failed to start:', error);
  process.exit(1);
});
