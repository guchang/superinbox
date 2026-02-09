/**
 * Router Layer - Adapter Interface
 */

import { v4 as uuidv4 } from 'uuid';
import axios, { type AxiosInstance } from 'axios';
import type { IAdapter, Item, DistributionResult, AdapterType } from '../types/index.js';
import { logger } from '../middleware/logger.js';

/**
 * Base Adapter - Abstract base class for all adapters
 */
export abstract class BaseAdapter implements IAdapter {
  abstract readonly type: AdapterType;
  abstract readonly name: string;

  protected client?: AxiosInstance;
  protected config: Record<string, unknown> = {};
  protected initialized = false;

  /**
   * Initialize the adapter with configuration
   */
  async initialize(config: Record<string, unknown>): Promise<void> {
    this.config = config;

    // Create HTTP client if baseUrl is provided
    if (config.baseUrl && typeof config.baseUrl === 'string') {
      this.client = axios.create({
        baseURL: config.baseUrl as string,
        timeout: (config.timeout as number) ?? 30000,
        headers: (config.headers as Record<string, string>) ?? {}
      });
    }

    this.initialized = true;
    logger.info(`Adapter ${this.name} initialized`);
  }

  /**
   * Check if adapter is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Adapter ${this.name} not initialized`);
    }
  }

  /**
   * Validate configuration
   */
  abstract validate(config: Record<string, unknown>): boolean;

  /**
   * Distribute item to target
   */
  abstract distribute(item: Item): Promise<DistributionResult>;

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Basic health check - override in subclasses for specific implementation
      return this.initialized;
    } catch {
      return false;
    }
  }

  /**
   * Create a distribution result
   */
  protected createResult(
    targetId: string,
    status: 'success' | 'failed',
    externalData?: { externalId?: string; externalUrl?: string; error?: string }
  ): DistributionResult {
    return {
      id: uuidv4(),
      itemId: '', // Will be set by the router
      targetId,
      adapterType: this.type,
      status,
      externalId: externalData?.externalId,
      externalUrl: externalData?.externalUrl,
      error: externalData?.error,
      timestamp: new Date()
    };
  }
}

/**
 * Adapter Registry - Manages all available adapters
 */
export class AdapterRegistry {
  private adapters = new Map<AdapterType, IAdapter>();

  /**
   * Register an adapter
   */
  register(adapter: IAdapter): void {
    this.adapters.set(adapter.type, adapter);
    logger.info(`Registered adapter: ${adapter.name} (${adapter.type})`);
  }

  /**
   * Get an adapter by type
   */
  get(type: AdapterType): IAdapter | undefined {
    return this.adapters.get(type);
  }

  /**
   * Get all registered adapters
   */
  getAll(): IAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Check if an adapter type is registered
   */
  has(type: AdapterType): boolean {
    return this.adapters.has(type);
  }
}

// Global adapter registry
export const adapterRegistry = new AdapterRegistry();
