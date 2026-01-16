/**
 * API Key Types
 */

export interface ApiKey {
  id: string
  name?: string
  keyValue?: string  // Only returned when creating/regenerating
  keyPreview?: string  // Masked version for display
  scopes: string[]
  isActive: boolean
  createdAt: string
  lastUsedAt?: string
}

export interface CreateApiKeyRequest {
  name?: string
  scopes: string[]
}

export interface UpdateApiKeyRequest {
  name?: string
  scopes?: string[]
}

export interface ToggleApiKeyRequest {
  isActive: boolean
}

export interface ApiKeyResponse {
  success: boolean
  data: ApiKey
}

export interface ApiKeysListResponse {
  success: boolean
  data: ApiKey[]
}

export interface ApiAccessLog {
  id: string
  apiKeyId: string
  userId: string
  endpoint: string
  method: string
  statusCode: number
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

export interface ApiAccessLogsResponse {
  success: boolean
  data: {
    logs: ApiAccessLog[]
    limit: number
    offset: number
  }
}

// Available scopes
export const AVAILABLE_SCOPES = {
  // Basic permissions
  INBOX_READ: 'inbox:read',
  INBOX_WRITE: 'inbox:write',
  INBOX_DELETE: 'inbox:delete',

  // Intelligence permissions
  INTELLIGENCE_READ: 'intelligence:read',
  INTELLIGENCE_WRITE: 'intelligence:write',

  // Routing permissions
  ROUTING_READ: 'routing:read',
  ROUTING_WRITE: 'routing:write',

  // Admin permissions
  ADMIN_FULL: 'admin:full',

  // Content type permissions
  CONTENT_ALL: 'content:all',
  CONTENT_TODO: 'content:todo',
  CONTENT_IDEA: 'content:idea',
  CONTENT_EXPENSE: 'content:expense',
  CONTENT_NOTE: 'content:note',
  CONTENT_BOOKMARK: 'content:bookmark',
  CONTENT_SCHEDULE: 'content:schedule',
} as const

export type ScopeValue = typeof AVAILABLE_SCOPES[keyof typeof AVAILABLE_SCOPES]

// Scope groups for UI display
export const SCOPE_GROUPS = [
  {
    label: '基础权限',
    scopes: [
      { value: AVAILABLE_SCOPES.INBOX_READ, label: '读取收件箱', description: '查看所有记录' },
      { value: AVAILABLE_SCOPES.INBOX_WRITE, label: '写入收件箱', description: '创建新记录' },
      { value: AVAILABLE_SCOPES.INBOX_DELETE, label: '删除记录', description: '删除现有记录' },
    ],
  },
  {
    label: 'AI 处理权限',
    scopes: [
      { value: AVAILABLE_SCOPES.INTELLIGENCE_READ, label: '读取 AI 解析', description: '查看 AI 分析结果' },
      { value: AVAILABLE_SCOPES.INTELLIGENCE_WRITE, label: '修正 AI 解析', description: '修正 AI 分析结果' },
    ],
  },
  {
    label: '路由管理权限',
    scopes: [
      { value: AVAILABLE_SCOPES.ROUTING_READ, label: '读取路由规则', description: '查看路由配置' },
      { value: AVAILABLE_SCOPES.ROUTING_WRITE, label: '管理路由规则', description: '创建和修改路由规则' },
    ],
  },
  {
    label: '内容分类权限',
    scopes: [
      { value: AVAILABLE_SCOPES.CONTENT_ALL, label: '所有类型', description: '访问所有内容类型' },
      { value: AVAILABLE_SCOPES.CONTENT_TODO, label: '待办事项', description: '仅访问待办类型' },
      { value: AVAILABLE_SCOPES.CONTENT_IDEA, label: '想法灵感', description: '仅访问想法类型' },
      { value: AVAILABLE_SCOPES.CONTENT_EXPENSE, label: '消费记录', description: '仅访问消费类型' },
      { value: AVAILABLE_SCOPES.CONTENT_NOTE, label: '笔记', description: '仅访问笔记类型' },
      { value: AVAILABLE_SCOPES.CONTENT_BOOKMARK, label: '书签收藏', description: '仅访问收藏类型' },
      { value: AVAILABLE_SCOPES.CONTENT_SCHEDULE, label: '日程安排', description: '仅访问日程类型' },
    ],
  },
  {
    label: '管理员权限',
    scopes: [
      { value: AVAILABLE_SCOPES.ADMIN_FULL, label: '完整管理权限', description: '拥有所有权限（包括 API Key 管理）' },
    ],
  },
] as const
