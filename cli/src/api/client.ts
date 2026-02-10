/**
 * API Client
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { config } from '../config/manager.js';
import type { ApiResponse, Item, CreateItemResponse, ListOptions, LoginRequest, LoginResponse } from '../types/index.js';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.get().api.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: config.get().api.timeout
    });

    // Add request interceptor to add auth header dynamically
    this.client.interceptors.request.use((config) => {
      const cfg = this.getConfig();
      if (cfg.auth?.token) {
        config.headers['Authorization'] = `Bearer ${cfg.auth.token}`;
      }
      return config;
    });

    // Add response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const requestUrl = originalRequest?.url || '';
        const skipRefresh = this.shouldSkipAutoRefresh(requestUrl);
        
        // If we get a 401 and haven't already tried to refresh
        if (error.response?.status === 401 && !skipRefresh && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          
          const cfg = this.getConfig();
          if (cfg.auth?.refreshToken) {
            try {
              await this.refreshToken();
              // Retry the original request with new token
              const newCfg = this.getConfig();
              if (newCfg.auth?.token) {
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers['Authorization'] = `Bearer ${newCfg.auth.token}`;
                return this.client(originalRequest);
              }
            } catch (refreshError) {
              // Refresh failed, clear auth data
              this.clearAuthCache();
              throw new Error('Session expired. Please login again with: sinbox login');
            }
          } else {
            throw new Error('Authentication required. Please login with: sinbox login');
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get config
   */
  private getConfig() {
    return config.get();
  }

  /**
   * Skip auto refresh for auth endpoints
   */
  private shouldSkipAutoRefresh(url?: string): boolean {
    if (!url) return false;
    return ['/auth/login', '/auth/register', '/auth/refresh'].some((path) => url.includes(path));
  }

  /**
   * Clear local auth cache
   */
  private clearAuthCache(): void {
    config.delete('auth.token');
    config.delete('auth.refreshToken');
    config.delete('auth.user');
  }

  /**
   * Decode JWT exp (seconds)
   */
  private decodeJwtExp(token: string): number | null {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: number };
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(token: string, skewSeconds = 30): boolean {
    const exp = this.decodeJwtExp(token);
    if (!exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return exp <= now + skewSeconds;
  }

  /**
   * Ensure current auth session is usable
   */
  async ensureSession(): Promise<{ loggedIn: boolean; refreshed: boolean }> {
    const cfg = this.getConfig();
    const accessToken = cfg.auth?.token;

    if (accessToken && !this.isTokenExpired(accessToken) && cfg.auth?.user) {
      return { loggedIn: true, refreshed: false };
    }

    const refreshToken = cfg.auth?.refreshToken;
    if (!refreshToken) {
      this.clearAuthCache();
      return { loggedIn: false, refreshed: false };
    }

    try {
      await this.refreshToken();
      return { loggedIn: true, refreshed: true };
    } catch {
      this.clearAuthCache();
      return { loggedIn: false, refreshed: false };
    }
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
      type: options.type ?? 'text',
      source: options.source ?? config.get().defaults.source
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message ?? 'Failed to create item');
    }

    return response.data.data;
  }

  /**
   * Upload file and create item
   */
  async uploadFile(
    filePath: string,
    options: { content?: string; source?: string } = {}
  ): Promise<CreateItemResponse> {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    if (options.content) {
      formData.append('content', options.content);
    }
    if (options.source) {
      formData.append('source', options.source);
    }

    // Make request with different headers for multipart
    const response = await this.client.post<ApiResponse<CreateItemResponse>>('/inbox/file', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message ?? 'Failed to upload file');
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
    if (options.category) params.append('category', options.category);
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
   * Refresh access token
   */
  private async refreshToken(): Promise<LoginResponse> {
    const cfg = config.get();
    if (!cfg.auth?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.client.post<ApiResponse<LoginResponse>>('/auth/refresh', {
      refreshToken: cfg.auth.refreshToken
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message ?? 'Token refresh failed');
    }

    const { user, token, refreshToken } = response.data.data;

    // Save to config
    config.set('auth.token', token);
    config.set('auth.refreshToken', refreshToken);
    config.set('auth.user', user);

    return response.data.data;
  }

  /**
   * Login
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<ApiResponse<LoginResponse>>('/auth/login', credentials);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message ?? 'Login failed');
    }

    const { user, token, refreshToken } = response.data.data;

    // Save to config
    config.set('auth.token', token);
    config.set('auth.refreshToken', refreshToken);
    config.set('auth.user', user);

    return response.data.data;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearAuthCache();
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<LoginResponse['user']> {
    const response = await this.client.get<ApiResponse<LoginResponse['user']>>('/auth/me');

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message ?? 'Failed to get user info');
    }

    return response.data.data;
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    const cfg = config.get();
    return !!(cfg.auth?.token && cfg.auth?.user);
  }

  /**
   * Check if local auth cache exists
   */
  hasAuthCache(): boolean {
    const cfg = config.get();
    return !!(cfg.auth?.token || cfg.auth?.refreshToken || cfg.auth?.user);
  }

  /**
   * Get current user from config
   */
  getCurrentUserFromCache(): LoginResponse['user'] | undefined {
    const cfg = config.get();
    return cfg.auth?.user;
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
