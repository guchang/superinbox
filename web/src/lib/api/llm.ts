import { apiClient } from './client'
import type {
  LlmStatistics,
  LlmStatisticsParams,
  LlmUsageLog,
  LlmLogsParams,
  LlmSession,
  LlmSessionsParams,
} from '@/types'

/**
 * Get LLM usage statistics
 */
export async function getLlmStatistics(
  params?: LlmStatisticsParams
): Promise<LlmStatistics> {
  const response = await apiClient.get<LlmStatistics>('/ai/usage/statistics', params)
  return response.data!
}

/**
 * Get LLM usage logs
 */
export async function getLlmLogs(
  params?: LlmLogsParams
): Promise<{ data: LlmUsageLog[]; total: number; page: number; pageSize: number }> {
  const response = await apiClient.get<{
    data: LlmUsageLog[]
    total: number
    page: number
    pageSize: number
  }>('/ai/usage/logs', params)
  return response.data!
}

/**
 * Get LLM usage grouped by session
 */
export async function getLlmSessions(
  params?: LlmSessionsParams
): Promise<{ data: LlmSession[]; total: number; page: number; pageSize: number }> {
  const response = await apiClient.get<{
    data: LlmSession[]
    total: number
    page: number
    pageSize: number
  }>('/ai/usage/sessions', params)
  return response.data!
}
