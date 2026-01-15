// 内容类型
export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  URL = 'url',
  AUDIO = 'audio',
}

// 意图类型
export enum IntentType {
  TODO = 'todo',
  IDEA = 'idea',
  EXPENSE = 'expense',
  NOTE = 'note',
  BOOKMARK = 'bookmark',
  SCHEDULE = 'schedule',
  UNKNOWN = 'unknown',
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
  intent: IntentType
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
  intent?: IntentType
  status?: ItemStatus
  source?: string
  search?: string
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
  intent: IntentType
  template: string
  variables: string[]
  isActive: boolean
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
  field: 'intent' | 'source' | 'priority' | 'content'
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
  itemsByIntent: Record<IntentType, number>
  itemsByStatus: Record<ItemStatus, number>
  itemsBySource: Record<string, number>
  avgProcessingTime: number
  todayItems: number
  weekItems: number
  monthItems: number
}
