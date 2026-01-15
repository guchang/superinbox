/**
 * Router Service - Orchestrate distribution to multiple adapters
 */

import { v4 as uuidv4 } from 'uuid';
import type { Item, DistributionResult, DistributionConfig } from '../types/index.js';
import { adapterRegistry, type AdapterRegistry } from './adapter.interface.js';
import { getDatabase } from '../storage/database.js';
import { logger } from '../middleware/logger.js';

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
      const adapter = this.registry.get(config.adapterType);

      if (!adapter) {
        logger.warn(`Adapter ${config.adapterType} not found`);
        continue;
      }

      try {
        const result = await adapter.distribute(item);
        result.itemId = item.id;
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
   * Get distribution configurations for a user
   */
  private getDistributionConfigs(userId: string): DistributionConfig[] {
    // TODO: Implement fetching from database
    // For now, return empty array - configs should be loaded from DB
    return [];
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
