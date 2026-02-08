// 内容类型
export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  URL = 'url',
  AUDIO = 'audio',
  VIDEO = 'video',
  FILE = 'file',
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

export type CategoryKey = string

// 动态分类
export interface Category {
  id: string
  key: string
  name: string
  description?: string
  examples?: string[]
  icon?: string
  color?: string
  sortOrder?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoryPrompt {
  prompt: string
  updatedAt: string | null
  isCustomized: boolean
  canRollback: boolean
  previousPrompt: string | null
  previousUpdatedAt: string | null
}

// 处理状态
export enum ItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 路由分发状态
export type RoutingStatus = 'pending' | 'skipped' | 'processing' | 'completed' | 'failed'

// 实体类型
export interface Entity {
  type: string
  value: string
  confidence?: number
}

// AI 分析结果
export interface AIAnalysis {
  category: CategoryKey
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
  analysis?: AIAnalysis
  distributionResults?: Record<string, any>
  distributedTargets?: any[]
  routingPreviewTargets?: Array<{
    id?: string
    name?: string
    serverType?: string
    logoColor?: string
  }>
  distributedRuleNames?: string[]
  routingStatus?: RoutingStatus
  createdAt: string
  updatedAt: string
  createdAtLocal?: string | null
  updatedAtLocal?: string | null
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
  code?: string
  params?: Record<string, unknown>
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

export interface UpdateItemRequest {
  content?: string
  category?: CategoryKey
  status?: ItemStatus
}

// 筛选参数
export interface FilterParams extends PaginationParams {
  category?: CategoryKey
  status?: ItemStatus
  source?: string
  search?: string
  hasType?: 'text' | 'url' | 'image' | 'audio' | 'video' | 'file'
  sortBy?: 'createdAt' | 'updatedAt'
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
  category: CategoryKey
  template: string
  variables: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// 回溯应用模式
export enum RetroactiveMode {
  NONE = 'none',        // 不回溯：仅应用于新条目
  APPLY = 'apply',      // 立即回溯：应用到所有匹配的历史条目
  BATCH = 'batch',      // 高级回溯：批量处理（带筛选器）
}

// 回溯配置（用于 BATCH 模式）
export interface RetroactiveConfig {
  batchSize?: number
  delayBetweenBatches?: number
  filters?: {
    status?: string
    startDate?: string
    endDate?: string
    category?: string
  }
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
  isSystem?: boolean  // System rules are hardcoded for testing
  retroactiveMode?: RetroactiveMode
  retroactiveConfig?: RetroactiveConfig
  createdAt: string
  updatedAt: string
}

export interface RuleCondition {
  field: 'category' | 'source' | 'content'
  operator: 'equals' | 'contains' | 'matches' | 'in'
  value: any
}

export interface RuleAction {
  type: 'mcp' | 'mcp_http'
  config: Record<string, any>
}

// 统计数据
export interface Statistics {
  totalItems: number
  itemsByCategory: Record<CategoryKey, number>
  itemsByStatus: Record<ItemStatus, number>
  itemsBySource: Record<string, number>
  avgProcessingTime: number
  todayItems: number
  weekItems: number
  monthItems: number
  aiSuccessRate: number
}

export interface UserSettings {
  timezone: string | null
  updatedAt?: string
}

export interface LlmConfigItem {
  id: string
  name: string | null
  provider: string | null
  model: string | null
  baseUrl: string | null
  timeout: number | null
  maxTokens: number | null
  isActive: boolean
  priority: number
  apiKeyConfigured: boolean
  createdAt: string
  updatedAt: string
}

export interface LlmSettings {
  configs: LlmConfigItem[]
}

export interface LlmConfigCreatePayload {
  name?: string | null
  provider: string
  model: string
  baseUrl?: string | null
  apiKey: string
  timeout?: number | null
  maxTokens?: number | null
  isActive?: boolean
}

export interface LlmConfigTestPayload {
  provider: string
  model: string
  baseUrl?: string | null
  apiKey: string
  timeout?: number | null
  maxTokens?: number | null
}

export interface LlmConfigUpdatePayload {
  name?: string | null
  provider?: string | null
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  timeout?: number | null
  maxTokens?: number | null
  isActive?: boolean
  priority?: number
}

export interface LlmConfigTestResult {
  id: string
  ok: boolean
  latencyMs: number
  provider: string
  model: string
  message: string
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

// ========== MCP 连接器相关类型 ==========

// MCP 连接器配置类型（与后端对齐）
export interface MCPConnectorConfig {
  id: string
  userId: string
  name: string
  serverUrl: string
  serverType: string
  transportType: 'http' | 'stdio'
  command?: string
  env?: Record<string, string>
  authType: 'api_key' | 'oauth' | 'none'
  apiKey?: string
  oauthProvider?: string
  oauthAccessToken?: string
  oauthRefreshToken?: string
  oauthTokenExpiresAt?: string
  oauthScopes?: string
  defaultToolName?: string
  toolConfigCache?: string
  llmProvider?: string
  llmApiKey?: string
  llmModel?: string
  llmBaseUrl?: string
  timeout?: number
  maxRetries?: number
  cacheTtl?: number
  enabled: number
  lastHealthCheck?: string
  lastHealthCheckStatus?: 'healthy' | 'unhealthy' | 'error'
  createdAt: string
  updatedAt: string
}

// 连接器列表响应（隐藏敏感信息）
export interface MCPConnectorListItem {
  id: string
  userId: string
  name: string
  serverUrl: string
  serverType: string
  transportType: 'http' | 'stdio'
  command?: string
  authType: string
  hasApiKey: boolean
  hasOAuthToken: boolean
  defaultToolName: string | null
  enabled: boolean
  lastHealthCheck: string | null
  lastHealthCheckStatus: string | null
  createdAt: string
  updatedAt: string
  logoColor?: string  // Logo color for initial letter fallback
}

// 创建/更新 MCP 连接器请求
export interface CreateMCPConnectorRequest {
  name: string
  serverUrl?: string
  serverType?: string
  transportType?: 'http' | 'stdio'
  command?: string
  env?: Record<string, string>
  authType?: 'api_key' | 'oauth' | 'none'
  apiKey?: string
  oauthProvider?: string
  oauthAccessToken?: string
  defaultToolName?: string
  enabled?: boolean
  timeout?: number
  maxRetries?: number
  cacheTtl?: number
}

// 连接器测试响应
export interface MCPConnectorTestResponse {
  id: string
  name: string
  status: 'healthy' | 'unhealthy'
  testedAt: string
  message?: string
}

// ========== LLM 使用统计相关类型 ==========

// LLM 使用日志
export interface LlmUsageLog {
  id: string
  userId: string | null
  model: string
  provider: string
  requestMessages: Array<{ role: string; content: string }>
  responseContent: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  status: 'success' | 'error'
  errorMessage: string | null
  createdAt: string
}

// LLM 统计数据
export interface LlmStatistics {
  totalCalls: number
  successCalls: number
  errorCalls: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  byModel: Array<{
    model: string
    calls: number
    tokens: number
  }>
  byProvider: Array<{
    provider: string
    calls: number
    tokens: number
  }>
  trendData: Array<{
    date: string
    calls: number
    tokens: number
  }>
}

// LLM 日志查询参数
export interface LlmLogsParams {
  userId?: string
  model?: string
  provider?: string
  status?: 'success' | 'error'
  sessionId?: string
  sessionType?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

// LLM 统计查询参数
export interface LlmStatisticsParams {
  userId?: string
  startDate?: string
  endDate?: string
}

// LLM 会话（按 session_id 分组）
export interface LlmSession {
  sessionId: string
  sessionType: string
  calls: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  startedAt: string
  endedAt: string
  duration: number
  model: string
  provider: string
}

// LLM 会话查询参数
export interface LlmSessionsParams {
  userId?: string
  sessionType?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}
