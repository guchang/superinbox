// 内容类型
export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  URL = 'url',
  AUDIO = 'audio',
}

// Category type
export enum CategoryType {
  TODO = 'todo',
  IDEA = 'idea',
  EXPENSE = 'expense',
  NOTE = 'note',
  BOOKMARK = 'bookmark',
  SCHEDULE = 'schedule',
  UNKNOWN = 'unknown',
}

// 动态分类
export interface Category {
  id: string
  key: string
  name: string
  description?: string
  examples?: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// 处理状态
export enum ItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 优先级
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

// 实体类型
export interface Entity {
  type: string
  value: string
  confidence?: number
}

// AI 分析结果
export interface AIAnalysis {
  category: CategoryType
  confidence: number
  entities: Entity[]
  summary?: string
  tags?: string[]
}

// 收件箱条目
export interface Item {
  id: string
  content: string
  contentType: ContentType
  source: string
  status: ItemStatus
  priority: Priority
  analysis?: AIAnalysis
  distributionResults?: Record<string, any>
  createdAt: string
  updatedAt: string
  processedAt?: string
  // File related fields
  hasFile?: boolean
  fileName?: string
  mimeType?: string
  fileSize?: number
  filePath?: string
  // Multiple files support
  allFiles?: Array<{
    fileName: string
    mimeType: string
    fileSize: number
    filePath: string
  }>
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 分页参数
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// 创建条目请求
export interface CreateItemRequest {
  content: string
  contentType?: ContentType
  source?: string
  type?: ContentType
}

// 筛选参数
export interface FilterParams extends PaginationParams {
  category?: CategoryType
  status?: ItemStatus
  source?: string
  search?: string
  sortBy?: 'createdAt' | 'updatedAt' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

// API Key 类型
export enum ApiKeyScope {
  FULL = 'full',
  WRITE = 'write',
  READ = 'read',
}

export interface ApiKey {
  id: string
  keyValue: string
  name: string
  scopes: ApiKeyScope[]
  userId: string
  isActive: boolean
  lastUsedAt?: string
  createdAt: string
}

// Prompt 模板
export interface PromptTemplate {
  id: string
  name: string
  description: string
  category: CategoryType
  template: string
  variables: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// AI 分类模板版本
export interface AiTemplateVersion {
  id: string
  name: string
  description?: string
  prompt: string
  isActive: boolean
  confirmedCoverage: string[]
  aiCoverage: string[]
  confirmedAt?: string
  createdAt: string
  updatedAt: string
}

// 路由规则
export interface RoutingRule {
  id: string
  name: string
  description: string
  priority: number
  conditions: RuleCondition[]
  actions: RuleAction[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface RuleCondition {
  field: 'category' | 'source' | 'priority' | 'content'
  operator: 'equals' | 'contains' | 'matches' | 'in'
  value: any
}

export interface RuleAction {
  type: 'notion' | 'obsidian' | 'webhook'
  config: Record<string, any>
}

// 统计数据
export interface Statistics {
  totalItems: number
  itemsByCategory: Record<CategoryType, number>
  itemsByStatus: Record<ItemStatus, number>
  itemsBySource: Record<string, number>
  avgProcessingTime: number
  todayItems: number
  weekItems: number
  monthItems: number
  aiSuccessRate: number
}

// ========== 认证相关类型 ==========

// 登录请求
export interface LoginRequest {
  username: string
  password: string
}

// 注册请求
export interface RegisterRequest {
  username: string
  email: string
  password: string
}

// 认证响应
export interface AuthResponse {
  user: User
  token: string
  refreshToken?: string
}

// 用户信息
export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  scopes: string[]
  createdAt: string
  lastLoginAt?: string
}

// 认证状态
export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}
