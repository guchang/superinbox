import { apiClient } from './client'
import type { ApiKey, Statistics, ApiResponse, UserSettings } from '@/types'

export const settingsApi = {
  // 获取统计信息
  async getStatistics(): Promise<ApiResponse<Statistics>> {
    return apiClient.get<Statistics>('/settings/statistics')
  },

  // 获取 API Keys
  async getApiKeys(): Promise<ApiResponse<ApiKey[]>> {
    return apiClient.get<ApiKey[]>('/settings/api-keys')
  },

  // 创建 API Key
  async createApiKey(name: string, scopes: string[]): Promise<ApiResponse<ApiKey>> {
    return apiClient.post<ApiKey>('/settings/api-keys', { name, scopes })
  },

  // 删除 API Key
  async deleteApiKey(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/settings/api-keys/${id}`)
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
}
