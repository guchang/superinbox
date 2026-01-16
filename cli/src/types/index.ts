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
    compact: boolean;
    color: boolean;
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
  intent: string;
  entities: any;
  summary?: string;
  suggestedTitle?: string;
  status: string;
  priority: string;
  distributedTargets: string[];
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface CreateItemResponse {
  id: string;
  status: string;
  intent: string;
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
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  intent?: string;
  status?: string;
  source?: string;
  json?: boolean;
}
