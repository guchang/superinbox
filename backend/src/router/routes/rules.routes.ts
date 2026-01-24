/**
 * Routing Layer - Rules Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { sendError } from '../../utils/error-response.js';
import { getDatabase } from '../../storage/database.js';

const router = Router();

/**
 * Get all routing rules (user rules)
 */
router.get('/rules', authenticate, (req, res) => {
  const db = getDatabase();
  const userId = (req as any).user.id;

  try {
    // Get user rules from database
    const userRules = db.database.prepare(`
      SELECT * FROM routing_rules
      WHERE user_id = ?
      ORDER BY priority DESC, created_at ASC
    `).all(userId);

    // Parse JSON fields and convert to expected format
    const formattedUserRules = userRules.map((rule: any) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      priority: rule.priority,
      conditions: JSON.parse(rule.conditions || '[]'),
      actions: JSON.parse(rule.actions || '[]'),
      isActive: rule.is_active === 1,
      isSystem: rule.is_system === 1,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    }));

    res.json({
      success: true,
      data: formattedUserRules,
    });
  } catch (error) {
    console.error('Error fetching routing rules:', error);
    sendError(res, {
      statusCode: 500,
      code: 'ROUTING.FETCH_ERROR',
      message: 'Failed to fetch routing rules',
    });
  }
});

/**
 * Get a single routing rule by ID
 */
