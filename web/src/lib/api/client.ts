import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@/types'
import { getApiBaseUrl } from './base-url'

const TOKEN_KEY = "superinbox_auth_token"
const DEFAULT_ERROR_EN = 'Request failed'
const DEFAULT_ERROR_ZH = '请求失败'

const getDefaultErrorMessage = () => {
  if (typeof document === 'undefined') return DEFAULT_ERROR_EN
  const lang = document.documentElement.lang || 'zh-CN'
  return lang.startsWith('zh') ? DEFAULT_ERROR_ZH : DEFAULT_ERROR_EN
}

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: getApiBaseUrl(),
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      timeout: 180000,
    })

    // 请求拦截器：添加 JWT Token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // 从 localStorage 获取 JWT Token
        const token = typeof window !== 'undefined'
          ? localStorage.getItem(TOKEN_KEY)
          : null

        if (token) {
          config.headers = config.headers || {}
          config.headers['Authorization'] = `Bearer ${token}`
        }

        // For FormData, let browser set Content-Type with boundary
        if (config.data instanceof FormData && config.headers) {
          delete config.headers['Content-Type']
        }

        return config
      },
      (error) => Promise.reject(error)
    )

    // 响应拦截器：处理错误
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse<unknown>>) => {
        // 提取后端返回的错误信息
        const responseData = error.response?.data as
          | {
              error?: string | { message?: string; code?: string; params?: Record<string, unknown> }
              message?: string
              code?: string
              params?: Record<string, unknown>
            }
          | undefined
        const errorFromPayload = responseData?.error
        const errorMessage =
          (typeof errorFromPayload === 'string'
            ? errorFromPayload
            : errorFromPayload?.message) ||
          responseData?.message ||
          error.message ||
          getDefaultErrorMessage()
        const errorCode = responseData?.code || (
          typeof errorFromPayload === 'string' ? undefined : errorFromPayload?.code
        )
        const errorParams = responseData?.params || (
          typeof errorFromPayload === 'string' ? undefined : errorFromPayload?.params
        )

        if (error.response?.status === 401) {
          // 未授权，清除认证数据并重定向到登录页
          if (typeof window !== 'undefined') {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem('superinbox_refresh_token')
            localStorage.removeItem('superinbox_user')
            // 只有当前不在登录页时才重定向
            if (!window.location.pathname.includes('/login')) {
              const locale = document.documentElement.lang || 'zh-CN'
              window.location.href = `/${locale}/login`
            }
          }
        }

        // 创建包含后端错误信息的新错误对象
        const enhancedError = new Error(errorMessage) as Error & {
          status?: number
          originalError?: AxiosError
          code?: string
          params?: Record<string, unknown>
        }
        enhancedError.status = error.response?.status
        enhancedError.originalError = error
        enhancedError.code = errorCode
        enhancedError.params = errorParams

        return Promise.reject(enhancedError)
      }
    )
  }

  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, { params })
    return response.data
  }

  async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data)
    return response.data
  }

  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data)
    return response.data
  }

  async patch<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data)
    return response.data
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url)
    return response.data
  }
}

export const apiClient = new ApiClient()
