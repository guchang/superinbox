export type ApiError = Error & {
  code?: string
  params?: Record<string, unknown>
}

export type TranslateFn = (
  key: string,
  values?: Record<string, string | number>
) => string

const ERROR_CODE_TO_KEY: Record<string, string> = {
  'AUTH.INVALID_INPUT': 'auth.invalidInput',
  'AUTH.INVALID_CREDENTIALS': 'auth.invalidCredentials',
  'AUTH.UNAUTHORIZED': 'auth.unauthorized',
  'AUTH.FORBIDDEN': 'auth.forbidden',
  'AUTH.USERNAME_EXISTS': 'auth.usernameExists',
  'AUTH.EMAIL_EXISTS': 'auth.emailExists',
  'AUTH.LOGIN_FAILED': 'auth.loginFailed',
  'AUTH.REGISTER_FAILED': 'auth.registerFailed',
  'AUTH.INVALID_REFRESH_TOKEN': 'auth.invalidRefreshToken',
  'AUTH.MISSING_REFRESH_TOKEN': 'auth.missingRefreshToken',
  'AUTH.REFRESH_TOKEN_EXPIRED': 'auth.refreshTokenExpired',
  'AUTH.REFRESH_FAILED': 'auth.refreshFailed',
  'AUTH.USER_NOT_FOUND': 'auth.userNotFound',
  'REQUEST.INVALID': 'request.invalid',
  'ROUTING.INVALID_INPUT': 'routing.invalidInput',
  'ROUTING.INVALID_CONFIG': 'routing.invalidConfig',
  'ROUTING.CONNECTOR_NOT_FOUND': 'routing.connectorNotFound',
  'ROUTING.DISPATCH_FAILED': 'routing.dispatchFailed',
  'MCP.CONNECTOR_NOT_FOUND': 'mcp.connectorNotFound',
  'MCP.INVALID_CONFIG': 'mcp.invalidConfig',
  'INBOX.NOT_FOUND': 'inbox.notFound',
  'INBOX.FILE_TOO_LARGE': 'inbox.fileTooLarge',
  'INBOX.TOO_MANY_FILES': 'inbox.tooManyFiles',
  'INBOX.INVALID_FILE_TYPE': 'inbox.invalidFileType',
  'INBOX.FILE_NOT_FOUND': 'inbox.fileNotFound',
  'INBOX.FILE_INDEX_OUT_OF_RANGE': 'inbox.fileIndexOutOfRange',
  'INBOX.NO_FILES': 'inbox.noFiles',
  'INBOX.INVALID_INPUT': 'inbox.invalidInput',
  'INBOX.INVALID_STATUS': 'inbox.invalidStatus',
  'API_KEYS.NOT_FOUND': 'apiKeys.notFound',
  'API_KEYS.INVALID_INPUT': 'apiKeys.invalidInput',
  'AI.INVALID_INPUT': 'ai.invalidInput',
  'AI.TEMPLATE_NOT_FOUND': 'ai.templateNotFound',
  'AI.CATEGORY_NOT_FOUND': 'ai.categoryNotFound',
  'AI.CATEGORY_KEY_EXISTS': 'ai.categoryKeyExists',
  'AI.CATEGORY_PROMPT_VERSION_NOT_FOUND': 'ai.categoryPromptVersionNotFound',
  'AI.CATEGORY_PROMPT_PREVIOUS_NOT_FOUND': 'ai.categoryPromptPreviousNotFound',
  'AI.SYSTEM_CATEGORY_IMMUTABLE': 'ai.systemCategoryImmutable',
  'AI.PREVIEW_FAILED': 'ai.previewFailed',
  'SETTINGS.INVALID_TIMEZONE': 'settings.invalidTimezone',
  'SETTINGS.INVALID_INPUT': 'settings.invalidInput',
  'LOGS.INVALID_QUERY': 'logs.invalidQuery',
  'LOGS.INVALID_FORMAT': 'logs.invalidFormat',
  'LOGS.INVALID_FIELDS': 'logs.invalidFields',
  'LOGS.EXPORT_NOT_FOUND': 'logs.exportNotFound',
  'LOGS.EXPORT_NOT_READY': 'logs.exportNotReady',
  'LOGS.EXPORT_EXPIRED': 'logs.exportExpired',
  'INTELLIGENCE.PARSE_FAILED': 'intelligence.parseFailed',
  'INTELLIGENCE.UPDATE_FAILED': 'intelligence.updateFailed',
  'INTERNAL_ERROR': 'internalError',
}

const normalizeParams = (
  params?: Record<string, unknown>
): Record<string, string | number> | undefined => {
  if (!params) return undefined
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        return [key, value]
      }
      if (typeof value === 'boolean') {
        return [key, value ? 'true' : 'false']
      }
      if (value === null || value === undefined) {
        return [key, '']
      }
      return [key, JSON.stringify(value)]
    })
  )
}

export function getApiErrorMessage(
  error: unknown,
  t: TranslateFn,
  fallback?: string
): string {
  if (typeof error === 'string') {
    const trimmed = error.trim()
    if (trimmed) return trimmed
  }

  if (error && typeof error === 'object') {
    const apiError = error as ApiError
    if (apiError.code) {
      const key = ERROR_CODE_TO_KEY[apiError.code]
      if (key) {
        return t(key, normalizeParams(apiError.params))
      }
    }
    if (apiError.message) {
      return apiError.message
    }
  }

  return fallback ?? t('unknown')
}
