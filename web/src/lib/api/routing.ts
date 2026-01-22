import { apiClient } from './client'
import type { RoutingRule, ApiResponse } from '@/types'

export const routingApi = {
  // 获取所有路由规则
  async getRules(): Promise<ApiResponse<RoutingRule[]>> {
    return apiClient.get<RoutingRule[]>('/routing/rules')
  },

  // 获取单个路由规则
  async getRule(id: string): Promise<ApiResponse<RoutingRule>> {
    return apiClient.get<RoutingRule>(`/routing/rules/${id}`)
  },

  // 创建路由规则
  async createRule(data: Omit<RoutingRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<RoutingRule>> {
    return apiClient.post<RoutingRule>('/routing/rules', data)
  },

  // 更新路由规则
  async updateRule(id: string, data: Partial<RoutingRule>): Promise<ApiResponse<RoutingRule>> {
    return apiClient.put<RoutingRule>(`/routing/rules/${id}`, data)
  },

  // 删除路由规则
  async deleteRule(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/routing/rules/${id}`)
  },

  // 测试路由规则
  async testRule(id: string, content: string): Promise<ApiResponse<any>> {
    return apiClient.post<any>(`/routing/rules/${id}/test`, { content })
  },

  // 测试连接器配置
  async testConnector(config: Record<string, unknown>): Promise<ApiResponse<any>> {
    return apiClient.post<any>('/routing/connectors/test', { config })
  },

  // 测试分发内容到 MCP 连接器
  async testDispatch(data: {
    content: string
    mcpAdapterId: string
    pageId: string
    instructions: string
    toolName?: string
  }): Promise<ApiResponse<{
    pageId: string
    status: 'success' | 'failed'
    toolName?: string
    toolSchema?: Record<string, unknown>
    steps?: Array<{
      step: number
      toolName: string
      toolArgs: Record<string, unknown>
      toolResponse?: unknown
      error?: string
    }>
    error?: string
  }>> {
    return apiClient.post('/routing/rules/test-dispatch', data)
  },

}
