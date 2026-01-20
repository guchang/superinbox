import { apiClient } from './client'
import type { ApiResponse, AiTemplateVersion } from '@/types'

export type AiTemplateInput = Omit<AiTemplateVersion, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>

export interface CoverageParseRequest {
  prompt: string
  categories: Array<{ key: string; name: string }>
}

export interface CoverageParseResponse {
  coverage: string[]
}

export interface TemplatePreviewRequest {
  prompt: string
  content: string
  categories: Array<{ key: string; name: string }>
}

export interface TemplatePreviewResponse {
  category: string
  confidence?: number
  reason?: string
}

export const aiTemplatesApi = {
  async list(): Promise<ApiResponse<AiTemplateVersion[]>> {
    return apiClient.get<AiTemplateVersion[]>('/ai/templates')
  },

  async create(data: AiTemplateInput): Promise<ApiResponse<AiTemplateVersion>> {
    return apiClient.post<AiTemplateVersion>('/ai/templates', data)
  },

  async update(
    id: string,
    data: Partial<AiTemplateInput>
  ): Promise<ApiResponse<AiTemplateVersion>> {
    return apiClient.put<AiTemplateVersion>(`/ai/templates/${id}`, data)
  },

  async activate(id: string): Promise<ApiResponse<AiTemplateVersion>> {
    return apiClient.post<AiTemplateVersion>(`/ai/templates/${id}/activate`)
  },

  async parseCoverage(
    id: string,
    data: CoverageParseRequest
  ): Promise<ApiResponse<CoverageParseResponse>> {
    return apiClient.post<CoverageParseResponse>(
      `/ai/templates/${id}/parse-coverage`,
      data
    )
  },

  async preview(
    data: TemplatePreviewRequest
  ): Promise<ApiResponse<TemplatePreviewResponse>> {
    return apiClient.post<TemplatePreviewResponse>('/ai/templates/preview', data)
  },
}
