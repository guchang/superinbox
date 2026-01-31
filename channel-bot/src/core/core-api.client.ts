/**
 * Core API Client
 *
 * HTTP client for communicating with SuperInbox Core REST API.
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
  ICoreApiClient,
  CreateItemRequest,
  Item,
  User,
} from './core-api.interface.js';
import { CoreApiError } from './core-api.interface.js';

export { CoreApiError };

/**
 * Configuration for Core API client
 */
export interface CoreApiClientConfig {
  /** Base URL of Core API (e.g., http://localhost:3001/v1) */
  baseURL: string;
  /** API key for authentication */
  apiKey: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Core API Client Implementation
 */
export class CoreApiClient implements ICoreApiClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: CoreApiClientConfig) {
    this.apiKey = config.apiKey;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      proxy: false,  // Disable proxy for localhost connections
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const { status, data } = error.response;

          throw new CoreApiError(
            (data as { message?: string })?.message || 'API request failed',
            status,
            data
          );
        }

        if (error.request) {
          throw new CoreApiError('No response from Core API', 0, {
            message: 'Network error - Core API may be down',
          });
        }

        throw new CoreApiError(error.message || 'Unknown error', 0);
      }
    );
  }

  async createItem(data: CreateItemRequest): Promise<Item> {
    const response = await this.client.post<{
      success: boolean;
      data: Item;
    }>('/inbox', {
      content: data.originalContent,
      source: data.source,
      type: data.contentType,  // Map contentType to type
    });

    // Handle wrapped response format
    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    // Fallback to direct data (for compatibility)
    return response.data as unknown as Item;
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      const response = await this.client.get<User>(`/users/${userId}`);
      return response.data;
    } catch (error) {
      if (error instanceof CoreApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Use absolute URL to bypass baseURL (/health is outside /v1 prefix)
      const baseUrl = this.client.defaults.baseURL?.replace('/v1', '') || 'http://localhost:3001';
      await axios.get(`${baseUrl}/health`, {
        timeout: 5000,
        proxy: false,  // Disable proxy for localhost
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get API key (for SSE authentication)
   * @returns API key
   */
  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Get item by ID
   * @param itemId - Item ID
   * @returns Item or null if not found
   */
  async getItem(itemId: string): Promise<Item | null> {
    try {
      const response = await this.client.get<Item>(`/items/${itemId}`);
      return response.data;
    } catch (error) {
      if (error instanceof CoreApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update item
   * @param itemId - Item ID
   * @param updates - Fields to update
   * @returns Updated item
   */
  async updateItem(itemId: string, updates: Partial<Item>): Promise<Item> {
    const response = await this.client.put<Item>(`/items/${itemId}`, updates);
    return response.data;
  }

  /**
   * Trigger distribution for an item
   * @param itemId - Item ID
   * @returns Distribution results
   */
  async distributeItem(itemId: string): Promise<unknown> {
    const response = await this.client.post(`/items/${itemId}/distribute`);
    return response.data;
  }
}

/**
 * Singleton instance factory
 */
let coreApiClientInstance: CoreApiClient | null = null;

export function getCoreApiClient(config: CoreApiClientConfig): CoreApiClient {
  if (!coreApiClientInstance) {
    coreApiClientInstance = new CoreApiClient(config);
  }

  return coreApiClientInstance;
}
