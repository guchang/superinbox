import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1'

const TOKEN_KEY = "superinbox_auth_token"

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
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

        return config
      },
      (error) => Promise.reject(error)
    )

    // 响应拦截器：处理 401 错误
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // 未授权，清除认证数据并重定向到登录页
          if (typeof window !== 'undefined') {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem('superinbox_refresh_token')
            localStorage.removeItem('superinbox_user')
            // 只有当前不在登录页时才重定向
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login'
            }
          }
        }
        return Promise.reject(error)
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
