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
  createItem(data: CreateItemRequest): Promise<Item>;

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
