/**
 * API Client
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { config } from '../config/manager.js';
import type { ApiResponse, Item, CreateItemResponse, ListOptions, ListResult, LoginRequest, LoginResponse } from '../types/index.js';

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
    this.client.interceptors.request.use((requestConfig) => {
      requestConfig.baseURL = this.getApiBaseUrl();

      const cfg = this.getConfig();
      if (cfg.auth?.token) {
        requestConfig.headers['Authorization'] = `Bearer ${cfg.auth.token}`;
      }
      return requestConfig;
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
   * Ensure backend API base URL is configured and valid
   */
  private getApiBaseUrl(): string {
    const baseUrl = (this.getConfig().api.baseUrl || '').trim();

    if (!baseUrl) {
      throw new Error('Backend API URL is not configured. Run: sinbox config -> API Connection -> Set Backend API URL (/v1).');
    }

    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new Error('Backend API URL is invalid. It must be a full URL ending with /v1. Example: http://localhost:3001/v1');
    }

    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    if (!normalizedPath || !normalizedPath.endsWith('/v1')) {
      throw new Error('Backend API URL is invalid. It must end with /v1. Example: http://localhost:3001/v1');
    }

    parsed.pathname = normalizedPath;
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString().replace(/\/+$/, '');
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
   * Normalize inbox entry payload to CLI Item shape
   */
  private mapInboxEntryToItem(entry: any): Item {
    const now = new Date().toISOString();

    return {
      id: String(entry?.id ?? ''),
      userId: String(entry?.userId ?? ''),
      originalContent: String(entry?.content ?? entry?.originalContent ?? ''),
      contentType: String(entry?.contentType ?? 'text'),
      source: String(entry?.source ?? 'api'),
      category: String(entry?.category ?? 'unknown'),
      entities: entry?.entities ?? {},
      summary: typeof entry?.summary === 'string' ? entry.summary : undefined,
      suggestedTitle: typeof entry?.suggestedTitle === 'string' ? entry.suggestedTitle : undefined,
      status: String(entry?.status ?? 'pending'),
      distributedTargets: Array.isArray(entry?.distributedTargets)
        ? entry.distributedTargets
        : Array.isArray(entry?.routedTo)
          ? entry.routedTo
          : [],
      createdAt: String(entry?.createdAt ?? now),
      updatedAt: String(entry?.updatedAt ?? entry?.createdAt ?? now),
      processedAt: typeof entry?.processedAt === 'string' ? entry.processedAt : undefined
    };
  }

  /**
   * Normalize inbox detail payload to CLI Item shape
   */
  private mapInboxDetailToItem(detail: any): Item {
    const parsed = detail?.parsed ?? {};

    const normalized = this.mapInboxEntryToItem({
      ...detail,
      category: parsed?.category ?? detail?.category,
      entities: parsed?.entities ?? detail?.entities
    });

    if (!normalized.summary && typeof detail?.reasoning === 'string') {
      normalized.summary = detail.reasoning;
    }

    return normalized;
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
    const response = await this.client.get(`/inbox/${id}`);
    const payload = response.data as any;

    if (payload?.success && payload?.data) {
      return payload.data as Item;
    }

    if (payload?.id && (payload?.content !== undefined || payload?.originalContent !== undefined)) {
      return this.mapInboxDetailToItem(payload);
    }

    throw new Error(payload?.error?.message ?? 'Failed to get item');
  }

  /**
   * List items with pagination metadata
   */
  async listItemsResult(options: ListOptions = {}): Promise<ListResult> {
    const params = new URLSearchParams();

    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.category) params.append('category', options.category);
    if (options.status) params.append('status', options.status);
    if (options.source) params.append('source', options.source);

    const response = await this.client.get(`/inbox?${params}`);
    const payload = response.data as any;

    if (payload?.success && Array.isArray(payload?.data)) {
      const limit = options.limit ?? payload.data.length ?? 20;
      const offset = options.offset ?? 0;
      const safeLimit = Math.max(1, Number(limit) || 20);
      const total = Number(payload.total ?? payload.data.length ?? 0);
      const page = Math.max(1, Math.floor(offset / safeLimit) + 1);

      return {
        items: payload.data as Item[],
        total,
        page,
        limit: safeLimit,
        offset
      };
    }

    if (Array.isArray(payload?.entries)) {
      const items = payload.entries.map((entry: any) => this.mapInboxEntryToItem(entry));
      const limit = Number((payload.limit ?? options.limit ?? items.length) || 20);
      const safeLimit = Math.max(1, limit);
      const page = Math.max(1, Number(payload.page) || Math.floor((options.offset ?? 0) / safeLimit) + 1);
      const offset = options.offset ?? (page - 1) * safeLimit;
      const total = Number(payload.total ?? items.length);

      return {
        items,
        total,
        page,
        limit: safeLimit,
        offset
      };
    }

    throw new Error(payload?.error?.message ?? 'Failed to list items');
  }

  /**
   * List items (backward compatibility)
   */
  async listItems(options: ListOptions = {}): Promise<Item[]> {
    const result = await this.listItemsResult(options);
    return result.items;
  }

  /**
   * Delete item
   */
  async deleteItem(id: string): Promise<boolean> {
    const response = await this.client.delete(`/inbox/${id}`);
    const payload = response.data as any;

    if (payload?.success === true && payload?.data && typeof payload.data.deleted === 'boolean') {
      return payload.data.deleted;
    }

    if (payload?.success === true) {
      return true;
    }

    if (typeof payload?.deleted === 'boolean') {
      return payload.deleted;
    }

    throw new Error(payload?.error?.message ?? 'Failed to delete item');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    const apiBaseUrl = this.getApiBaseUrl();
    const parsed = new URL(apiBaseUrl);
    const apiPath = parsed.pathname.replace(/\/+$/, '');

    parsed.pathname = apiPath.replace(/\/v1$/, '') || '/';
    parsed.search = '';
    parsed.hash = '';

    const healthBaseUrl = parsed.toString().replace(/\/+$/, '');
    const response = await axios.get(`${healthBaseUrl}/health`, {
      timeout: this.getConfig().api.timeout
    });

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
