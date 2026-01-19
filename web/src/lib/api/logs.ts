/**
 * Logs API Client
 * Handles API calls for access logs and exports
 */

import { apiClient } from './client'
import type {
  AccessLog,
  LogFilters,
  LogsResponse,
  ExportRequest,
  ExportTask,
  ExportResponse,
  StatisticsQuery,
  StatisticsResponse,
} from '@/types/logs'

/**
 * Get global access logs (admin only)
 */
export async function getAccessLogs(filters: LogFilters): Promise<LogsResponse> {
  const params = new URLSearchParams()

  // Basic pagination
  params.append('page', String(filters.page))
  params.append('limit', String(filters.pageSize))

  // Time range
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)

  // Status filter
  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status)
  }

  // Search
  if (filters.searchQuery) {
    params.append('endpoint', filters.searchQuery)
  }

  // HTTP methods
  if (filters.methods && filters.methods.length > 0) {
    filters.methods.forEach(method => params.append('method', method))
  }

  // IP address
  if (filters.ipAddress) {
    params.append('ip', filters.ipAddress)
  }

  // API Key filter (global logs only)
  if (filters.apiKeyId) {
    params.append('apiKeyId', filters.apiKeyId)
  }

  return apiClient.get<LogsResponse>(`/auth/logs?${params.toString()}`)
}

/**
 * Get logs for a specific API key
 */
export async function getApiKeyLogs(
  keyId: string,
  filters: LogFilters
): Promise<LogsResponse> {
  const params = new URLSearchParams()

  params.append('page', String(filters.page))
  params.append('limit', String(filters.pageSize))

  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)

  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status)
  }

  if (filters.searchQuery) {
    params.append('endpoint', filters.searchQuery)
  }

  if (filters.methods && filters.methods.length > 0) {
    filters.methods.forEach(method => params.append('method', method))
  }

  return apiClient.get<LogsResponse>(`/auth/api-keys/${keyId}/logs?${params.toString()}`)
}

/**
 * Create export task (async export)
 */
export async function createExportTask(
  request: ExportRequest
): Promise<ExportResponse> {
  return apiClient.post<ExportResponse>('/auth/logs/export', request)
}

/**
 * Get export task status
 */
export async function getExportStatus(exportId: string): Promise<{ data: ExportTask }> {
  return apiClient.get<{ data: ExportTask }>(`/auth/logs/exports/${exportId}`)
}

/**
 * Download export file
 */
export async function downloadExportFile(exportId: string): Promise<Blob> {
  const TOKEN_KEY = 'superinbox_auth_token'
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

  const response = await fetch(`${API_URL}/auth/logs/exports/${exportId}/download`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to download export file')
  }

  return response.blob()
}

/**
 * Sync export (for small datasets)
 */
export async function exportLogsSync(filters: LogFilters, format: string): Promise<Blob> {
  const TOKEN_KEY = 'superinbox_auth_token'
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

  const params = new URLSearchParams()

  // Build query params (same as getAccessLogs)
  params.append('page', String(filters.page))
  params.append('limit', String(filters.pageSize))

  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)
  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status)
  }
  if (filters.searchQuery) {
    params.append('endpoint', filters.searchQuery)
  }

  const acceptHeader = format === 'csv'
    ? 'text/csv'
    : format === 'json'
    ? 'application/json'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  const response = await fetch(`${API_URL}/auth/logs/export?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': acceptHeader,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to export logs')
  }

  return response.blob()
}

/**
 * Get API usage statistics (admin only)
 */
export async function getStatistics(query: StatisticsQuery): Promise<StatisticsResponse> {
  const params = new URLSearchParams()
  params.append('timeRange', query.timeRange)

  if (query.startDate) params.append('startDate', query.startDate)
  if (query.endDate) params.append('endDate', query.endDate)

  const response = await apiClient.get<StatisticsResponse>(`/auth/logs/statistics?${params.toString()}`)
  if (response && typeof response === 'object') {
    if ('summary' in response) {
      return response as unknown as StatisticsResponse
    }
    if ('data' in response && response.data) {
      return response.data
    }
    if ('error' in response && response.error) {
      throw new Error(response.error)
    }
    if ('message' in response && response.message) {
      throw new Error(response.message)
    }
  }
  throw new Error('No data received from statistics API')
}
