import { apiClient } from './client'
import type {
  ApiKey,
  Statistics,
  ApiResponse,
  UserSettings,
  LlmSettings,
  LlmConfigCreatePayload,
  LlmConfigUpdatePayload,
  LlmConfigTestPayload,
  LlmConfigTestResult,
} from '@/types'

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

  // 获取 LLM 配置列表
  async getLlmConfigs(): Promise<ApiResponse<LlmSettings>> {
    return apiClient.get<LlmSettings>('/settings/llm')
  },

  // 创建 LLM 配置
  async createLlmConfig(payload: LlmConfigCreatePayload): Promise<ApiResponse<LlmSettings>> {
    return apiClient.post<LlmSettings>('/settings/llm', payload)
  },

  // 更新指定 LLM 配置
  async updateLlmConfig(id: string, payload: LlmConfigUpdatePayload): Promise<ApiResponse<LlmSettings>> {
    return apiClient.put<LlmSettings>(`/settings/llm/${id}`, payload)
  },

  // 删除指定 LLM 配置
  async deleteLlmConfig(id: string): Promise<ApiResponse<LlmSettings>> {
    return apiClient.delete<LlmSettings>(`/settings/llm/${id}`)
  },

  // 测试指定 LLM 配置连接
  async testLlmConfig(id: string): Promise<ApiResponse<LlmConfigTestResult>> {
    return apiClient.post<LlmConfigTestResult>(`/settings/llm/${id}/test`)
  },

  // 测试草稿 LLM 配置连接（用于新增弹窗）
  async testLlmDraftConfig(payload: LlmConfigTestPayload): Promise<ApiResponse<LlmConfigTestResult>> {
    return apiClient.post<LlmConfigTestResult>('/settings/llm/test', payload)
  },

  // 调整 LLM 配置优先级顺序
  async reorderLlmConfigs(orderedIds: string[]): Promise<ApiResponse<LlmSettings>> {
    return apiClient.put<LlmSettings>('/settings/llm/reorder', { orderedIds })
  },
}
