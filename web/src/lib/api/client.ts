import axios, { AxiosError, AxiosInstance } from 'axios'
import type { ApiResponse } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1'

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

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 从 localStorage 获取 API Key，使用 Bearer token 格式
        let apiKey = localStorage.getItem('superinbox_api_key')

        // 如果没有配置 API Key，使用默认的开发密钥
        if (!apiKey) {
          apiKey = 'dev-key-change-this-in-production'
          localStorage.setItem('superinbox_api_key', apiKey)
        }

        config.headers['Authorization'] = `Bearer ${apiKey}`
        return config
      },
      (error) => Promise.reject(error)
    )

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // 未授权，清除 API Key 并重定向到设置页面
          localStorage.removeItem('superinbox_api_key')
          window.location.href = '/settings'
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
