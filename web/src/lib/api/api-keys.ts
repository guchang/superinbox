/**
 * API Keys API Client
 */

import type {
  ApiKey,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ToggleApiKeyRequest,
  ApiKeyResponse,
  ApiKeysListResponse,
  ApiAccessLogsResponse,
} from '@/types/api-key'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

/**
 * Get authorization token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('superinbox_auth_token')
}

/**
 * Create headers with authentication
 */
function getHeaders(): HeadersInit {
  const token = getAuthToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * List all API keys for the current user
 */
export async function listApiKeys(): Promise<ApiKey[]> {
  const response = await fetch(`${API_BASE_URL}/api-keys`, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to list API keys: ${response.statusText}`)
  }

  const data: ApiKeysListResponse = await response.json()
  return data.data
}

/**
 * Create a new API key
 */
export async function createApiKey(request: CreateApiKeyRequest): Promise<ApiKey> {
  const response = await fetch(`${API_BASE_URL}/api-keys`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `Failed to create API key: ${response.statusText}`)
  }

  const data: ApiKeyResponse = await response.json()
  return data.data
}

/**
 * Get a single API key by ID
 */
export async function getApiKey(id: string): Promise<ApiKey> {
  const response = await fetch(`${API_BASE_URL}/api-keys/${id}`, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to get API key: ${response.statusText}`)
  }

  const data: ApiKeyResponse = await response.json()
  return data.data
}

/**
 * Update an API key
 */
export async function updateApiKey(id: string, request: UpdateApiKeyRequest): Promise<ApiKey> {
  const response = await fetch(`${API_BASE_URL}/api-keys/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `Failed to update API key: ${response.statusText}`)
  }

  const data: ApiKeyResponse = await response.json()
  return data.data
}

/**
 * Toggle API key status (enable/disable)
 */
export async function toggleApiKey(id: string, isActive: boolean): Promise<ApiKey> {
  const response = await fetch(`${API_BASE_URL}/api-keys/${id}/toggle`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ isActive }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `Failed to toggle API key: ${response.statusText}`)
  }

  const data: ApiKeyResponse = await response.json()
  return data.data
}

/**
 * Regenerate an API key (creates new key value)
 */
export async function regenerateApiKey(id: string): Promise<ApiKey> {
  const response = await fetch(`${API_BASE_URL}/api-keys/${id}/regenerate`, {
    method: 'POST',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `Failed to regenerate API key: ${response.statusText}`)
  }

  const data: ApiKeyResponse = await response.json()
  return data.data
}

/**
 * Delete an API key
 */
export async function deleteApiKey(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api-keys/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `Failed to delete API key: ${response.statusText}`)
  }
}

/**
 * Get access logs for an API key
 */
export async function getApiKeyLogs(
  id: string,
  options?: { limit?: number; offset?: number }
): Promise<{ logs: any[]; limit: number; offset: number }> {
  const params = new URLSearchParams()
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())

  const url = `${API_BASE_URL}/api-keys/${id}/logs${params.toString() ? `?${params.toString()}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to get API key logs: ${response.statusText}`)
  }

  const data: ApiAccessLogsResponse = await response.json()
  return data.data
}
