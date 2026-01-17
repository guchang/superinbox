// Access log types for the logs feature

import type { ApiResponse } from '.'

// Access log status
export type LogStatus = 'success' | 'error' | 'denied'

// HTTP method
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// Access log entity
export interface AccessLog {
  id: string
  timestamp: string
  method: HttpMethod
  endpoint: string
  fullUrl: string
  statusCode: number
  status: LogStatus
  duration: number // Response time in milliseconds
  ip: string
  userAgent: string
  apiKeyId?: string
  apiKeyName?: string
  requestHeaders?: Record<string, string>
  requestBody?: unknown
  responseSize: number
  error?: {
    code: string
    message: string
    details?: unknown
  }
  queryParams?: Record<string, string>
}

// Filter conditions
export interface LogFilters {
  timeRange: 'today' | 'week' | 'month' | 'custom'
  startDate?: string
  endDate?: string
  status?: LogStatus | 'all'
  searchQuery?: string
  methods?: HttpMethod[]
  ipAddress?: string
  apiKeyId?: string
  page: number
  pageSize: number
}

// Log list response
export interface LogsResponse {
  data: AccessLog[]
  total: number
  page: number
  limit: number
}

// Export format
export type ExportFormat = 'csv' | 'json' | 'xlsx'

// Export request
export interface ExportRequest {
  format: ExportFormat
  fields: string[]
  startDate: string
  endDate: string
  filters?: Partial<LogFilters>
}

// Export task status
export type ExportStatus = 'processing' | 'completed' | 'failed'

// Export task
export interface ExportTask {
  id: string
  format: ExportFormat
  status: ExportStatus
  fileName: string
  fileSize: number
  recordCount: number
  createdAt: string
  completedAt?: string
  expiresAt: string
  downloadUrl: string
  error?: string
}

// Export response
export interface ExportResponse {
  data: {
    exportId: string
    status: ExportStatus
    message?: string
  }
}
