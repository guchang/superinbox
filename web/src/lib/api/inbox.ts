import { apiClient } from './client'
import { adaptBackendItem, adaptBackendItems } from './adapter'
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
    const response = await apiClient.get<any>('/items', params)

    // 适配后端数据格式
    if (response.success && response.data) {
      const items = Array.isArray(response.data) ? response.data : []
      return {
        success: true,
        data: {
          items: adaptBackendItems(items),
          total: items.length,
          page: params?.page || 1,
          limit: params?.limit || 20,
          hasMore: false,
        },
      }
    }

    return response
  },

  // 获取单个条目
  async getItem(id: string): Promise<ApiResponse<Item>> {
    const response = await apiClient.get<any>(`/items/${id}`)

    // 适配后端数据格式
    if (response.success && response.data) {
      return {
        success: true,
        data: adaptBackendItem(response.data),
      }
    }

    return response
  },

  // 创建条目
  async createItem(data: CreateItemRequest): Promise<ApiResponse<Item>> {
    const response = await apiClient.post<any>('/inbox', {
      content: data.content,
      type: data.contentType,
      source: data.source,
    })

    // 适配后端数据格式
    if (response.success && response.data) {
      return {
        success: true,
        data: adaptBackendItem(response.data),
      }
    }

    return response
  },

  // 更新条目
  async updateItem(id: string, data: Partial<Item>): Promise<ApiResponse<Item>> {
    const response = await apiClient.put<any>(`/items/${id}`, data)

    // 适配后端数据格式
    if (response.success && response.data) {
      return {
        success: true,
        data: adaptBackendItem(response.data),
      }
    }

    return response
  },

  // 删除条目
  async deleteItem(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/items/${id}`)
  },

  // 重新处理条目
  async reprocessItem(id: string): Promise<ApiResponse<Item>> {
    const response = await apiClient.post<any>(`/items/${id}/reprocess`)

    // 适配后端数据格式
    if (response.success && response.data) {
      return {
        success: true,
        data: adaptBackendItem(response.data),
      }
    }

    return response
  },
}
