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

  // 重试AI处理
  async retryAIProcessing(id: string): Promise<ApiResponse<{ message: string; status: string }>> {
    return apiClient.post<{ message: string; status: string }>(`/inbox/${id}/retry`)
  },

  // 上传文件
  async uploadFile(formData: FormData): Promise<ApiResponse<Item>> {
    // Don't set Content-Type header for FormData - browser will set it with boundary
    const response = await apiClient.post<any>('/inbox/file', formData)

    // 适配后端数据格式
    if (response.success && response.data) {
      return {
        success: true,
        data: adaptBackendItem(response.data),
      }
    }

    return response
  },

  // 上传多个文件
  async uploadMultipleFiles(formData: FormData): Promise<ApiResponse<Item>> {
    // Don't set Content-Type header for FormData - browser will set it with boundary
    const response = await apiClient.post<any>('/inbox/files', formData)

    // 适配后端数据格式
    if (response.success && response.data) {
      return {
        success: true,
        data: adaptBackendItem(response.data),
      }
    }

    return response
  },

  // 下载文件（带认证）
  async downloadFile(itemId: string, fileName?: string): Promise<void> {
    // Remove /v1 suffix if present to avoid duplication
    let baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'
    if (baseURL.endsWith('/v1')) {
      baseURL = baseURL.slice(0, -3)
    }
    const url = `${baseURL}/v1/inbox/${itemId}/file/download`

    // Get the token from localStorage
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('superinbox_auth_token')
      : null

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      })

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`)
      }

      // Get the blob from response
      const blob = await response.blob()

      // Create a blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download error:', error)
      throw error
    }
  },
}
