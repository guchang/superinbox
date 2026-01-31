/**
 * 路由分发进度事件类型定义
 */

export interface RoutingProgressEvent {
  itemId: string
  timestamp: string
}

// 开始路由分发
export interface RoutingStartEvent extends RoutingProgressEvent {
  type: 'routing:start'
  data: {
    totalRules: number
    message: string
  }
}

// 规则匹配
export interface RoutingRuleMatchEvent extends RoutingProgressEvent {
  type: 'routing:rule_match'
  data: {
    ruleName: string
    ruleId: string
    message: string
  }
}

// 开始工具调用
export interface RoutingToolCallStartEvent extends RoutingProgressEvent {
  type: 'routing:tool_call_start'
  data: {
    toolName: string
    adapterName: string
    message: string
  }
}

// 工具调用进度
export interface RoutingToolCallProgressEvent extends RoutingProgressEvent {
  type: 'routing:tool_call_progress'
  data: {
    toolName: string
    adapterName: string
    message: string
    step?: string
  }
}

// 工具调用成功
export interface RoutingToolCallSuccessEvent extends RoutingProgressEvent {
  type: 'routing:tool_call_success'
  data: {
    toolName: string
    adapterName: string
    message: string
    result?: any
  }
}

// 工具调用失败
export interface RoutingToolCallErrorEvent extends RoutingProgressEvent {
  type: 'routing:tool_call_error'
  data: {
    toolName: string
    adapterName: string
    message: string
    error: string
  }
}

// 路由分发完成
export interface RoutingCompleteEvent extends RoutingProgressEvent {
  type: 'routing:complete'
  data: {
    distributedTargets: string[]
    ruleNames: string[]
    totalSuccess: number
    totalFailed: number
    message: string
  }
}

// 路由分发跳过（无规则配置）
export interface RoutingSkippedEvent extends RoutingProgressEvent {
  type: 'routing:skipped'
  data: {
    message: string
  }
}

// 路由分发错误
export interface RoutingErrorEvent extends RoutingProgressEvent {
  type: 'routing:error'
  data: {
    message: string
    error: string
  }
}

// AI 分析完成
export interface AICompletedEvent extends RoutingProgressEvent {
  type: 'ai.completed'
  data: {
    category?: string
    summary?: string
    suggestedTitle?: string
    confidence?: number
    message?: string
  }
}

// AI 分析失败
export interface AIFailedEvent extends RoutingProgressEvent {
  type: 'ai.failed'
  data: {
    message: string
    error?: string
  }
}

// 联合类型
export type RoutingProgressEventType = 
  | RoutingStartEvent
  | RoutingRuleMatchEvent
  | RoutingToolCallStartEvent
  | RoutingToolCallProgressEvent
  | RoutingToolCallSuccessEvent
  | RoutingToolCallErrorEvent
  | RoutingCompleteEvent
  | RoutingSkippedEvent
  | RoutingErrorEvent
  | AICompletedEvent
  | AIFailedEvent

// 进度回调函数类型
export type RoutingProgressCallback = (event: RoutingProgressEventType) => void

// SSE 发送器类型
export type SSESender = (event: string, data: any) => void
