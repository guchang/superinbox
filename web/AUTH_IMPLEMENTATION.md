# 账号密码登录功能实现文档

## 已实现功能

### 1. 类型定义
- **文件**: `src/types/index.ts`
- 新增认证相关类型:
  - `LoginRequest`: 登录请求
  - `RegisterRequest`: 注册请求
  - `AuthResponse`: 认证响应
  - `User`: 用户信息
  - `AuthState`: 认证状态

### 2. API 客户端
- **文件**: `src/lib/api/auth.ts`
- 实现的接口:
  - `login()`: 用户登录
  - `register()`: 用户注册
  - `logout()`: 用户登出
  - `getCurrentUser()`: 获取当前用户信息
  - `refreshToken()`: 刷新 Token

### 3. 认证状态管理
- **文件**: `src/lib/hooks/use-auth.tsx`
- 提供:
  - `AuthProvider`: 认证上下文 Provider
  - `useAuth()`: 认证 Hook
  - 自动从 localStorage 恢复认证状态
  - 自动保存认证信息到 localStorage

### 4. API 客户端更新
- **文件**: `src/lib/api/client.ts`
- 更改:
  - 从 API Key 认证改为 JWT Token 认证
  - 请求拦截器自动添加 `Authorization: Bearer {token}` 头
  - 响应拦截器处理 401 错误，自动重定向到登录页

### 5. 登录页面
- **文件**: `src/app/(auth)/login/page.tsx`
- 功能:
  - 用户名/密码登录表单
  - 表单验证（zod + react-hook-form）
  - 错误提示（toast）
  - 登录成功后跳转到首页

### 6. 注册页面
- **文件**: `src/app/(auth)/register/page.tsx`
- 功能:
  - 用户名/邮箱/密码注册表单
  - 表单验证
  - 密码确认验证
  - 注册成功后跳转到首页

### 7. 路由保护
- **文件**: `middleware.ts`
- 功能:
  - 未登录用户访问受保护路由自动重定向到登录页
  - 已登录用户访问登录/注册页自动重定向到首页
  - 从 cookie 读取 token 进行验证

### 8. Header 登出功能
- **文件**: `src/components/layout/header.tsx`
- 功能:
  - 显示用户名和邮箱
  - 下拉菜单显示用户信息
  - 退出登录按钮
  - 清除认证数据并重定向

## 使用说明

### 登录流程
1. 访问 `/login` 页面
2. 输入用户名和密码
3. 点击登录按钮
4. 登录成功后自动跳转到首页

### 注册流程
1. 访问 `/register` 页面
2. 填写用户名、邮箱、密码
3. 确认密码
4. 点击注册按钮
5. 注册成功后自动跳转到首页

### 退出登录
1. 点击右上角用户图标
2. 在下拉菜单中点击"退出登录"
3. 自动重定向到登录页

## 技术栈

- **表单管理**: react-hook-form
- **表单验证**: zod + @hookform/resolvers
- **提示消息**: sonner
- **认证**: JWT Token
- **状态管理**: React Context
- **路由**: Next.js 15 App Router
- **中间件**: Next.js Middleware

## 后端 API 要求

后端需要实现以下接口：

### POST /v1/auth/login
请求体:
```json
{
  "username": "string",
  "password": "string"
}
```

响应:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string",
      "role": "admin|user",
      "createdAt": "string",
      "lastLoginAt": "string"
    },
    "token": "string",
    "refreshToken": "string"
  }
}
```

### POST /v1/auth/register
请求体:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

响应: 同登录接口

### POST /v1/auth/logout
请求头: `Authorization: Bearer {token}`
响应:
```json
{
  "success": true
}
```

### GET /v1/auth/me
请求头: `Authorization: Bearer {token}`
响应:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "username": "string",
    "email": "string",
    "role": "admin|user",
    "createdAt": "string",
    "lastLoginAt": "string"
  }
}
```

### POST /v1/auth/refresh
请求体:
```json
{
  "refreshToken": "string"
}
```

响应: 同登录接口

## Cookie 配置

登录成功后，后端需要设置以下 cookie:
- `superinbox_auth_token`: JWT Token
- `superinbox_refresh_token`: 刷新 Token（可选）
- `superinbox_user`: 用户信息 JSON 字符串（可选，用于前端快速显示）

Cookie 属性建议:
- `httpOnly: false`（前端需要访问）
- `secure: false`（开发环境，生产环境改为 true）
- `sameSite: 'lax'`
- `path: '/'`
- `maxAge`: 根据过期时间设置

## 注意事项

1. **Token 存储**: 当前同时使用 localStorage 和 cookie 存储 token，middleware 从 cookie 读取，客户端从 localStorage 读取
2. **401 处理**: API 客户端会自动处理 401 错误并重定向到登录页
3. **路由保护**: middleware 会拦截所有请求，检查认证状态
4. **开发密钥**: 之前的 API Key 认证已完全移除

## 下一步建议

1. 实现后端认证接口
2. 添加记住密码功能（延长 token 有效期）
3. 添加忘记密码功能
4. 添加邮箱验证功能
5. 添加第三方登录（Google、GitHub 等）
6. 添加角色权限管理
7. 添加登录日志记录
