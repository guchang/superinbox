/**
 * MCP Adapter Config Routes
 * API endpoints for managing MCP adapter configurations
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { MCPAdapterConfig } from '../../types/index.js';
import { getDatabase } from '../../storage/database.js';
import { authenticate } from '../../middleware/auth.js';
import { logger } from '../../middleware/logger.js';
import { mcpAdapter } from '../adapters/mcp-adapter.js';

const router = Router();

function extractToolErrorFromContent(content: unknown): string | null {
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content) as { status?: number; message?: string; error?: string } | null;
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.status === 'number' && parsed.status >= 400) {
          return parsed.message || parsed.error || `HTTP ${parsed.status}`;
        }
        if (typeof parsed.error === 'string') {
          return parsed.error;
        }
      }
      return null;
    } catch {
      return content;
    }
  }

  if (Array.isArray(content)) {
    for (const entry of content) {
      if (entry && typeof entry === 'object') {
        const text = (entry as { text?: string }).text;
        if (typeof text === 'string') {
          const message = extractToolErrorFromContent(text);
          if (message) {
            return message;
          }
        }
      }
    }
    return null;
  }

  if (content && typeof content === 'object') {
    const status = (content as { status?: number }).status;
    if (typeof status === 'number' && status >= 400) {
      const message = (content as { message?: string; error?: string }).message
        || (content as { error?: string }).error;
      return message || `HTTP ${status}`;
    }
    if (typeof (content as { error?: string }).error === 'string') {
      return (content as { error?: string }).error || null;
    }
  }

  return null;
}

/**
 * GET /v1/mcp-adapters
 * List all MCP adapter configs for the current user
 */
