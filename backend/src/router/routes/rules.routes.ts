/**
 * Routing Layer - Rules Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { sendError } from '../../utils/error-response.js';
import { getDatabase } from '../../storage/database.js';
import { getDispatcherService } from '../dispatcher.service.js';
import { ContentType, ItemStatus } from '../../types/index.js';

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

  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

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
      const transport = new StdioClientTransport({
        command: 'node',
        args: ['-e', 'console.log("test")']
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
  res.setHeader('X-Accel-Buffering', 'no');

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

    // Create test item
    const testItem = {
      id: uuidv4(),
      userId,
      originalContent: content.trim(),
      contentType: ContentType.TEXT,
      source: 'rule-test',
      category: 'note' as const,
      entities: {},
      summary: content.trim().slice(0, 100),
      suggestedTitle: content.trim().slice(0, 50),
      status: ItemStatus.PENDING,
      distributedTargets: [],
      distributionResults: [],
      routingStatus: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Use DispatcherService with progress callback
    const dispatcherService = getDispatcherService();
    const result = await dispatcherService.dispatchToMCP({
      item: testItem,
      mcpAdapterId,
      toolName,
      instructions,
      params,
      onProgress: sendEvent
    });

    // Send final complete event
    sendEvent('complete', {
      success: result.success,
      steps: result.steps,
      error: result.error
    });

    res.end();
  } catch (error: any) {
    console.error('Test dispatch error:', error);
    sendErrorEvent('INTERNAL_ERROR', error?.message || 'Test dispatch failed');
  }
});

export default router;
