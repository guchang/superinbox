import { apiClient } from './client'
import { getApiBaseUrl } from './base-url'
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
    const response = await apiClient.get<any>('/inbox', params)

    // 新的 /inbox API 直接返回数据，不包装在 { success, data } 中
    // 返回格式: { total, page, limit, entries: [...] }
    const data = response.success ? response.data : response
    
    if (data && data.entries) {
      const entries = data.entries || []
      const total = data.total || entries.length
      const page = data.page || params?.page || 1
      const limit = data.limit || params?.limit || 20
      
      // 将 entries 转换为前端期望的格式
      const items = entries.map((entry: any) => ({
        id: entry.id,
        userId: entry.userId,
        originalContent: entry.content,
        contentType: entry.contentType || 'text',
        source: entry.source,
        category: entry.category,
        entities: entry.entities || {},
        summary: entry.summary || null,
        suggestedTitle: entry.suggestedTitle || null,
        status: entry.status,
        distributedTargets: entry.distributedTargets || entry.routedTo || [],
        routingPreviewTargets: entry.routingPreviewTargets || [],
        distributionResults: entry.distributionResults || [],
        distributedRuleNames: entry.distributedRuleNames || [],
        routingStatus: entry.routingStatus || 'skipped',
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        createdAtLocal: entry.createdAtLocal || null,
        updatedAtLocal: entry.updatedAtLocal || null,
        processedAt: entry.processedAt,
      }))
      
      return {
        success: true,
        data: {
          items: adaptBackendItems(items),
          total,
          page,
          limit,
          hasMore: page * limit < total,
        },
      }
    }

    return {
      success: false,
      error: 'Invalid response format',
    }
  },

  // 获取单个条目
  async getItem(id: string): Promise<ApiResponse<Item>> {
    const response = await apiClient.get<any>(`/inbox/${id}`)

    // 新的 /inbox/:id API 直接返回数据，不包装在 { success, data } 中
    // 返回格式: { id, content, source, parsed, routingHistory, ... }
    const data = response.success ? response.data : response
    
    if (data && data.id) {
      // 将新格式转换为前端期望的格式
      const backendItem = {
        id: data.id,
        userId: data.userId,
        originalContent: data.content,
        contentType: data.contentType || 'text',
        source: data.source,
        category: data.parsed?.category || '',
        entities: data.parsed?.entities || {},
        summary: data.summary || null,
        suggestedTitle: data.suggestedTitle || null,
        status: data.status,
        distributedTargets: data.distributedTargets || [],
        routingPreviewTargets: data.routingPreviewTargets || [],
        distributionResults: data.routingHistory?.map((h: any) => ({
          targetId: h.adapter,
          status: h.status,
          timestamp: h.timestamp,
        })) || [],
        distributedRuleNames: data.distributedRuleNames || [],
        routingStatus: data.routingStatus || 'skipped',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdAtLocal: data.createdAtLocal || null,
        updatedAtLocal: data.updatedAtLocal || null,
        processedAt: data.processedAt,
      }
      
      return {
        success: true,
        data: adaptBackendItem(backendItem),
      }
    }

    return {
      success: false,
      error: 'Invalid response format',
    }
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
    const response = await apiClient.put<any>(`/inbox/${id}`, data)

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
    return apiClient.delete<void>(`/inbox/${id}`)
  },

  // 重试AI处理
  async retryAIProcessing(id: string): Promise<ApiResponse<{ message: string; status: string }>> {
    return apiClient.post<{ message: string; status: string }>(`/inbox/${id}/retry`)
  },

  // 重新分类
  async reclassifyItem(id: string): Promise<ApiResponse<{ message: string; status: string }>> {
    return apiClient.post<{ message: string; status: string }>(`/inbox/${id}/reclassify`)
  },

  // 重新分发
  async distributeItem(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>(`/inbox/${id}/distribute`)
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
    const baseURL = getApiBaseUrl()
    const url = `${baseURL}/inbox/${itemId}/file/download`

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

  // 获取可用的 source 列表
  async getSources(): Promise<ApiResponse<string[]>> {
    const response = await apiClient.get<string[]>('/inbox/sources')
    return response
  },
}
