import { apiClient } from './client'
import type { ApiResponse, Category } from '@/types'

export type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>

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
}
