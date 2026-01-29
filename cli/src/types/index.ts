/**
 * CLI Type Definitions
 */

export interface Config {
  api: {
    baseUrl: string;
    key: string;
    timeout: number;
  };
  auth?: {
    token?: string;
    refreshToken?: string;
    user?: User;
  };
  defaults: {
    source: string;
    type: string;
  };
  display: {
    language: 'en' | 'zh';
    compact: boolean;
    color: boolean;
    dateFormat: 'relative' | 'absolute';
    maxItems: number;
  };
  behavior: {
    autoWait: boolean;
    confirmDelete: boolean;
  };
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface Item {
  id: string;
  userId: string;
  originalContent: string;
  contentType: string;
  source: string;
  category: string;
  entities: any;
  summary?: string;
  suggestedTitle?: string;
  status: string;
  distributedTargets: string[];
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface CreateItemResponse {
  id: string;
  status: string;
  category: string;
  message: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface CliOptions {
  type?: string;
  source?: string;
  wait?: boolean;
  timeout?: number;
  file?: string;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  category?: string;
  status?: string;
  source?: string;
  json?: boolean;
}