router.get('/rules/:id', authenticate, (req, res) => {
  const ruleId = req.params.id;
  const db = getDatabase();
  const userId = (req as any).user.id;

  try {
    const rule = db.database.prepare(`
      SELECT * FROM routing_rules
      WHERE id = ? AND user_id = ?
    `).get(ruleId, userId) as any;

    if (!rule) {
      return sendError(res, {
        statusCode: 404,
        code: 'ROUTING.RULE_NOT_FOUND',
        message: 'Routing rule not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
        conditions: JSON.parse(rule.conditions || '[]'),
        actions: JSON.parse(rule.actions || '[]'),
        isActive: rule.is_active === 1,
        isSystem: rule.is_system === 1,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching routing rule:', error);
    sendError(res, {
      statusCode: 500,
      code: 'ROUTING.FETCH_ERROR',
      message: 'Failed to fetch routing rule',
    });
  }
});

/**
 * Create a new routing rule
 */
router.post('/rules', authenticate, (req, res) => {
  const db = getDatabase();
  const userId = (req as any).user.id;

  const { name, description, priority, conditions, actions, isActive } = req.body;

  // Validate required fields
  if (!name || typeof name !== 'string') {
    return sendError(res, {
      statusCode: 400,
      code: 'ROUTING.INVALID_NAME',
      message: 'Name is required and must be a string',
    });
  }

  if (!conditions || !Array.isArray(conditions)) {
    return sendError(res, {
      statusCode: 400,
      code: 'ROUTING.INVALID_CONDITIONS',
      message: 'Conditions must be an array',
    });
  }

  if (!actions || !Array.isArray(actions)) {
    return sendError(res, {
      statusCode: 400,
      code: 'ROUTING.INVALID_ACTIONS',
      message: 'Actions must be an array',
    });
  }

  try {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.database.prepare(`
      INSERT INTO routing_rules (
        id, user_id, name, description, priority,
        conditions, actions, is_active, is_system,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      name,
      description || null,
      priority || 0,
      JSON.stringify(conditions),
      JSON.stringify(actions),
      isActive === false ? 0 : 1,
      0, // is_system = false for user-created rules
      now,
      now
    );

    res.json({
      success: true,
      data: {
        id,
        name,
        description,
        priority: priority || 0,
        conditions,
        actions,
        isActive: isActive !== false,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error('Error creating routing rule:', error);
    sendError(res, {
      statusCode: 500,
      code: 'ROUTING.CREATE_ERROR',
      message: 'Failed to create routing rule',
    });
  }
});

/**
 * Update a routing rule (user rules)
 */
router.put('/rules/:id', authenticate, (req, res) => {
  const ruleId = req.params.id;
  const db = getDatabase();
  const userId = (req as any).user.id;

  const { name, description, priority, conditions, actions, isActive } = req.body;

  try {
    // Check if rule exists and belongs to user
    const existingRule = db.database.prepare(`
      SELECT * FROM routing_rules
      WHERE id = ? AND user_id = ?
    `).get(ruleId, userId) as any;

    if (!existingRule) {
      return sendError(res, {
        statusCode: 404,
        code: 'ROUTING.RULE_NOT_FOUND',
        message: 'Routing rule not found',
      });
    }

    const now = new Date().toISOString();

    db.database.prepare(`
      UPDATE routing_rules
      SET name = ?, description = ?, priority = ?,
          conditions = ?, actions = ?, is_active = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      name || existingRule.name,
      description !== undefined ? description : existingRule.description,
      priority !== undefined ? priority : existingRule.priority,
      conditions ? JSON.stringify(conditions) : existingRule.conditions,
      actions ? JSON.stringify(actions) : existingRule.actions,
      isActive !== undefined ? (isActive ? 1 : 0) : existingRule.is_active,
      now,
      ruleId,
      userId
    );

    // Fetch updated rule
    const updatedRule = db.database.prepare(`
      SELECT * FROM routing_rules WHERE id = ?
    `).get(ruleId) as any;

    res.json({
      success: true,
      data: {
        id: updatedRule.id,
        name: updatedRule.name,
        description: updatedRule.description,
        priority: updatedRule.priority,
        conditions: JSON.parse(updatedRule.conditions || '[]'),
        actions: JSON.parse(updatedRule.actions || '[]'),
        isActive: updatedRule.is_active === 1,
        isSystem: updatedRule.is_system === 1,
        createdAt: updatedRule.created_at,
        updatedAt: updatedRule.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating routing rule:', error);
    sendError(res, {
      statusCode: 500,
      code: 'ROUTING.UPDATE_ERROR',
      message: 'Failed to update routing rule',
    });
  }
});

/**
 * Delete a routing rule (user rules)
 */
router.delete('/rules/:id', authenticate, (req, res) => {
  const ruleId = req.params.id;
  const db = getDatabase();
  const userId = (req as any).user.id;

  try {
    const result = db.database.prepare(`
      DELETE FROM routing_rules
      WHERE id = ? AND user_id = ?
    `).run(ruleId, userId);

    if (result.changes === 0) {
      return sendError(res, {
        statusCode: 404,
        code: 'ROUTING.RULE_NOT_FOUND',
        message: 'Routing rule not found',
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting routing rule:', error);
    sendError(res, {
      statusCode: 500,
      code: 'ROUTING.DELETE_ERROR',
      message: 'Failed to delete routing rule',
    });
  }
});

/**
 * Test a routing rule
 */
router.post('/rules/:id/test', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      matched: true,
      rule: req.params.id,
    },
  });
});

/**
 * @route   POST /v1/routing/dispatch/:id
 * @desc    Manually dispatch an item to configured adapters
 * @access  Private (requires authentication)
 */
import { dispatchItem } from '../controllers/dispatch.controller.js';
router.post('/dispatch/:id', authenticate, dispatchItem);

/**
 * Test MCP connector connection
 */
router.post('/connectors/test', authenticate, async (req, res) => {
  const config = req.body?.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return sendError(res, {
      statusCode: 400,
      code: 'ROUTING.INVALID_CONFIG',
      message: 'Invalid config: expected object'
    });
  }

  const fetchFn: any = (globalThis as any).fetch;
  if (typeof fetchFn !== 'function') {
    return sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Fetch API not available in server runtime'
    });
  }

  const mcpServers = (config as any).mcpServers;
  if (!mcpServers || typeof mcpServers !== 'object' || Array.isArray(mcpServers)) {
    return sendError(res, {
      statusCode: 400,
      code: 'ROUTING.INVALID_CONFIG',
      message: 'Invalid config: mcpServers is required'
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

  const { Client } = await import('@modelcontextprotocol/sdk/client');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp');

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
      message = error?.message || '连接失败';
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
 * @route   POST /v1/routing/rules/test-dispatch
 * @desc    Append input content to a Notion page via MCP adapter (SSE streaming)
 * @access  Private (requires authentication)
 */
router.post('/rules/test-dispatch', authenticate, async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Helper to send SSE event
  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Helper to send error and close
  const sendErrorEvent = (code: string, message: string) => {
    sendEvent('error', { code, message });
    res.end();
  };

  try {
    const { content, mcpAdapterId, params, instructions, toolName } = req.body;
    const userId = (req as any).user.id;

    // Validate required fields
    if (!content || typeof content !== 'string') {
      return sendErrorEvent('ROUTING.INVALID_INPUT', 'Content is required and must be a string');
    }

    if (!mcpAdapterId) {
      return sendErrorEvent('ROUTING.INVALID_INPUT', 'MCP adapter ID is required');
    }

    if (params && typeof params !== 'object') {
      return sendErrorEvent('ROUTING.INVALID_INPUT', 'Params must be an object');
    }

    if (!instructions || typeof instructions !== 'string' || !instructions.trim()) {
      return sendErrorEvent('ROUTING.INVALID_INPUT', 'Instructions are required');
    }

    // Send init event
    sendEvent('init', { status: 'starting', message: 'Initializing MCP adapter...' });

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
      return sendErrorEvent('ROUTING.CONNECTOR_NOT_FOUND', 'MCP adapter not found');
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
    sendEvent('init', { status: 'ready', message: 'MCP adapter initialized' });

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

    sendEvent('tools', {
      defaultToolName,
      availableTools: tools.map((t: { name?: string }) => t?.name).filter(Boolean),
      toolCount: tools.length
    });

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
      llmDecision?: {
        lastResultStatus: 'success' | 'error' | 'none';
        tool: string | null;
        arguments: Record<string, unknown> | null;
        done: boolean;
      };
      llmRaw?: {
        input: string;
        output: unknown;
      };
    }> = [];

    const context = {
      params: params || {},
      defaultToolName,
      availableTools: tools.map((tool: { name?: string }) => tool?.name).filter(Boolean),
      toolSchemas
    };

    // Initialize chat history
    const messages: Array<{ role: string; content: string }> = [];

    // 1. System Prompt: Define role, output format, and available tools
    const serializedSchemas = JSON.stringify(context.toolSchemas, null, 2);
    const systemPrompt = [
      'You are orchestrating MCP tool calls.',
      'Goal: complete the user request using available MCP tools.',
      '',
      'Return ONLY a JSON object with this EXACT format:',
      '{',
      '  "lastResultStatus": "success" | "error" | "none",',
      '  "tool": "<toolName>",',
      '  "arguments": { ... },',
      '  "done": boolean',
      '}',
      '',
      'Fields:',
      '- lastResultStatus: YOUR judgment of the previous step\'s result:',
      '  - "none": This is the first step, no previous result',
      '  - "success": The previous call succeeded (got valid data, created/updated resource)',
      '  - "error": The previous call failed (contains error message, status 4xx/5xx, validation error)',
      '- tool: The next tool to call (omit if done=true)',
      '- arguments: The arguments for the tool (omit if done=true)',
      '- done: Set to true when the task is complete OR when you cannot proceed',
      '',
      'Rules:',
      '- Do NOT include HTTP headers (Notion-Version, Authorization, Content-Type).',
      '- Do NOT invent IDs. Use provided params (like pageId) when specific IDs are required.',
      '- After a successful write operation, return done=true.',
      '- Prefer the minimal number of steps.',
      '',
      'Error handling:',
      '- If lastResultStatus is "error", DO NOT retry with the same tool and same arguments.',
      '- Try a different approach, or return done=true if no alternative exists.',
      '- After 2-3 consecutive errors, you should give up and return done=true.',
      '',
      `Available Tools: ${JSON.stringify(context.availableTools)}`,
      `Tool Schemas: ${serializedSchemas}`
    ].join('\n');

    messages.push({ role: 'system', content: systemPrompt });

    // 2. Initial User Message: Instructions and Item Data
    const serializedParams = JSON.stringify(context.params, null, 2);
    let initialUserMessage = `== User Instructions ==\n${instructions.trim()}\n\n`;
    initialUserMessage += `== Context Params ==\n${serializedParams}\n\n`;
    initialUserMessage += `== Item Data ==\n`;
    initialUserMessage += `Content: ${testItem.originalContent}\n`;

    if (testItem.suggestedTitle) initialUserMessage += `Title: ${testItem.suggestedTitle}\n`;
    if (testItem.summary) initialUserMessage += `Summary: ${testItem.summary}\n`;

    messages.push({ role: 'user', content: initialUserMessage });

    let finalStatus = 'success';
    let consecutiveErrors = 0;

    for (let stepIndex = 0; stepIndex < 10; stepIndex += 1) {
      // Send step start event
      sendEvent('step:start', { step: stepIndex + 1, status: 'planning' });

      // Call LLM with chat history
      const responseContent = await llmService.chat(messages, { jsonMode: true });

      // Parse LLM response
      let plannerOutput: any;
      try {
        // Try to extract JSON if mixed with text
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : responseContent;
        plannerOutput = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse LLM response:', e);
        plannerOutput = { done: true, lastResultStatus: 'error' }; // Fail safe
      }

      // Add Assistant response to history
      messages.push({ role: 'assistant', content: responseContent });

      // Send LLM decision event for frontend display
      const currentLlmDecision = {
        lastResultStatus: plannerOutput.lastResultStatus as 'success' | 'error' | 'none',
        tool: plannerOutput.tool || null,
        arguments: plannerOutput.arguments || null,
        done: plannerOutput.done === true
      };

      // For frontend display, we show the latest exchange
      const currentLlmRaw = {
        input: JSON.stringify(messages, null, 2), // Show full history or just latest? Let's show full history for context
        output: plannerOutput
      };

      sendEvent('step:planned', {
        step: stepIndex + 1,
        llmDecision: currentLlmDecision,
        llmRaw: currentLlmRaw
      });

      // Track LLM's judgment of last result
      const llmStatus = plannerOutput.lastResultStatus as string;
      if (llmStatus === 'error') {
        consecutiveErrors += 1;
        // Update the previous step's status based on LLM judgment
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          lastStep.error = 'LLM detected error in response';
          sendEvent('step:error', { ...lastStep, status: 'error' });
        }
        console.log(`[test-dispatch] LLM judged last result as error (${consecutiveErrors} consecutive)`);
      } else if (llmStatus === 'success') {
        consecutiveErrors = 0;
      }

      // Stop if too many consecutive errors
      if (consecutiveErrors >= 3) {
        console.log('[test-dispatch] Too many consecutive errors, stopping');
        finalStatus = 'failed';
        break;
      }

      const done = plannerOutput.done === true;
      if (done) {
        const stepData = {
          step: stepIndex + 1,
          toolName: 'done',
          toolArgs: {},
          toolResponse: null
        };
        steps.push({
          ...stepData,
          llmDecision: currentLlmDecision,
          llmRaw: currentLlmRaw
        });
        sendEvent('step:complete', { ...stepData, status: 'done' });
        // If LLM says done after errors, mark as failed
        if (consecutiveErrors > 0) {
          finalStatus = 'failed';
        }
        break;
      }

      const nextTool = plannerOutput.tool;
      const nextArgs = plannerOutput.arguments;

      if (typeof nextTool !== 'string' || !nextTool.trim()) {
        const stepData = {
          step: stepIndex + 1,
          toolName: 'unknown',
          toolArgs: {},
          error: 'Planner did not return a tool name'
        };
        steps.push({
          ...stepData,
          llmDecision: currentLlmDecision,
          llmRaw: currentLlmRaw
        });
        sendEvent('step:error', stepData);
        finalStatus = 'failed';
        break;
      }

      if (!nextArgs || typeof nextArgs !== 'object') {
        const stepData = {
          step: stepIndex + 1,
          toolName: nextTool,
          toolArgs: {},
          error: 'Planner did not return tool arguments'
        };
        steps.push({
          ...stepData,
          llmDecision: currentLlmDecision,
          llmRaw: currentLlmRaw
        });
        sendEvent('step:error', stepData);
        finalStatus = 'failed';
        break;
      }

      // Send executing event
      sendEvent('step:executing', {
        step: stepIndex + 1,
        toolName: nextTool,
        toolArgs: nextArgs
      });

      try {
        const toolResult = await mcpAdapter.callTool(nextTool, nextArgs as Record<string, unknown>);

        // Just log for debugging, let LLM decide if it's an error
        console.log('[test-dispatch] Tool result:', JSON.stringify(toolResult?.content || '').substring(0, 500));

        const stepData = {
          step: stepIndex + 1,
          toolName: nextTool,
          toolArgs: nextArgs as Record<string, unknown>,
          toolResponse: toolResult?.content
        };
        steps.push({
          ...stepData,
          llmDecision: currentLlmDecision,
          llmRaw: currentLlmRaw
        });
        sendEvent('step:complete', { ...stepData, status: 'success' });

        // Add tool result to chat history as User Message
        const toolOutput = toolResult?.content ? JSON.stringify(toolResult.content) : 'Success (no content)';
        messages.push({
          role: 'user',
          content: `Result of tool "${nextTool}":\n${toolOutput}`
        });

      } catch (error) {
        // Exception means definite failure
        const errorMessage = error instanceof Error ? error.message : String(error);
        const stepData = {
          step: stepIndex + 1,
          toolName: nextTool,
          toolArgs: nextArgs as Record<string, unknown>,
          error: errorMessage
        };
        steps.push({
          ...stepData,
          llmDecision: currentLlmDecision,
          llmRaw: currentLlmRaw
        });
        sendEvent('step:error', stepData);

        // Add error to chat history as User Message
        messages.push({
          role: 'user',
          content: `Error executing tool "${nextTool}": ${errorMessage}`
        });
      }
    }

    // Cleanup adapter resources (especially important for stdio)
    mcpAdapter.cleanup();

    // Send final complete event
    sendEvent('complete', {
      success: finalStatus === 'success',
      status: finalStatus,
      params,
      toolName: defaultToolName,
      toolSchema: toolSchemas[defaultToolName] || {},
      steps
    });

    res.end();
  } catch (error: any) {
    console.error('Test dispatch error:', error);

    // Cleanup adapter resources if error
    try {
      const { mcpAdapter } = await import('../adapters/mcp-adapter.js');
      mcpAdapter.cleanup();
    } catch {}

    sendEvent('error', {
      code: 'INTERNAL_ERROR',
      message: error?.message || 'Test dispatch failed',
      details: error?.stack
    });
    res.end();
  }
});

export default router;
