import { apiClient } from './client'
import type { ApiKey, Statistics, ApiResponse, UserSettings, LlmSettings, LlmSettingsUpdate } from '@/types'

export const settingsApi = {
  // 获取统计信息
  async getStatistics(): Promise<ApiResponse<Statistics>> {
    return apiClient.get<Statistics>('/settings/statistics')
  },

  // 获取 API Keys
  async getApiKeys(): Promise<ApiResponse<ApiKey[]>> {
    return apiClient.get<ApiKey[]>('/auth/api-keys')
  },

  // 创建 API Key
  async createApiKey(name: string, scopes: string[]): Promise<ApiResponse<ApiKey>> {
    return apiClient.post<ApiKey>('/auth/api-keys', { name, scopes })
  },

  // 删除 API Key
  async deleteApiKey(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/auth/api-keys/${id}`)
  },

  // 获取访问日志
  async getLogs(params?: { limit?: number; offset?: number }): Promise<ApiResponse<any>> {
    return apiClient.get<any>('/settings/logs', params)
  },

  // 获取用户时区设置
  async getTimezone(): Promise<ApiResponse<UserSettings>> {
    return apiClient.get<UserSettings>('/settings/timezone')
  },

  // 更新用户时区设置
  async updateTimezone(timezone: string): Promise<ApiResponse<UserSettings>> {
    return apiClient.put<UserSettings>('/settings/timezone', { timezone })
  },

  // 获取 LLM 配置
  async getLlmConfig(): Promise<ApiResponse<LlmSettings>> {
    return apiClient.get<LlmSettings>('/settings/llm')
  },

  // 更新 LLM 配置
  async updateLlmConfig(payload: LlmSettingsUpdate): Promise<ApiResponse<LlmSettings>> {
    return apiClient.put<LlmSettings>('/settings/llm', payload)
  },
}