router.get('/', authenticate, (req, res) => {
  try {
    const userId = (req as any).user.id;
    const db = getDatabase();

    const stmt = db.database.prepare(`
      SELECT * FROM mcp_adapter_configs
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(userId) as any[];

    const configs = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      serverUrl: row.server_url,
      serverType: row.server_type,
      transportType: row.transport_type || 'http',
      command: row.command,
      authType: row.auth_type,
      // Don't expose sensitive tokens in list view
      hasApiKey: !!row.api_key,
      hasOAuthToken: !!row.oauth_access_token,
      defaultToolName: row.default_tool_name,
      enabled: Boolean(row.enabled),
      lastHealthCheck: row.last_health_check,
      lastHealthCheckStatus: row.last_health_check_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({ success: true, data: configs });
  } catch (error) {
    logger.error('Failed to list MCP adapters:', error);
    res.status(500).json({ success: false, error: 'Failed to list MCP adapters' });
  }
});

/**
 * GET /v1/mcp-adapters/:id
 * Get a specific MCP adapter config
 */
router.get('/:id', authenticate, (req, res): any => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const db = getDatabase();

    const stmt = db.database.prepare(`
      SELECT * FROM mcp_adapter_configs
      WHERE id = ? AND user_id = ?
    `);

    const row = stmt.get(id, userId) as any;

    if (!row) {
      return res.status(404).json({ success: false, error: 'MCP adapter not found' });
    }

    // Parse env if stored as JSON string
    let env: Record<string, string> | undefined = undefined;
    if (row.env) {
      try {
        env = JSON.parse(row.env);
      } catch {
        env = undefined;
      }
    }

    const config: MCPAdapterConfig = {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      serverUrl: row.server_url,
      serverType: row.server_type,
      transportType: row.transport_type || 'http',
      command: row.command,
      env,
      authType: row.auth_type,
      apiKey: row.api_key,
      oauthProvider: row.oauth_provider,
      oauthAccessToken: row.oauth_access_token,
      oauthRefreshToken: row.oauth_refresh_token,
      oauthTokenExpiresAt: row.oauth_token_expires_at,
      oauthScopes: row.oauth_scopes,
      defaultToolName: row.default_tool_name,
      toolConfigCache: row.tool_config_cache,
      llmProvider: row.llm_provider,
      llmApiKey: row.llm_api_key,
      llmModel: row.llm_model,
      llmBaseUrl: row.llm_base_url,
      timeout: row.timeout,
      maxRetries: row.max_retries,
      cacheTtl: row.cache_ttl,
      enabled: row.enabled,
      lastHealthCheck: row.last_health_check,
      lastHealthCheckStatus: row.last_health_check_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to get MCP adapter:', error);
    res.status(500).json({ success: false, error: 'Failed to get MCP adapter' });
  }
});

/**
 * POST /v1/mcp-adapters
 * Create a new MCP adapter config
 */
router.post('/', authenticate, (req, res): any => {
  try {
    const userId = (req as any).user.id;
    const db = getDatabase();

    // Determine transport type based on server type
    const transportType: 'http' | 'stdio' = req.body.transportType ||
      (req.body.serverType === 'notion' ? 'stdio' : 'http');

    // Build env object from various sources
    let env: Record<string, string> = {};

    // Add explicit env from request
    if (req.body.env) {
      env = { ...env, ...req.body.env };
    }

    // Add API key to environment for stdio
    if (transportType === 'stdio' && req.body.apiKey) {
      env.NOTION_TOKEN = req.body.apiKey;
    }

    // Get default command for stdio types
    const getDefaultCommand = (serverType: string): string => {
      const commandMapping: Record<string, string> = {
        notion: 'npx -y @notionhq/notion-mcp-server',
        github: 'npx -y @modelcontextprotocol/server-github',
        obsidian: 'npx -y @modelcontextprotocol/server-obsidian'
      };
      return commandMapping[serverType] || `npx @modelcontextprotocol/server-${serverType}`;
    };

    const serverType = req.body.serverType || 'custom';

    const config: MCPAdapterConfig = {
      id: uuidv4(),
      userId,
      name: req.body.name,
      serverUrl: req.body.serverUrl || serverType,
      serverType,
      transportType,
      command: transportType === 'stdio' ? (req.body.command || getDefaultCommand(serverType)) : undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      authType: transportType === 'stdio' ? 'none' : (req.body.authType || 'api_key'),
      apiKey: req.body.apiKey,
      oauthProvider: req.body.oauthProvider,
      oauthAccessToken: req.body.oauthAccessToken,
      oauthRefreshToken: req.body.oauthRefreshToken,
      oauthTokenExpiresAt: req.body.oauthTokenExpiresAt,
      oauthScopes: req.body.oauthScopes,
      defaultToolName: req.body.defaultToolName,
      toolConfigCache: undefined,
      llmProvider: req.body.llmProvider,
      llmApiKey: req.body.llmApiKey,
      llmModel: req.body.llmModel,
      llmBaseUrl: req.body.llmBaseUrl,
      timeout: req.body.timeout || 30000,
      maxRetries: req.body.maxRetries || 3,
      cacheTtl: req.body.cacheTtl || 300,
      enabled: req.body.enabled !== undefined ? (req.body.enabled ? 1 : 0) : 1,
      lastHealthCheck: undefined,
      lastHealthCheckStatus: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Validate configuration
    if (!mcpAdapter.validate(config as unknown as Record<string, unknown>)) {
      return res.status(400).json({ success: false, error: 'Invalid MCP adapter configuration' });
    }

    // Insert into database
    const stmt = db.database.prepare(`
      INSERT INTO mcp_adapter_configs (
        id, user_id, name, server_url, server_type, auth_type,
        api_key, oauth_provider, oauth_access_token, oauth_refresh_token,
        oauth_token_expires_at, oauth_scopes, default_tool_name, tool_config_cache,
        llm_provider, llm_api_key, llm_model, llm_base_url,
        timeout, max_retries, cache_ttl, enabled,
        last_health_check, last_health_check_status,
        created_at, updated_at, transport_type, command, env
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      config.id, config.userId, config.name, config.serverUrl, config.serverType,
      config.authType, config.apiKey, config.oauthProvider, config.oauthAccessToken,
      config.oauthRefreshToken, config.oauthTokenExpiresAt, config.oauthScopes,
      config.defaultToolName, config.toolConfigCache,
      config.llmProvider, config.llmApiKey, config.llmModel, config.llmBaseUrl,
      config.timeout, config.maxRetries, config.cacheTtl,
      config.enabled,
      config.lastHealthCheck, config.lastHealthCheckStatus,
      config.createdAt, config.updatedAt,
      config.transportType, config.command, JSON.stringify(config.env || {})
    );

    logger.info(`Created MCP adapter config: ${config.id} (${config.name}, transport: ${config.transportType})`);

    res.status(201).json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to create MCP adapter:', error);
    logger.error('Failed to create MCP adapter:', error);
    res.status(500).json({ success: false, error: 'Failed to create MCP adapter', details: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * PUT /v1/mcp-adapters/:id
 * Update an MCP adapter config
 */
router.put('/:id', authenticate, (req, res): any => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const db = getDatabase();

    // Check if exists
    const checkStmt = db.database.prepare(`
      SELECT id FROM mcp_adapter_configs WHERE id = ? AND user_id = ?
    `);
    const exists = checkStmt.get(id, userId);

    if (!exists) {
      return res.status(404).json({ success: false, error: 'MCP adapter not found' });
    }

    // Build update data
    const updates: string[] = [];
    const values: unknown[] = [];

    const allowedFields = [
      'name', 'serverUrl', 'serverType', 'authType', 'apiKey',
      'oauthProvider', 'oauthAccessToken', 'oauthRefreshToken',
      'oauthTokenExpiresAt', 'oauthScopes', 'defaultToolName',
      'llmProvider', 'llmApiKey', 'llmModel', 'llmBaseUrl',
      'timeout', 'maxRetries', 'cacheTtl', 'enabled'
    ];

    for (const field of allowedFields) {
      if (field in req.body) {
        const value = req.body[field];
        if (typeof value === 'undefined') {
          continue;
        }
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updates.push(`${dbField} = ?`);
        if (field === 'enabled') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    }

    values.push(new Date().toISOString()); // updated_at
    updates.push('updated_at = ?');
    values.push(id, userId);

    const stmt = db.database.prepare(`
      UPDATE mcp_adapter_configs
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(...values);

    // Fetch updated config
    const getStmt = db.database.prepare(`
      SELECT * FROM mcp_adapter_configs WHERE id = ? AND user_id = ?
    `);
    const row = getStmt.get(id, userId) as any;

    logger.info(`Updated MCP adapter config: ${id}`);

    res.json({ success: true, data: row });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to update MCP adapter');
    res.status(500).json({
      success: false,
      error: 'Failed to update MCP adapter',
      details: errorMessage
    });
  }
});

/**
 * DELETE /v1/mcp-adapters/:id
 * Delete an MCP adapter config
 */
router.delete('/:id', authenticate, (req, res): any => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const db = getDatabase();

    const stmt = db.database.prepare(`
      DELETE FROM mcp_adapter_configs
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'MCP adapter not found' });
    }

    logger.info(`Deleted MCP adapter config: ${id}`);

    res.json({ success: true, message: 'MCP adapter deleted' });
  } catch (error) {
    logger.error('Failed to delete MCP adapter:', error);
    res.status(500).json({ success: false, error: 'Failed to delete MCP adapter' });
  }
});

/**
 * POST /v1/mcp-adapters/:id/test
 * Test connection to an MCP adapter
 */
router.post('/:id/test', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const db = getDatabase();

    // Get config
    const stmt = db.database.prepare(`
      SELECT * FROM mcp_adapter_configs
      WHERE id = ? AND user_id = ?
    `);

    const row = stmt.get(id, userId) as any;

    if (!row) {
      return res.status(404).json({ success: false, error: 'MCP adapter not found' });
    }

    // Parse env if stored as JSON string
    let env: Record<string, string> | undefined = undefined;
    if (row.env) {
      try {
        env = JSON.parse(row.env);
      } catch {
        env = undefined;
      }
    }

    // Build config for adapter
    const adapterConfig: Record<string, unknown> = {
      name: row.name,
      serverUrl: row.server_url,
      serverType: row.server_type,
      transportType: row.transport_type || 'http',
      command: row.command,
      env,
      authType: row.auth_type,
      apiKey: row.api_key,
      oauthAccessToken: row.oauth_access_token,
      timeout: row.timeout || 30000,
      maxRetries: row.max_retries || 3
    };

    // Initialize adapter
    await mcpAdapter.initialize(adapterConfig);

    // Health check
    const startedAt = Date.now();
    const baseHealthy = await mcpAdapter.healthCheck();
    const elapsedMs = Date.now() - startedAt;

    let authCheck:
      | { ok: true; tool: string }
      | { ok: false; tool: string; error: string }
      | undefined;
    if (row.server_type === 'notion') {
      const toolName = 'API-get-self';
      try {
        const authResult = await mcpAdapter.callTool(toolName, {});
        const authError = extractToolErrorFromContent(authResult?.content);
        if (authError) {
          authCheck = {
            ok: false,
            tool: toolName,
            error: authError
          };
        } else {
          authCheck = { ok: true, tool: toolName };
        }
      } catch (error) {
        authCheck = {
          ok: false,
          tool: toolName,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    const isHealthy = baseHealthy && (authCheck?.ok ?? true);

    logger.info({
      adapterId: id,
      adapterName: row.name,
      serverType: row.server_type,
      transportType: adapterConfig.transportType,
      serverUrl: adapterConfig.serverUrl,
      baseHealthy,
      authCheck,
      isHealthy,
      elapsedMs
    }, 'MCP adapter health check');

    // Update health check status
    const updateStmt = db.database.prepare(`
      UPDATE mcp_adapter_configs
      SET last_health_check = ?,
          last_health_check_status = ?,
          updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(
      new Date().toISOString(),
      isHealthy ? 'healthy' : 'unhealthy',
      new Date().toISOString(),
      id
    );

    // Cleanup adapter resources (especially important for stdio)
    mcpAdapter.cleanup();

    const message = !baseHealthy
      ? 'MCP 服务器健康检查失败'
      : authCheck && !authCheck.ok
      ? authCheck.error || 'Notion API 鉴权失败'
      : 'MCP 服务器连接正常';

    res.json({
      success: true,
      data: {
        id,
        name: row.name,
        status: isHealthy ? 'healthy' : 'unhealthy',
        testedAt: new Date().toISOString(),
        message
      }
    });
  } catch (error) {
    logger.error('MCP adapter test failed:', error);

    // Cleanup adapter resources
    try {
      mcpAdapter.cleanup();
    } catch {}

    // Update health check status
    try {
      const db = getDatabase();
      const updateStmt = db.database.prepare(`
        UPDATE mcp_adapter_configs
        SET last_health_check = ?,
            last_health_check_status = ?,
            updated_at = ?
        WHERE id = ?
      `);

      updateStmt.run(
        new Date().toISOString(),
        'error',
        new Date().toISOString(),
        req.params.id
      );
    } catch {}

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    });
  }
});

export default router;
