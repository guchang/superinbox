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
}
