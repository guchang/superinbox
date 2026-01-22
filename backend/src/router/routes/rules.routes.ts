/**
 * Routing Layer - Rules Routes
 */

import { Router } from 'express';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { authenticate } from '../../middleware/auth.js';
import { dispatchItem } from '../controllers/dispatch.controller.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Placeholder routes for routing rules
router.get('/rules', authenticate, (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        name: 'Todo to Notion',
        description: 'Route todo items to Notion',
        priority: 1,
        conditions: [
          { field: 'category', operator: 'equals', value: 'todo' }
        ],
        actions: [
          { type: 'notion', config: { databaseId: 'xxx' } }
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ]
  });
});

router.get('/rules/:id', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      name: 'Todo to Notion',
      description: 'Route todo items to Notion',
      priority: 1,
      conditions: [
        { field: 'intent', operator: 'equals', value: 'todo' }
      ],
      actions: [
        { type: 'notion', config: { databaseId: 'xxx' } }
      ],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  });
});

router.post('/rules', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  });
});

router.put('/rules/:id', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    }
  });
});

router.delete('/rules/:id', authenticate, (req, res) => {
  res.json({ success: true });
});

router.post('/rules/:id/test', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      matched: true,
      rule: req.params.id,
    }
  });
});

function extractMcpErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as any).message || '连接失败');
    const jsonStart = message.indexOf('{');
    if (jsonStart >= 0) {
      const jsonText = message.slice(jsonStart);
      try {
        const payload = JSON.parse(jsonText);
        if (typeof payload?.error_description === 'string') {
          return payload.error_description;
        }
        if (typeof payload?.error === 'string') {
          return payload.error;
        }
      } catch {
        // Ignore JSON parsing errors and fall back to the raw message.
      }
    }
    return message;
  }

  return '连接失败';
}

// Summary helpers removed; test dispatch now appends content to page.

router.post('/connectors/test', authenticate, async (req, res) => {
  const config = req.body?.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid config: expected object',
    });
  }

  const fetchFn: any = (globalThis as any).fetch;
  if (typeof fetchFn !== 'function') {
    return res.status(500).json({
      success: false,
      error: 'Fetch API not available in server runtime',
    });
  }

  const mcpServers = (config as any).mcpServers;
  if (!mcpServers || typeof mcpServers !== 'object' || Array.isArray(mcpServers)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid config: mcpServers is required',
    });
  }

  const results: Array<{
    name: string;
    url: string;
    ok: boolean;
    message: string;
    latencyMs: number;
    toolsCount?: number;
  }> = [];

  for (const [name, server] of Object.entries(mcpServers)) {
    const url = typeof (server as any)?.url === 'string' ? (server as any).url : '';
    const startedAt = Date.now();
    if (!url) {
      results.push({
        name,
        url: '',
        ok: false,
        message: 'Missing server url',
        latencyMs: 0,
      });
      continue;
    }

    let ok = false;
    let message = '';
    let toolsCount: number | undefined;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      const customHeaders = (server as any)?.headers;
      if (customHeaders && typeof customHeaders === 'object') {
        for (const [key, value] of Object.entries(customHeaders)) {
          if (typeof value === 'string') {
            headers[key] = value;
          }
        }
      }

      const client = new Client(
        {
          name: 'SuperInbox',
          version: '0.1.0',
        },
        {
          capabilities: {} as any,
        }
      );
      const transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers,
        },
        fetch: fetchFn,
      });

      try {
        await client.connect(transport);
        const toolsResult = await client.listTools();
        ok = true;
        toolsCount = toolsResult.tools.length;
        message = `tools/list 返回 ${toolsCount} 个工具`;
      } finally {
        await client.close();
      }
    } catch (error: any) {
      message = extractMcpErrorMessage(error);
      ok = false;
    }

    results.push({
      name,
      url,
      ok,
      message,
      latencyMs: Date.now() - startedAt,
      toolsCount,
    });
  }

  const success = results.length > 0 && results.every((result) => result.ok);
  return res.json({
    success,
    data: { results },
  });
});

