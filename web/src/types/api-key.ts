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
    labelKey: 'groups.basic',
    scopes: [
      { value: AVAILABLE_SCOPES.INBOX_READ, labelKey: 'scopes.inboxRead.label', descriptionKey: 'scopes.inboxRead.description' },
      { value: AVAILABLE_SCOPES.INBOX_WRITE, labelKey: 'scopes.inboxWrite.label', descriptionKey: 'scopes.inboxWrite.description' },
      { value: AVAILABLE_SCOPES.INBOX_DELETE, labelKey: 'scopes.inboxDelete.label', descriptionKey: 'scopes.inboxDelete.description' },
    ],
  },
  {
    labelKey: 'groups.ai',
    scopes: [
      { value: AVAILABLE_SCOPES.INTELLIGENCE_READ, labelKey: 'scopes.aiRead.label', descriptionKey: 'scopes.aiRead.description' },
      { value: AVAILABLE_SCOPES.INTELLIGENCE_WRITE, labelKey: 'scopes.aiWrite.label', descriptionKey: 'scopes.aiWrite.description' },
    ],
  },
  {
    labelKey: 'groups.routing',
    scopes: [
      { value: AVAILABLE_SCOPES.ROUTING_READ, labelKey: 'scopes.routingRead.label', descriptionKey: 'scopes.routingRead.description' },
      { value: AVAILABLE_SCOPES.ROUTING_WRITE, labelKey: 'scopes.routingWrite.label', descriptionKey: 'scopes.routingWrite.description' },
    ],
  },
  {
    labelKey: 'groups.content',
    scopes: [
      { value: AVAILABLE_SCOPES.CONTENT_ALL, labelKey: 'scopes.contentAll.label', descriptionKey: 'scopes.contentAll.description' },
      { value: AVAILABLE_SCOPES.CONTENT_TODO, labelKey: 'scopes.contentTodo.label', descriptionKey: 'scopes.contentTodo.description' },
      { value: AVAILABLE_SCOPES.CONTENT_IDEA, labelKey: 'scopes.contentIdea.label', descriptionKey: 'scopes.contentIdea.description' },
      { value: AVAILABLE_SCOPES.CONTENT_EXPENSE, labelKey: 'scopes.contentExpense.label', descriptionKey: 'scopes.contentExpense.description' },
      { value: AVAILABLE_SCOPES.CONTENT_NOTE, labelKey: 'scopes.contentNote.label', descriptionKey: 'scopes.contentNote.description' },
      { value: AVAILABLE_SCOPES.CONTENT_BOOKMARK, labelKey: 'scopes.contentBookmark.label', descriptionKey: 'scopes.contentBookmark.description' },
      { value: AVAILABLE_SCOPES.CONTENT_SCHEDULE, labelKey: 'scopes.contentSchedule.label', descriptionKey: 'scopes.contentSchedule.description' },
    ],
  },
  {
    labelKey: 'groups.admin',
    scopes: [
      { value: AVAILABLE_SCOPES.ADMIN_FULL, labelKey: 'scopes.adminFull.label', descriptionKey: 'scopes.adminFull.description' },
    ],
  },
] as const
