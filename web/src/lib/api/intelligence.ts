import { apiClient } from './client'
import type { PromptTemplate, ApiResponse } from '@/types'

export const intelligenceApi = {
  // 获取所有 Prompt 模板
  async getPrompts(): Promise<ApiResponse<PromptTemplate[]>> {
    return apiClient.get<PromptTemplate[]>('/intelligence/prompts')
  },

  // 获取单个 Prompt 模板
  async getPrompt(id: string): Promise<ApiResponse<PromptTemplate>> {
    return apiClient.get<PromptTemplate>(`/intelligence/prompts/${id}`)
  },

  // 创建 Prompt 模板
  async createPrompt(data: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<PromptTemplate>> {
    return apiClient.post<PromptTemplate>('/intelligence/prompts', data)
  },

  // 更新 Prompt 模板
  async updatePrompt(id: string, data: Partial<PromptTemplate>): Promise<ApiResponse<PromptTemplate>> {
    return apiClient.put<PromptTemplate>(`/intelligence/prompts/${id}`, data)
  },

  // 删除 Prompt 模板
  async deletePrompt(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/intelligence/prompts/${id}`)
  },
}
