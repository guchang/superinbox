/**
 * SuperInbox Core Type Definitions
 */

// ============================================
// Core Domain Types
// ============================================

/**
 * 输入内容类型
 */
export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  URL = 'url',
  AUDIO = 'audio',
  FILE = 'file',
  MIXED = 'mixed'
}

/**
 * Content Category - Classification of content type
 */
export enum CategoryType {
  TODO = 'todo',           // Todo item - tasks or action items
  IDEA = 'idea',           // Idea/Inspiration - sudden thoughts, creative ideas
  EXPENSE = 'expense',     // Expense record - shopping, payments, bills
  NOTE = 'note',           // Note - study notes, meeting records, information
  BOOKMARK = 'bookmark',   // Bookmark/Favorite - web links, articles, resources
  SCHEDULE = 'schedule',   // Schedule - appointments, meetings, reminders with time
  UNKNOWN = 'unknown'      // Unknown type - content that cannot be clearly classified
}

export type CategoryKey = string;

/**
 * 项目状态
 */
export enum ItemStatus {
  PENDING = 'pending',     // 等待处理
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed', // 已完成
  FAILED = 'failed',       // 失败
  ARCHIVED = 'archived'    // 已归档
}

/**
 * 优先级
 */
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// ============================================
// Input/Output Types
// ============================================

/**
 * 接收到的原始输入
 */
export interface InboxInput {
  content: string;
  type?: ContentType;
  source?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  timestamp?: Date;
}

/**
 * 实体提取结果
 */
export interface ExtractedEntities {
  // 日期时间
  dates?: Date[];
  dueDate?: Date;
  startDate?: Date;

  // 金额
  amount?: number;
  currency?: string;

  // 标签和分类
  tags?: string[];
  category?: string;

  // 联系人
  people?: string[];

  // 位置
  location?: string;

  // 链接
  urls?: string[];

  // 文件相关
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  // 多文件支持
  allFiles?: Array<{
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;

  // 自定义字段
  customFields?: Record<string, unknown>;
}

/**
 * AI Analysis Result
 */
export interface AIAnalysisResult {
  category: CategoryKey;
  entities: ExtractedEntities;
  summary?: string;
  suggestedTitle?: string;
  confidence: number;
  reasoning?: string;
}

/**
 * Item - Core data model
 */
export interface Item {
  id: string;
  userId: string;

  // Original content
  originalContent: string;
  contentType: ContentType;
  source: string;

  // AI analysis result
  category: CategoryKey;
  entities: ExtractedEntities;
  summary?: string;
  suggestedTitle?: string;

  // Status management
  status: ItemStatus;
  priority: Priority;

  // 分发信息
  distributedTargets: string[];
  distributionResults: DistributionResult[];

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

// ============================================
// Distribution Types
// ============================================

/**
 * 分发目标类型
 */
export enum AdapterType {
  NOTION = 'notion',
  OBSIDIAN = 'obsidian',
  WEBHOOK = 'webhook',
  TELEGRAM = 'telegram',
  EMAIL = 'email',
  CUSTOM = 'custom',
  MCP = 'mcp',        // Generic MCP adapter
  MCP_HTTP = 'mcp_http'  // HTTP-based MCP adapter
}

/**
 * 分发配置
 */
export interface DistributionConfig {
  adapterType: AdapterType;
  enabled: boolean;
  priority: number;
  conditions?: DistributionCondition[];
  config: Record<string, unknown>;
  mcpAdapterId?: string;
  id: string;
  processingInstructions?: string;
}

/**
 * 分发条件
 */
export interface DistributionCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
  value: unknown;
}

/**
 * 分发结果
 */
export interface DistributionResult {
  id?: string;
  itemId?: string;
  targetId: string;
  adapterType: AdapterType;
  status: 'pending' | 'success' | 'failed';
  externalId?: string;
  externalUrl?: string;
  error?: string;
  timestamp: Date;
}

// ============================================
// API Types
// ============================================

/**
 * API 响应基础结构
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API 错误
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * 响应元数据
 */
export interface ResponseMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

/**
 * 创建项目请求
 */
export interface CreateItemRequest {
  content: string;
  type?: ContentType;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create item response
 */
export interface CreateItemResponse {
  id: string;
  status: ItemStatus;
  category: CategoryKey;
  message: string;
}

/**
 * Query filter
 */
export interface QueryFilter {
  status?: ItemStatus;
  category?: CategoryKey;
  source?: string;
  query?: string; // Full-text search
  since?: Date; // Incremental sync filter - return items updated after this timestamp
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Configuration Types
// ============================================

/**
 * LLM 配置
 */
export interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout: number;
  maxTokens: number;
}

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
}

/**
 * 服务器配置
 */
export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
}

