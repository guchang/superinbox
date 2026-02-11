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
  timeout: 30000,
  proxy: false
});

const toolError = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true
});

const toolOk = (payload: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }]
});

const applyLocalTimestamps = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => applyLocalTimestamps(item));
  }

  const data = payload as Record<string, unknown>;
  const next: Record<string, unknown> = { ...data };

  if (Array.isArray(next.entries)) {
    next.entries = (next.entries as unknown[]).map(entry => applyLocalTimestamps(entry));
  }

  if (typeof next.createdAtLocal === 'string') {
    next.createdAt = next.createdAtLocal;
  }

  if (typeof next.updatedAtLocal === 'string') {
    next.updatedAt = next.updatedAtLocal;
  }

  delete next.createdAtLocal;
  delete next.updatedAtLocal;

  return next;
};

const request = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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
  hastype: z.enum(['image', 'audio', 'file', 'text', 'url']).optional(),
  since: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
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
const updateItemSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).optional(),
  category: z.string().min(1).optional()
}).refine(
  (data) => data.content !== undefined || data.category !== undefined,
  { message: 'At least one of content or category is required' }
);
const deleteItemSchema = z.object({
  id: z.string().min(1)
});
const categoryListSchema = z.object({});
const createCategorySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1)
});
const updateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1)
});
const deleteCategorySchema = z.object({
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
    return toolOk(applyLocalTimestamps(result.data));
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
    return toolOk(applyLocalTimestamps(result.data));
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
    return toolOk(applyLocalTimestamps(result.data));
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
    return toolOk(applyLocalTimestamps(result.data));
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
    return toolOk(applyLocalTimestamps(result.data));
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
    return toolOk(applyLocalTimestamps(result.data));
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
    return toolOk(applyLocalTimestamps(result.data));
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
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'inbox.update',
  {
    description: 'Update inbox item content or category by id.',
    inputSchema: updateItemSchema
  },
  async ({ id, ...updates }) => {
    const result = await request('PUT', `/v1/inbox/${id}`, { data: updates });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'inbox_update',
  {
    description: 'Update inbox item content or category by id.',
    inputSchema: updateItemSchema
  },
  async ({ id, ...updates }) => {
    const result = await request('PUT', `/v1/inbox/${id}`, { data: updates });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'inbox.delete',
  {
    description: 'Delete an inbox item by id.',
    inputSchema: deleteItemSchema
  },
  async ({ id }) => {
    const result = await request('DELETE', `/v1/inbox/${id}`);
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'inbox_delete',
  {
    description: 'Delete an inbox item by id.',
    inputSchema: deleteItemSchema
  },
  async ({ id }) => {
    const result = await request('DELETE', `/v1/inbox/${id}`);
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'category.list',
  {
    description: 'List categories.',
    inputSchema: categoryListSchema
  },
  async () => {
    const result = await request('GET', '/v1/categories');
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'category_list',
  {
    description: 'List categories.',
    inputSchema: categoryListSchema
  },
  async () => {
    const result = await request('GET', '/v1/categories');
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'category.create',
  {
    description: 'Create a category with key and name.',
    inputSchema: createCategorySchema
  },
  async (args) => {
    const result = await request('POST', '/v1/categories', { data: args });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'category_create',
  {
    description: 'Create a category with key and name.',
    inputSchema: createCategorySchema
  },
  async (args) => {
    const result = await request('POST', '/v1/categories', { data: args });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'category.update',
  {
    description: 'Rename category by id.',
    inputSchema: updateCategorySchema
  },
  async ({ id, name }) => {
    const result = await request('PUT', `/v1/categories/${id}`, { data: { name } });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'category_update',
  {
    description: 'Rename category by id.',
    inputSchema: updateCategorySchema
  },
  async ({ id, name }) => {
    const result = await request('PUT', `/v1/categories/${id}`, { data: { name } });
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'category.delete',
  {
    description: 'Delete category by id.',
    inputSchema: deleteCategorySchema
  },
  async ({ id }) => {
    const result = await request('DELETE', `/v1/categories/${id}`);
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }
);

mcpServer.registerTool(
  'category_delete',
  {
    description: 'Delete category by id.',
    inputSchema: deleteCategorySchema
  },
  async ({ id }) => {
    const result = await request('DELETE', `/v1/categories/${id}`);
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
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
