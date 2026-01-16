import { apiClient } from './client'
import type {
  ApiResponse,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
} from '@/types'

export const authApi = {
  // 登录
  async login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return apiClient.post<AuthResponse>('/auth/login', data)
  },

  // 注册
  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    return apiClient.post<AuthResponse>('/auth/register', data)
  },

  // 登出
  async logout(): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/logout')
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/auth/me')
  },

  // 刷新 Token
  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthResponse>> {
    return apiClient.post<AuthResponse>('/auth/refresh', { refreshToken })
  },
}