/**
 * 应用配置
 */
export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  llm: LLMConfig;
  api: {
    keyPrefix: string;
    defaultKey: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    origin: string;
  };
  storage: {
    uploadDir: string;
    maxUploadSize: number;
  };
}

// ============================================
// Event Types
// ============================================

/**
 * 事件类型
 */
export enum EventType {
  ITEM_RECEIVED = 'item.received',
  ITEM_PROCESSED = 'item.processed',
  ITEM_DISTRIBUTED = 'item.distributed',
  ITEM_FAILED = 'item.failed',
  DISTRIBUTION_SUCCESS = 'distribution.success',
  DISTRIBUTION_FAILED = 'distribution.failed'
}

/**
 * 事件数据
 */
export interface EventData {
  eventType: EventType;
  itemId: string;
  userId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ============================================
// Adapter Interface Types
// ============================================

/**
 * 适配器接口
 */
export interface IAdapter {
  readonly type: AdapterType;
  readonly name: string;

  initialize(config: Record<string, unknown>): Promise<void>;
  distribute(item: Item): Promise<DistributionResult>;
  validate(config: Record<string, unknown>): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// MCP Types
// ============================================

/**
 * MCP Adapter Configuration
 * Represents a row in mcp_adapter_configs table
 */
export interface MCPAdapterConfig {
  id: string;
  userId: string;
  name: string;

  // MCP Server configuration
  serverUrl: string;
  serverType: string;  // "notion", "github", "custom"
  transportType: 'http' | 'stdio';  // Transport layer type

  // stdio-specific configuration
  command?: string;  // Command to start the MCP server (e.g., "npx @modelcontextprotocol/server-notion")
  env?: Record<string, string>;  // Environment variables for the command

  // Authentication configuration
  authType: 'api_key' | 'oauth' | 'none';  // Primary auth method, 'none' for stdio
  apiKey?: string;  // For API key authentication
  oauthProvider?: string;  // For OAuth authentication
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthTokenExpiresAt?: string;
  oauthScopes?: string;  // JSON string

  // Tool configuration
  defaultToolName?: string;
  toolConfigCache?: string;  // JSON string

  // LLM transformation configuration (optional, override system default)
  llmProvider?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmBaseUrl?: string;

  // Performance configuration
  timeout?: number;
  maxRetries?: number;
  cacheTtl?: number;

  // Status
  enabled?: number;
  lastHealthCheck?: string;
  lastHealthCheckStatus?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * OAuth Provider Configuration
 */
export interface OAuthProvider {
  id: string;  // "notion", "github", "google"
  name: string;
  authUrl: string;       // OAuth authorization endpoint
  tokenUrl: string;      // OAuth token endpoint
  scopes: string[];       // Default scopes
  clientId: string;
  redirectUri: string;
}

/**
 * OAuth Token Response
 */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

/**
 * LLM Mapping Configuration
 */
export interface LLMMappingConfig {
  provider: string;      // "openai", "anthropic", "custom"
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout?: number;
  maxTokens?: number;
}

/**
 * MCP Tool Definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/**
 * MCP Tool Call Request
 */
export interface MCPToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP Tool Call Response
 */
export interface MCPToolCallResponse {
  content: unknown;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * HTTP MCP Client Configuration
 */
export interface HttpMcpClientConfig {
  serverUrl: string;
  authToken?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Stdio MCP Client Configuration
 */
export interface StdioMcpClientConfig {
  command: string;  // Command to start the MCP server
  args?: string[];  // Command arguments
  env?: Record<string, string>;  // Environment variables
  timeout?: number;  // Request timeout in milliseconds
}
