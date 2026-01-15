import { apiClient } from './client'
import type {
  Item,
  CreateItemRequest,
  FilterParams,
  PaginatedResponse,
  ApiResponse,
} from '@/types'

export const inboxApi = {
  // 获取条目列表
  async getItems(params?: FilterParams): Promise<ApiResponse<PaginatedResponse<Item>>> {
    return apiClient.get<PaginatedResponse<Item>>('/items', params)
  },

  // 获取单个条目
  async getItem(id: string): Promise<ApiResponse<Item>> {
    return apiClient.get<Item>(`/items/${id}`)
  },

  // 创建条目
  async createItem(data: CreateItemRequest): Promise<ApiResponse<Item>> {
    return apiClient.post<Item>('/items', data)
  },

  // 更新条目
  async updateItem(id: string, data: Partial<Item>): Promise<ApiResponse<Item>> {
    return apiClient.put<Item>(`/items/${id}`, data)
  },

  // 删除条目
  async deleteItem(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/items/${id}`)
  },

  // 重新处理条目
  async reprocessItem(id: string): Promise<ApiResponse<Item>> {
    return apiClient.post<Item>(`/items/${id}/reprocess`)
  },
}
