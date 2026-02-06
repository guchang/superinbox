import { apiClient } from './client'
import type {
  ApiResponse,
  Category,
  CategoryPrompt,
} from '@/types'

export type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>

export type CategoryPromptGenerateMode = 'low_cost' | 'high_precision' | 'custom'
export type CategoryPromptGenerateLanguage = string

export const categoriesApi = {
  async list(): Promise<ApiResponse<Category[]>> {
    return apiClient.get<Category[]>('/categories')
  },

  async create(data: CategoryInput): Promise<ApiResponse<Category>> {
    return apiClient.post<Category>('/categories', data)
  },

  async update(id: string, data: Partial<CategoryInput>): Promise<ApiResponse<Category>> {
    return apiClient.put<Category>(`/categories/${id}`, data)
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/categories/${id}`)
  },

  async getPrompt(): Promise<ApiResponse<CategoryPrompt>> {
    return apiClient.get<CategoryPrompt>('/categories/prompt')
  },

  async updatePrompt(prompt: string): Promise<ApiResponse<CategoryPrompt>> {
    return apiClient.put<CategoryPrompt>('/categories/prompt', { prompt })
  },

  async generatePrompt(params: {
    mode: CategoryPromptGenerateMode
    requirement?: string
    language?: CategoryPromptGenerateLanguage
  }): Promise<ApiResponse<{ prompt: string }>> {
    return apiClient.post<{ prompt: string }>('/categories/prompt/generate', params)
  },

  async resetPrompt(): Promise<ApiResponse<CategoryPrompt>> {
    return apiClient.post<CategoryPrompt>('/categories/prompt/reset', {})
  },

  async rollbackPrompt(): Promise<ApiResponse<CategoryPrompt>> {
    return apiClient.post<CategoryPrompt>('/categories/prompt/rollback', {})
  },
}
