/**
 * Router Service - Orchestrate distribution to multiple adapters
 */

import { v4 as uuidv4 } from 'uuid';
import type { Item, DistributionResult, DistributionConfig, MCPAdapterConfig, AdapterType } from '../types/index.js';
import { adapterRegistry, type AdapterRegistry } from './adapter.interface.js';
import { getDatabase } from '../storage/database.js';
import { logger } from '../middleware/logger.js';
import { mcpAdapter } from './adapters/mcp-adapter.js';
import { RateLimiter } from '../utils/rate-limiter.js';

export class RouterService {
  private registry: AdapterRegistry;
  private db = getDatabase();
  private rateLimiter: RateLimiter;

  constructor(registry?: AdapterRegistry) {
    this.registry = registry ?? adapterRegistry;
    // Initialize rate limiter: 60 RPM, burst of 10
    this.rateLimiter = new RateLimiter(60, 10);
  }

  /**
   * Distribute item to all configured targets
   */
  async distributeItem(item: Item): Promise<DistributionResult[]> {
    const results: DistributionResult[] = [];

    // Execute routing rules first
    const ruleResults = await this.executeRoutingRules(item);
    results.push(...ruleResults);

    // Check if any rule requested to skip distribution
    const skipDistribution = ruleResults.some(
      r => r.message === 'Distribution skipped by rule'
    );

    if (skipDistribution) {
      logger.info(`Distribution skipped for item ${item.id} by routing rule`);
      return results;
    }

    // Wait for rate limiter slot
    await this.rateLimiter.waitForSlot();

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
   * Execute routing rules for an item
   * Returns results from all matched rules
   */
  private async executeRoutingRules(item: Item): Promise<DistributionResult[]> {
    const results: DistributionResult[] = [];

    try {
      // Get active rules for user
      const rules = this.db.database.prepare(`
        SELECT * FROM routing_rules
        WHERE user_id = ? AND is_active = 1
        ORDER BY priority DESC, created_at ASC
      `).all(item.userId) as any[];

      logger.info(`Found ${rules.length} active routing rules for user ${item.userId}`);

      // Execute each matching rule
      for (const rule of rules) {
        if (this.checkRuleConditions(item, rule)) {
          logger.info(`Rule "${rule.name}" matched for item ${item.id}`);
          const ruleResults = await this.executeRuleActions(item, rule);
          results.push(...ruleResults);
        }
      }
    } catch (error) {
      logger.error('Failed to execute routing rules:', error);
    }

    return results;
  }

  /**
   * Check if item matches rule conditions
   */
  private checkRuleConditions(item: Item, rule: any): boolean {
    if (!rule.conditions) {
      return true; // No conditions = always match
    }

    try {
      const conditions = JSON.parse(rule.conditions);
      return conditions.every((condition: any) => {
        const value = this.getItemValue(item, condition.field);

        switch (condition.operator) {
          case 'equals':
            return value === condition.value;
          case 'not_equals':
            return value !== condition.value;
          case 'contains':
            return typeof value === 'string' &&
              typeof condition.value === 'string' &&
              value.includes(condition.value);
          case 'not_contains':
            return typeof value === 'string' &&
              typeof condition.value === 'string' &&
              !value.includes(condition.value);
          case 'starts_with':
            return typeof value === 'string' &&
              typeof condition.value === 'string' &&
              value.startsWith(condition.value);
          case 'ends_with':
            return typeof value === 'string' &&
              typeof condition.value === 'string' &&
              value.endsWith(condition.value);
          case 'regex':
            return typeof value === 'string' &&
              typeof condition.value === 'string' &&
              new RegExp(condition.value).test(value);
          case 'in':
            return Array.isArray(condition.value) &&
              condition.value.includes(value);
          case 'not_in':
            return Array.isArray(condition.value) &&
              !condition.value.includes(value);
          default:
            logger.warn(`Unknown condition operator: ${condition.operator}`);
            return false;
        }
      });
    } catch (error) {
      logger.error(`Failed to parse conditions for rule ${rule.id}:`, error);
      return false;
    }
  }

  /**
   * Execute actions from a matched rule
   */
  private async executeRuleActions(item: Item, rule: any): Promise<DistributionResult[]> {
    const results: DistributionResult[] = [];

    try {
      const actions = JSON.parse(rule.actions);

      for (const action of actions) {
        try {
          const result = await this.executeAction(item, action, rule.id);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          logger.error(`Action ${action.type} failed for rule ${rule.id}:`, error);
          // Continue with next action even if one fails
          results.push({
            id: this.generateId(),
            itemId: item.id,
            targetId: rule.id,
            adapterType: 'rule', // Routing rule result
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            message: `Action ${action.type} failed`
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to parse actions for rule ${rule.id}:`, error);
    }

    return results;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    item: Item,
    action: any,
    ruleId: string
  ): Promise<DistributionResult | null> {
    switch (action.type) {
      case 'distribute_mcp':
        // Distribute to MCP adapter
        return await this.distributeToMCPAdapter(item, action);

      case 'distribute_adapter':
        // Distribute to traditional adapter
        return await this.distributeToTraditionalAdapter(item, action);

      case 'update_item':
        // Update item properties
        this.db.updateItem(item.id, action.updates || {});
        return {
          id: this.generateId(),
          itemId: item.id,
          targetId: ruleId,
          adapterType: 'rule',
          status: 'success',
          timestamp: new Date(),
          message: `Updated item: ${JSON.stringify(action.updates)}`
        };

      case 'skip_distribution':
        // Skip further distribution
        return {
          id: this.generateId(),
          itemId: item.id,
          targetId: ruleId,
          adapterType: 'rule',
          status: 'success',
          timestamp: new Date(),
          message: 'Distribution skipped by rule'
        };

      default:
        logger.warn(`Unknown action type: ${action.type}`);
        return null;
    }
  }

  /**
   * Distribute to MCP adapter (from rule action)
   */
  private async distributeToMCPAdapter(
    item: Item,
    action: any
  ): Promise<DistributionResult> {
    const mcpAdapterId = action.mcp_adapter_id;
    if (!mcpAdapterId) {
      throw new Error('mcp_adapter_id is required for distribute_mcp action');
    }

    // Get MCP adapter config
    const mcpConfig = this.getMCPAdapterConfig(mcpAdapterId);

    // Build distribution config
    const config: DistributionConfig = {
      id: this.generateId(),
      adapterType: 'mcp_http',
      enabled: true,
      priority: 0,
      mcpAdapterId,
      processingInstructions: action.processing_instructions,
      config: action.config || {}
    };

    // Distribute via MCP
    await mcpAdapter.initialize({
      serverUrl: mcpConfig.serverUrl,
      serverType: mcpConfig.serverType,
      authType: mcpConfig.authType,
      apiKey: mcpConfig.apiKey,
      oauthAccessToken: mcpConfig.oauthAccessToken
    });

    mcpAdapter.setDistributionConfig(config);

    const result = await mcpAdapter.distribute(item);
    result.itemId = item.id;
    result.targetId = mcpAdapterId;

    // Save result
    this.db.addDistributionResult(result);

    return result;
  }

  /**
   * Distribute to traditional adapter (from rule action)
   */
  private async distributeToTraditionalAdapter(
    item: Item,
    action: any
  ): Promise<DistributionResult> {
    const adapterType = action.adapter_type;
    if (!adapterType) {
      throw new Error('adapter_type is required for distribute_adapter action');
    }

    const adapter = this.registry.get(adapterType);
    if (!adapter) {
      throw new Error(`Adapter ${adapterType} not found`);
    }

    const result = await adapter.distribute(item);
    result.itemId = item.id;
    result.targetId = adapterType;

    // Save result
    this.db.addDistributionResult(result);

    return result;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
