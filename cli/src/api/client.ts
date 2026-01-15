/**
 * API Client
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { config } from '../config/manager.js';
import type { ApiResponse, Item, CreateItemResponse, ListOptions } from '../types/index.js';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.get().api.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.get().api.key}`,
        'Content-Type': 'application/json'
      },
      timeout: config.get().api.timeout
    });
  }

  /**
   * Create a new item
   */
  async createItem(
    content: string,
    options: { type?: string; source?: string } = {}
  ): Promise<CreateItemResponse> {
    const response = await this.client.post<ApiResponse<CreateItemResponse>>('/inbox', {
      content,
      type: options.type ?? config.get().defaults.type,
      source: options.source ?? config.get().defaults.source
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message ?? 'Failed to create item');
    }

    return response.data.data;
  }

  /**
   * Get item by ID
   */
  async getItem(id: string): Promise<Item> {
    const response = await this.client.get<ApiResponse<Item>>(`/items/${id}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message ?? 'Failed to get item');
    }

    return response.data.data;
  }

  /**
   * List items
   */
  async listItems(options: ListOptions = {}): Promise<Item[]> {
    const params = new URLSearchParams();

    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.intent) params.append('intent', options.intent);
    if (options.status) params.append('status', options.status);
    if (options.source) params.append('source', options.source);

    const response = await this.client.get<ApiResponse<Item[]>>(`/items?${params}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message ?? 'Failed to list items');
    }

    return response.data.data;
  }

  /**
   * Delete item
   */
  async deleteItem(id: string): Promise<boolean> {
    const response = await this.client.delete<ApiResponse<{ deleted: boolean }>>(`/items/${id}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message ?? 'Failed to delete item');
    }

    return response.data.data.deleted;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    const response = await axios.get(`${config.get().api.baseUrl.replace('/v1', '')}/health`);

    return {
      status: response.data.status,
      version: response.data.version
    };
  }

  /**
   * Handle API errors
   */
  handleError(error: AxiosError): never {
    if (error.response) {
      const data = error.response.data as any;
      throw new Error(data.error?.message ?? `API Error: ${error.response.status}`);
    }

    if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to SuperInbox server. Is it running?');
    }

    throw error;
  }
}

export const api = new ApiClient();
