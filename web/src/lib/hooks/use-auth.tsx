"use client"

import * as React from "react"
import { authApi } from "@/lib/api/auth"
import type { AuthState, User, LoginRequest, RegisterRequest } from "@/types"

interface AuthContextValue {
  authState: AuthState
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = "superinbox_auth_token"
const REFRESH_TOKEN_KEY = "superinbox_refresh_token"
const USER_KEY = "superinbox_user"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = React.useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  })

  // 初始化：从 localStorage 恢复认证状态
  React.useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User
        setAuthState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        })
      } catch (error) {
        // 解析失败，清除数据
        clearAuthData()
        setAuthState(prev => ({ ...prev, isLoading: false }))
      }
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  // 保存认证数据到 localStorage
  const saveAuthData = (user: User, token: string, refreshToken?: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }
  }

  // 清除认证数据
  const clearAuthData = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  // 登录
  const login = async (data: LoginRequest) => {
    const response = await authApi.login(data)

    if (response.success && response.data) {
      const { user, token, refreshToken } = response.data
      saveAuthData(user, token, refreshToken)

      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
    } else {
      throw new Error(response.error || "登录失败")
    }
  }

  // 注册
  const register = async (data: RegisterRequest) => {
    const response = await authApi.register(data)

    if (response.success && response.data) {
      const { user, token, refreshToken } = response.data
      saveAuthData(user, token, refreshToken)

      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
    } else {
      throw new Error(response.error || "注册失败")
    }
  }

  // 登出
  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // 即使接口调用失败，也要清除本地数据
      console.error("登出接口调用失败:", error)
    } finally {
      clearAuthData()
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      })
      // 跳转到登录页面
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }

  // 刷新 Token
  const refreshToken = async () => {
    const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY)

    if (!refreshTokenValue) {
      throw new Error("没有刷新令牌")
    }

    const response = await authApi.refreshToken(refreshTokenValue)

    if (response.success && response.data) {
      const { user, token, refreshToken: newRefreshToken } = response.data
      saveAuthData(user, token, newRefreshToken)

      setAuthState(prev => ({
        ...prev,
        user,
        token,
      }))
    } else {
      // 刷新失败，清除认证数据
      clearAuthData()
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      })
      throw new Error(response.error || "刷新令牌失败")
    }
  }

  return (
    <AuthContext.Provider
      value={{
        authState,
        login,
        register,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Hook：使用认证上下文
export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内部使用")
  }
  return context
}

// Hook：获取当前 Token（用于 API 客户端）
export function useAuthToken(): string | null {
  const { authState } = useAuth()
  return authState.token
}
