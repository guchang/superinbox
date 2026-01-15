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
 * 意图分类
 */
export enum IntentType {
  TODO = 'todo',           // 待办事项
  IDEA = 'idea',           // 想法/灵感
  EXPENSE = 'expense',     // 消费记录
  NOTE = 'note',           // 笔记
  BOOKMARK = 'bookmark',   // 书签/收藏
  SCHEDULE = 'schedule',   // 日程安排
  UNKNOWN = 'unknown'      // 未知类型
}

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

  // 自定义字段
  customFields?: Record<string, unknown>;
}

/**
 * AI 处理结果
 */
export interface AIAnalysisResult {
  intent: IntentType;
  entities: ExtractedEntities;
  summary?: string;
  suggestedTitle?: string;
  confidence: number;
  reasoning?: string;
}

/**
 * 项目 - 核心数据模型
 */
export interface Item {
  id: string;
  userId: string;

  // 原始内容
  originalContent: string;
  contentType: ContentType;
  source: string;

  // AI 分析结果
  intent: IntentType;
  entities: ExtractedEntities;
  summary?: string;
  suggestedTitle?: string;

  // 状态管理
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
  CUSTOM = 'custom'
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
 * 创建项目响应
 */
export interface CreateItemResponse {
  id: string;
  status: ItemStatus;
  intent: IntentType;
  message: string;
}

/**
 * 查询过滤器
 */
export interface QueryFilter {
  status?: ItemStatus;
  intent?: IntentType;
  source?: string;
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
