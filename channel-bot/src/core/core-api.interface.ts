/**
 * Core API Client Interface
 *
 * Defines the interface for communicating with SuperInbox Core REST API.
 */

/**
 * Create item request
 */
export interface CreateItemRequest {
  originalContent: string;
  source: string;
  userId: string;
  contentType?: string;
  attachments?: AttachmentInput[];
}

/**
 * Attachment input
 */
export interface AttachmentInput {
  type: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

/**
 * Item response from Core API
 */
export interface Item {
  id: string;
  userId: string;
  originalContent: string;
  contentType: string;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  entities?: Record<string, unknown>;
}

/**
 * Items list response
 */
export interface ItemsListResponse {
  total: number;
  page: number;
  limit: number;
  entries: ItemEntry[];
}

/**
 * Item entry in list
 */
export interface ItemEntry {
  id: string;
  content: string;
  source: string;
  category: string;
  status: string;
  createdAt: string;
}

/**
 * User from Core API
 */
export interface User {
  id: string;
  email?: string;
  name?: string;
  createdAt: string;
}

/**
 * Core API client interface
 */
export interface ICoreApiClient {
  /**
   * Create a new item in SuperInbox
   * @param data - Item data
   * @returns Created item
   */
  createItem(data: CreateItemRequest, apiKey?: string): Promise<Item>;

  /**
   * Get user by ID
   * @param userId - User ID
   * @returns User or null if not found
   */
  getUser(userId: string): Promise<User | null>;

  /**
   * Health check
   * @returns true if Core API is accessible
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get items list
   * @param apiKey - API key for authentication
   * @param params - Query parameters
   * @returns Items list
   */
  getItems(apiKey: string, params?: {
    limit?: number;
    page?: number;
    status?: string;
    category?: string;
  }): Promise<ItemsListResponse>;

  /**
   * Create a new item with file upload from a URL
   */
  createItemWithFileFromUrl(params: {
    url: string;
    fileName?: string;
    mimeType?: string;
    content?: string;
    source?: string;
    maxBytes?: number;
  }, apiKey: string): Promise<Item>;

  /**
   * Create a new item with file upload from a Buffer
   */
  createItemWithFileBuffer(params: {
    buffer: Buffer;
    fileName?: string;
    mimeType?: string;
    content?: string;
    source?: string;
    maxBytes?: number;
  }, apiKey: string): Promise<Item>;
}

/**
 * API error response
 */
export interface ApiError {
  message: string;
  statusCode: number;
  details?: unknown;
}

/**
 * Custom error class for API errors
 */
export class CoreApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CoreApiError';
  }
}
