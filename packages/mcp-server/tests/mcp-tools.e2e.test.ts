import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

type CapturedRequest = {
  method: string;
  path: string;
  auth?: string;
  body?: Record<string, unknown>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_DIR = path.resolve(__dirname, '..');
const MCP_ENTRY = path.resolve(PACKAGE_DIR, 'dist/index.js');
const TEST_API_KEY = 'test-api-key';

const json = (res: ServerResponse, payload: unknown, statusCode = 200): void => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) as Record<string, unknown> : {};
};

const extractToolPayload = (result: unknown): any => {
  const response = result as { content?: Array<{ type?: string; text?: string }> };
  const text = response.content?.find((entry) => entry.type === 'text')?.text;
  if (!text) {
    throw new Error('Tool result does not contain text content');
  }
  return JSON.parse(text);
};

describe('mcp-server tools e2e', () => {
  let client: Client;
  let mockServer: ReturnType<typeof createServer>;
  let baseUrl: string;
  const capturedRequests: CapturedRequest[] = [];

  beforeAll(async () => {
    execSync('npm run build', { cwd: PACKAGE_DIR, stdio: 'pipe' });

    mockServer = createServer(async (req, res) => {
      const method = req.method ?? 'GET';
      const requestPath = req.url?.split('?')[0] ?? '/';
      const auth = req.headers.authorization;
      const body = await readJsonBody(req);

      capturedRequests.push({
        method,
        path: requestPath,
        auth,
        body,
      });

      if (auth !== `Bearer ${TEST_API_KEY}`) {
        json(res, { success: false, error: { message: 'Unauthorized' } }, 401);
        return;
      }

      if (method === 'PUT' && requestPath === '/v1/inbox/item-1') {
        json(res, {
          success: true,
          data: {
            id: 'item-1',
            category: body.category ?? 'unknown',
            content: body.content ?? '',
            updatedAtLocal: '2026-02-11 10:00:00',
          },
        });
        return;
      }

      if (method === 'DELETE' && requestPath === '/v1/inbox/item-1') {
        json(res, { success: true, message: 'Item deleted' });
        return;
      }

      if (method === 'GET' && requestPath === '/v1/categories') {
        json(res, {
          success: true,
          data: [
            { id: 'cat-1', key: 'todo', name: 'Todo', isActive: true },
            { id: 'cat-trash', key: 'trash', name: 'Trash', isActive: false },
          ],
        });
        return;
      }

      if (method === 'POST' && requestPath === '/v1/categories') {
        json(res, {
          success: true,
          data: {
            id: 'cat-new',
            key: body.key,
            name: body.name,
            isActive: true,
          },
        });
        return;
      }

      if (method === 'PUT' && requestPath === '/v1/categories/cat-1') {
        json(res, {
          success: true,
          data: {
            id: 'cat-1',
            key: 'todo',
            name: body.name ?? 'Todo',
            isActive: true,
          },
        });
        return;
      }

      if (method === 'DELETE' && requestPath === '/v1/categories/cat-1') {
        json(res, {
          success: true,
          data: {
            id: 'cat-1',
            key: 'todo',
            name: 'Todo',
            isActive: true,
          },
          meta: {
            migratedCount: 2,
            migratedTo: 'trash',
          },
        });
        return;
      }

      json(res, { success: false, error: { message: 'Not found' } }, 404);
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => resolve());
    });

    const address = mockServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    client = new Client(
      { name: 'mcp-server-e2e', version: '0.1.0' },
      { capabilities: {} as any }
    );

    const transport = new StdioClientTransport({
      command: 'node',
      args: [MCP_ENTRY],
      env: {
        ...process.env,
        SUPERINBOX_BASE_URL: baseUrl,
        SUPERINBOX_API_KEY: TEST_API_KEY,
      },
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    await new Promise<void>((resolve, reject) => {
      mockServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('registers new P0 tools', async () => {
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);

    expect(toolNames).toContain('inbox.update');
    expect(toolNames).toContain('inbox_update');
    expect(toolNames).toContain('inbox.delete');
    expect(toolNames).toContain('inbox_delete');
    expect(toolNames).toContain('category.list');
    expect(toolNames).toContain('category.create');
    expect(toolNames).toContain('category.update');
    expect(toolNames).toContain('category.delete');
    expect(toolNames).toContain('category_list');
    expect(toolNames).toContain('category_create');
    expect(toolNames).toContain('category_update');
    expect(toolNames).toContain('category_delete');
  });

  it('calls inbox.update and category.delete through mcp', async () => {
    const updateResult = await client.callTool({
      name: 'inbox.update',
      arguments: {
        id: 'item-1',
        category: 'todo',
      },
    });
    const updatePayload = extractToolPayload(updateResult);
    expect(updatePayload.data.id).toBe('item-1');
    expect(updatePayload.data.category).toBe('todo');
    expect(updatePayload.data.updatedAtLocal).toBe('2026-02-11 10:00:00');

    const deleteResult = await client.callTool({
      name: 'category_delete',
      arguments: {
        id: 'cat-1',
      },
    });
    const deletePayload = extractToolPayload(deleteResult);
    expect(deletePayload.meta.migratedCount).toBe(2);
    expect(deletePayload.meta.migratedTo).toBe('trash');

    expect(capturedRequests.some((entry) => entry.method === 'PUT' && entry.path === '/v1/inbox/item-1')).toBe(true);
    expect(capturedRequests.some((entry) => entry.method === 'DELETE' && entry.path === '/v1/categories/cat-1')).toBe(true);
  });
});
