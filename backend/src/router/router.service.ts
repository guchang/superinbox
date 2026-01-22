/**
 * Router Service - Orchestrate distribution to multiple adapters
 */

import { v4 as uuidv4 } from 'uuid';
import type { Item, DistributionResult, DistributionConfig, MCPAdapterConfig, AdapterType } from '../types/index.js';
import { adapterRegistry, type AdapterRegistry } from './adapter.interface.js';
import { getDatabase } from '../storage/database.js';
import { logger } from '../middleware/logger.js';
import { mcpAdapter } from './adapters/mcp-adapter.js';

export class RouterService {
  private registry: AdapterRegistry;
  private db = getDatabase();

  constructor(registry?: AdapterRegistry) {
    this.registry = registry ?? adapterRegistry;
  }

  /**
   * Distribute item to all configured targets
   */
  async distributeItem(item: Item): Promise<DistributionResult[]> {
    const results: DistributionResult[] = [];

    // Get distribution configs for user
    const configs = this.getDistributionConfigs(item.userId);

    // Filter enabled configs and check conditions
    const applicableConfigs = configs.filter(config => {
      if (!config.enabled) return false;
      return this.checkConditions(item, config);
    });

    // Sort by priority
    applicableConfigs.sort((a, b) => b.priority - a.priority);

    logger.info(`Distributing item ${item.id} to ${applicableConfigs.length} targets`);

    // Distribute to each target
    for (const config of applicableConfigs) {
      try {
        let result: DistributionResult;

        // Handle MCP adapters specially
        if (config.adapterType === 'mcp_http' && config.mcpAdapterId) {
          result = await this.distributeViaMCP(item, config);
        } else {
          // Traditional adapter
          const adapter = this.registry.get(config.adapterType);

          if (!adapter) {
            logger.warn(`Adapter ${config.adapterType} not found`);
            continue;
          }

          const adapterResult = await adapter.distribute(item);
          result = {
            ...adapterResult,
            itemId: item.id
          };
        }

        results.push(result);

        // Save to database
        this.db.addDistributionResult(result);

        logger.info(`Distribution to ${config.adapterType} completed: ${result.status}`);
      } catch (error) {
        logger.error(`Distribution to ${config.adapterType} failed:`, error);
        const failedResult: DistributionResult = {
          id: uuidv4(),
          itemId: item.id,
          targetId: config.id,
          adapterType: config.adapterType,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        };
        results.push(failedResult);
        this.db.addDistributionResult(failedResult);
      }
    }

    return results;
  }

  /**
   * Distribute item via MCP adapter
   */
  private async distributeViaMCP(
    item: Item,
    config: DistributionConfig & { mcpAdapterId: string }
  ): Promise<DistributionResult> {
    // Load MCP adapter config from database
    const mcpConfig = this.getMCPAdapterConfig(config.mcpAdapterId);

    // Initialize MCP adapter with the MCP config
    await mcpAdapter.initialize({
      serverUrl: mcpConfig.serverUrl,
      serverType: mcpConfig.serverType,
      authType: mcpConfig.authType,
      apiKey: mcpConfig.apiKey,
      oauthAccessToken: mcpConfig.oauthAccessToken
    });

    // Set distribution config for context
    mcpAdapter.setDistributionConfig(config);

    // Distribute
    const result = await mcpAdapter.distribute(item);
    result.itemId = item.id;
    result.targetId = config.id;

    return result;
  }

  /**
   * Get distribution configurations for a user
   */
  private getDistributionConfigs(userId: string): DistributionConfig[] {
    try {
      const stmt = this.db.database.prepare(`
        SELECT * FROM distribution_configs
        WHERE user_id = ?
        ORDER BY priority DESC, created_at ASC
      `);

      const rows = stmt.all(userId) as any[];

      return rows.map(row => ({
        id: row.id,
        adapterType: row.adapter_type,
        enabled: Boolean(row.enabled),
        priority: row.priority,
        conditions: row.conditions ? JSON.parse(row.conditions) : undefined,
        config: row.config ? JSON.parse(row.config) : {},
        mcpAdapterId: row.mcp_adapter_id,
        processingInstructions: row.processing_instructions
      }));
    } catch (error) {
      logger.error('Failed to load distribution configs:', error);
      return [];
    }
  }

  /**
   * Get MCP adapter config by ID
   */
  private getMCPAdapterConfig(mcpAdapterId: string): MCPAdapterConfig {
    const stmt = this.db.database.prepare(`
      SELECT * FROM mcp_adapter_configs
      WHERE id = ?
    `);

    const row = stmt.get(mcpAdapterId) as any;

    if (!row) {
      throw new Error(`MCP adapter config not found: ${mcpAdapterId}`);
    }

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      serverUrl: row.server_url,
      serverType: row.server_type,
      transportType: row.transport_type || 'http',
      command: row.command,
      env: row.env ? JSON.parse(row.env) : undefined,
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
  }

  /**
   * Check if item matches distribution conditions
   */
  private checkConditions(item: Item, config: DistributionConfig): boolean {
    if (!config.conditions || config.conditions.length === 0) {
      return true; // No conditions = always applicable
    }

    return config.conditions.every(condition => {
      const value = this.getItemValue(item, condition.field);

      switch (condition.operator) {
        case 'equals':
          return value === condition.value;

        case 'contains':
          return typeof value === 'string' &&
            typeof condition.value === 'string' &&
            value.includes(condition.value);

        case 'startsWith':
          return typeof value === 'string' &&
            typeof condition.value === 'string' &&
            value.startsWith(condition.value);

        case 'endsWith':
          return typeof value === 'string' &&
            typeof condition.value === 'string' &&
            value.endsWith(condition.value);

        case 'regex':
          return typeof value === 'string' &&
            condition.value instanceof RegExp &&
            condition.value.test(value);

        default:
          return false;
      }
    });
  }

  /**
   * Get item value by field path (supports dot notation)
   */
  private getItemValue(item: Item, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = item;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Register adapter
   */
  registerAdapter(adapter: AdapterRegistry): void {
    this.registry = adapter;
  }

  /**
   * Test connection to an adapter
   */
  async testAdapter(adapterType: string, config: Record<string, unknown>): Promise<boolean> {
    const adapter = this.registry.get(adapterType as any);

    if (!adapter) {
      throw new Error(`Adapter ${adapterType} not found`);
    }

    // Initialize with test config
    await adapter.initialize(config);

    // Run health check
    return adapter.healthCheck();
  }
}

// Singleton instance
let routerServiceInstance: RouterService | null = null;

export const getRouterService = (): RouterService => {
  if (!routerServiceInstance) {
    routerServiceInstance = new RouterService();
  }
  return routerServiceInstance;
};
