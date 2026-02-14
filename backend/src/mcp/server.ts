/**
 * SuperInbox MCP Server (stdio)
 */

import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import FormData from 'form-data';

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
  version: '0.1.4'
});

const itemTypeSchema = z.enum(['text', 'image', 'url', 'audio', 'file', 'mixed']);
const createItemSchema = z.object({
  content: z.string().optional(),
  type: itemTypeSchema.optional(),
  source: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
  filePath: z.string().min(1).optional(),
  filePaths: z.array(z.string().min(1)).min(1).optional(),
  fileBase64: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional()
}).refine(
  (data) => {
    const hasFileInput = Boolean(data.filePath || data.filePaths?.length || data.fileBase64);
    const hasTextContent = typeof data.content === 'string' && data.content.trim().length > 0;
    return hasFileInput || hasTextContent;
  },
  { message: 'Either content (non-empty) or one of filePath/filePaths/fileBase64 is required' }
);
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

type CreateItemArgs = z.infer<typeof createItemSchema>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const isExistingFile = (candidate: string): boolean => {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
};

const parseBase64Payload = (
  content: string,
  metadata?: Record<string, unknown>
): { base64: string; mimeType?: string; fileName?: string } | null => {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const dataUriMatch = /^data:([^;]+);base64,(.+)$/s.exec(trimmed);
  if (dataUriMatch) {
    return {
      base64: dataUriMatch[2],
      mimeType: dataUriMatch[1]
    };
  }

  if (trimmed.startsWith('base64:')) {
    return {
      base64: trimmed.slice('base64:'.length),
      mimeType: getString(metadata?.mimeType),
      fileName: getString(metadata?.fileName)
    };
  }

  if (metadata && metadata.encoding === 'base64') {
    return {
      base64: trimmed,
      mimeType: getString(metadata.mimeType),
      fileName: getString(metadata.fileName)
    };
  }

  return null;
};

const requestMultipart = async <T>(
  url: string,
  form: FormData
): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, message: 'SUPERINBOX_API_KEY is not set' };
  }

  try {
    const response = await http.request<T>({
      method: 'POST',
      url,
      data: form,
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
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

const createInboxItem = async (args: CreateItemArgs) => {
  const fileishTypes = new Set<CreateItemArgs['type']>(['file', 'image', 'audio']);
  const metadata = args.metadata && isRecord(args.metadata) ? args.metadata : undefined;

  const explicitMulti = args.filePaths?.length ? args.filePaths : undefined;
  const explicitSingle = args.filePath;
  const explicitBase64 = args.fileBase64;

  const legacyContent = typeof args.content === 'string' ? args.content.trim() : '';
  const legacyFilePath =
    !explicitMulti &&
    !explicitSingle &&
    !explicitBase64 &&
    args.type &&
    fileishTypes.has(args.type) &&
    legacyContent &&
    isExistingFile(legacyContent)
      ? legacyContent
      : undefined;

  const legacyBase64 =
    !explicitMulti &&
    !explicitSingle &&
    !explicitBase64 &&
    args.type &&
    fileishTypes.has(args.type) &&
    legacyContent
      ? parseBase64Payload(legacyContent, metadata)
      : null;

  if (explicitMulti) {
    const form = new FormData();
    for (const entry of explicitMulti) {
      if (!isExistingFile(entry)) {
        return toolError(`File not found: ${entry}`);
      }
      form.append('files', fs.createReadStream(entry), { filename: path.basename(entry) });
    }

    const note = typeof args.content === 'string' ? args.content.trim() : '';
    if (note) {
      form.append('content', note);
    }
    if (args.source) {
      form.append('source', args.source);
    }

    const result = await requestMultipart('/v1/inbox/files', form);
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }

  const resolvedSinglePath = explicitSingle || legacyFilePath;
  if (resolvedSinglePath) {
    if (!isExistingFile(resolvedSinglePath)) {
      return toolError(`File not found: ${resolvedSinglePath}`);
    }

    const form = new FormData();
    const filename = args.fileName?.trim() || path.basename(resolvedSinglePath);
    form.append('file', fs.createReadStream(resolvedSinglePath), { filename });

    const noteFromArgs = typeof args.content === 'string' ? args.content.trim() : '';
    const note = legacyFilePath ? path.basename(resolvedSinglePath) : noteFromArgs;
    if (note) {
      form.append('content', note);
    }
    if (args.source) {
      form.append('source', args.source);
    }

    const result = await requestMultipart('/v1/inbox/file', form);
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }

  if (explicitBase64 || legacyBase64) {
    const payload = legacyBase64 ?? {
      base64: explicitBase64!,
      mimeType: args.mimeType,
      fileName: args.fileName
    };

    let buffer: Buffer;
    try {
      buffer = Buffer.from(payload.base64, 'base64');
    } catch {
      return toolError('Invalid base64 payload');
    }

    if (!buffer.length) {
      return toolError('Invalid base64 payload (empty)');
    }

    const form = new FormData();
    const filename = (payload.fileName || args.fileName || 'upload.bin').trim();
    const mimeType = (payload.mimeType || args.mimeType || 'application/octet-stream').trim();

    form.append('file', buffer, { filename, contentType: mimeType });

    const note = typeof args.content === 'string' ? args.content.trim() : '';
    if (note && !legacyBase64) {
      form.append('content', note);
    }
    if (args.source) {
      form.append('source', args.source);
    }

    const result = await requestMultipart('/v1/inbox/file', form);
    if (!result.ok) {
      return toolError(result.message);
    }
    return toolOk(applyLocalTimestamps(result.data));
  }

  const {
    filePath: _filePath,
    filePaths: _filePaths,
    fileBase64: _fileBase64,
    fileName: _fileName,
    mimeType: _mimeType,
    ...payload
  } = args;

  const result = await request('POST', '/v1/inbox', {
    data: {
      ...payload,
      content: payload.content ?? ''
    }
  });

  if (!result.ok) {
    return toolError(result.message);
  }
  return toolOk(applyLocalTimestamps(result.data));
};

mcpServer.registerTool(
  'inbox.create',
  {
    description: 'Create a new inbox item. Supports text/url, or file upload via filePath/filePaths/fileBase64.',
    inputSchema: createItemSchema
  },
  async (args) => createInboxItem(args)
);

mcpServer.registerTool(
  'inbox_create',
  {
    description: 'Create a new inbox item. Supports text/url, or file upload via filePath/filePaths/fileBase64.',
    inputSchema: createItemSchema
  },
  async (args) => createInboxItem(args)
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
