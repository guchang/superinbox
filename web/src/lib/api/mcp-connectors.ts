/**
 * MCP 连接器 API 客户端
 * 与后端 /v1/mcp-adapters 端点集成
 */

import { apiClient } from './client'
import type {
  MCPConnectorConfig,
  MCPConnectorListItem,
  CreateMCPConnectorRequest,
  MCPConnectorTestResponse,
  ApiResponse,
} from '@/types'

export const mcpConnectorsApi = {
  /**
   * 获取连接器列表
   * GET /v1/mcp-adapters
   */
  list: async (): Promise<ApiResponse<MCPConnectorListItem[]>> => {
    return apiClient.get<MCPConnectorListItem[]>('/mcp-adapters')
  },

  /**
   * 获取单个连接器详情
   * GET /v1/mcp-adapters/:id
   */
  get: async (id: string): Promise<ApiResponse<MCPConnectorConfig>> => {
    return apiClient.get<MCPConnectorConfig>(`/mcp-adapters/${id}`)
  },

  /**
   * 创建连接器
   * POST /v1/mcp-adapters
   */
  create: async (data: CreateMCPConnectorRequest): Promise<ApiResponse<MCPConnectorConfig>> => {
    return apiClient.post<MCPConnectorConfig>('/mcp-adapters', data)
  },

  /**
   * 更新连接器
   * PUT /v1/mcp-adapters/:id
   */
  update: async (
    id: string,
    data: Partial<CreateMCPConnectorRequest>
  ): Promise<ApiResponse<MCPConnectorConfig>> => {
    return apiClient.put<MCPConnectorConfig>(`/mcp-adapters/${id}`, data)
  },

  /**
   * 删除连接器
   * DELETE /v1/mcp-adapters/:id
   */
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.delete<{ message: string }>(`/mcp-adapters/${id}`)
  },

  /**
   * 测试连接器连接
   * POST /v1/mcp-adapters/:id/test
   */
  test: async (id: string): Promise<ApiResponse<MCPConnectorTestResponse>> => {
    return apiClient.post<MCPConnectorTestResponse>(`/mcp-adapters/${id}/test`, {})
  },
}