/**
 * @route   POST /v1/routing/dispatch/:id
 * @desc    Manually dispatch an item to configured adapters
 * @access  Private (requires authentication)
 */
router.post('/dispatch/:id', authenticate, dispatchItem);

/**
 * @route   POST /v1/routing/rules/test-dispatch
 * @desc    Append input content to a Notion page via MCP adapter
 * @access  Private (requires authentication)
 */
router.post('/rules/test-dispatch', authenticate, async (req, res) => {
  try {
    const { content, mcpAdapterId, pageId, instructions, toolName } = req.body;
    const userId = (req as any).user.id;

    // Validate required fields
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content is required and must be a string'
      });
    }

    if (!mcpAdapterId) {
      return res.status(400).json({
        success: false,
        error: 'MCP adapter ID is required'
      });
    }

    if (!pageId || typeof pageId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Page ID is required'
      });
    }

    if (!instructions || typeof instructions !== 'string' || !instructions.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Instructions are required'
      });
    }

    // Import required modules
    const { mcpAdapter } = await import('../adapters/mcp-adapter.js');
    const { getLLMMappingService } = await import('../mcp/llm-mapping.service.js');

    // Get MCP adapter configuration
    const { getDatabase } = await import('../../storage/database.js');
    const db = getDatabase();

    const adapterRow = db.database.prepare(`
      SELECT * FROM mcp_adapter_configs
      WHERE id = ? AND user_id = ?
    `).get(mcpAdapterId, userId) as any;

    if (!adapterRow) {
      return res.status(404).json({
        success: false,
        error: 'MCP adapter not found'
      });
    }

    // Parse env if stored as JSON string
    let env: Record<string, string> | undefined = undefined;
    if (adapterRow.env) {
      try {
        env = JSON.parse(adapterRow.env);
      } catch {
        env = undefined;
      }
    }

    // Build adapter config
    const adapterConfig: Record<string, unknown> = {
      name: adapterRow.name,
      serverUrl: adapterRow.server_url,
      serverType: adapterRow.server_type,
      transportType: adapterRow.transport_type || 'http',
      command: adapterRow.command,
      env,
      authType: adapterRow.auth_type,
      apiKey: adapterRow.api_key,
      oauthAccessToken: adapterRow.oauth_access_token,
      timeout: adapterRow.timeout || 180000,
      maxRetries: adapterRow.max_retries || 3
    };

    // Initialize adapter
    await mcpAdapter.initialize(adapterConfig);

    const defaultToolName = typeof toolName === 'string' && toolName.trim()
      ? toolName.trim()
      : adapterRow.default_tool_name
      || (adapterRow.server_type === 'notion' ? 'API-patch-block-children' : 'create-resource');

    const tools = await mcpAdapter.listTools(true);
    const toolSchemas = tools
      .filter((tool: { name?: string }) => typeof tool?.name === 'string')
      .reduce<Record<string, Record<string, unknown>>>((acc, tool: { name?: string; inputSchema?: Record<string, unknown> }) => {
        if (tool.name) {
          acc[tool.name] = tool.inputSchema || {};
        }
        return acc;
      }, {});

    const testItem = {
      id: uuidv4(),
      userId,
      originalContent: content.trim(),
      contentType: 'text' as const,
      source: 'rule-test',
      intent: 'note' as const,
      entities: {},
      summary: content.trim().slice(0, 100),
      suggestedTitle: content.trim().slice(0, 50),
      status: 'pending' as const,
      priority: 1,
      distributedTargets: [],
      distributionResults: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const llmService = getLLMMappingService();
    const steps: Array<{
      step: number;
      toolName: string;
      toolArgs: Record<string, unknown>;
      toolResponse?: unknown;
      error?: string;
    }> = [];

    const context = {
      pageId,
      defaultToolName,
      availableTools: tools.map((tool: { name?: string }) => tool?.name).filter(Boolean),
      toolSchemas
    };

    const buildPlannerInstructions = (stepIndex: number, lastResult?: unknown) => {
      const serializedSchemas = JSON.stringify(context.toolSchemas, null, 2);
      const serializedLast = lastResult ? JSON.stringify(lastResult, null, 2) : 'null';
      return [
        instructions.trim(),
        'You are orchestrating MCP tool calls.',
        'Goal: complete the user request using available MCP tools.',
        'Return ONLY a JSON object with: { "tool": "<toolName>", "arguments": { ... }, "done": boolean }.',
        'If done is true, tool/arguments can be omitted.',
        'Do NOT include HTTP headers (Notion-Version, Authorization, Content-Type).',
        'Do NOT invent IDs. Use pageId when a block/page id is required.',
        'Execute at most one write/mutate tool. After a successful write, return done=true.',
        'Prefer the minimal number of steps.',
        `pageId: ${context.pageId}`,
        `defaultToolName: ${context.defaultToolName}`,
        `availableTools: ${JSON.stringify(context.availableTools)}`,
        `toolSchemas: ${serializedSchemas}`,
        `lastResult: ${serializedLast}`,
        `step: ${stepIndex + 1} of 5`
      ].join('\n');
    };

    const isWriteTool = (name: string): boolean => {
      const normalized = name.toLowerCase();
      if (normalized.includes('search')) {
        return false;
      }
      if (
        normalized.includes('get') ||
        normalized.includes('retrieve') ||
        normalized.includes('list') ||
        normalized.includes('query') ||
        normalized.includes('read')
      ) {
        return false;
      }
      return true;
    };

    let lastResult: unknown;
    for (let stepIndex = 0; stepIndex < 3; stepIndex += 1) {
      const plannerOutput = await llmService.transform(testItem, {
        instructions: buildPlannerInstructions(stepIndex, lastResult),
        targetSchema: {
          type: 'object',
          properties: {
            tool: { type: 'string' },
            arguments: { type: 'object' },
            done: { type: 'boolean' }
          },
          required: ['done']
        },
        allowFallback: false
      });

      const done = plannerOutput.done === true;
      if (done) {
        steps.push({
          step: stepIndex + 1,
          toolName: 'done',
          toolArgs: {},
          toolResponse: null
        });
        break;
      }

      const nextTool = plannerOutput.tool;
      const nextArgs = plannerOutput.arguments;
      if (typeof nextTool !== 'string' || !nextTool.trim()) {
        steps.push({
          step: stepIndex + 1,
          toolName: 'unknown',
          toolArgs: {},
          error: 'Planner did not return a tool name'
        });
        break;
      }

      if (!nextArgs || typeof nextArgs !== 'object') {
        steps.push({
          step: stepIndex + 1,
          toolName: nextTool,
          toolArgs: {},
          error: 'Planner did not return tool arguments'
        });
        break;
      }

      try {
        const toolResult = await mcpAdapter.callTool(nextTool, nextArgs as Record<string, unknown>);
        steps.push({
          step: stepIndex + 1,
          toolName: nextTool,
          toolArgs: nextArgs as Record<string, unknown>,
          toolResponse: toolResult?.content
        });
        lastResult = toolResult?.content;
        if (isWriteTool(nextTool)) {
          break;
        }
      } catch (error) {
        steps.push({
          step: stepIndex + 1,
          toolName: nextTool,
          toolArgs: nextArgs as Record<string, unknown>,
          error: error instanceof Error ? error.message : String(error)
        });
        break;
      }
    }

    // Cleanup adapter resources (especially important for stdio)
    mcpAdapter.cleanup();

    const hasError = steps.some((step) => step.error);
    res.json({
      success: !hasError,
      data: {
        pageId,
        status: hasError ? 'failed' : 'success',
        toolName: defaultToolName,
        toolSchema: toolSchemas[defaultToolName] || {},
        steps
      }
    });
  } catch (error: any) {
    console.error('Test dispatch error:', error);

    // Cleanup adapter resources if error
    try {
      const { mcpAdapter } = await import('../adapters/mcp-adapter.js');
      mcpAdapter.cleanup();
    } catch {}

    res.status(500).json({
      success: false,
      error: error?.message || 'Test dispatch failed',
      details: error?.stack
    });
  }
});

export default router;
