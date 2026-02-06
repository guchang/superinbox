"use client"

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mcpConnectorsApi } from '@/lib/api/mcp-connectors'
import type { CreateMCPConnectorRequest, MCPConnectorConfig, MCPConnectorListItem } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle2, ChevronDown, Clock, LayoutGrid, Plus, XCircle } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { MCPConnectorCard } from '@/components/mcp-connectors/connector-card'
import { cn } from '@/lib/utils'

type ConnectorStatusFilter = 'all' | 'healthy' | 'unhealthy' | 'pending'

const EMPTY_CONNECTORS: MCPConnectorListItem[] = []


const MOCK_CONNECTORS: MCPConnectorListItem[] = [
  {
    id: 'mock-1',
    userId: 'mock-user',
    name: 'Todoist Workspace',
    serverUrl: '',
    serverType: 'todoist',
    transportType: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-todoist',
    authType: 'oauth',
    hasApiKey: false,
    hasOAuthToken: true,
    defaultToolName: null,
    enabled: true,
    lastHealthCheck: '2026-02-05T08:30:00.000Z',
    lastHealthCheckStatus: 'healthy',
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: '2026-02-05T08:30:00.000Z',
  },
  {
    id: 'mock-2',
    userId: 'mock-user',
    name: 'Notion Notes',
    serverUrl: '',
    serverType: 'notion',
    transportType: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-notion',
    authType: 'oauth',
    hasApiKey: false,
    hasOAuthToken: false,
    defaultToolName: null,
    enabled: true,
    lastHealthCheck: null,
    lastHealthCheckStatus: null,
    createdAt: '2026-02-01T08:10:00.000Z',
    updatedAt: '2026-02-05T08:26:00.000Z',
  },
  {
    id: 'mock-3',
    userId: 'mock-user',
    name: 'Obsidian Bridge',
    serverUrl: '',
    serverType: 'custom',
    transportType: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-memory',
    authType: 'api_key',
    hasApiKey: true,
    hasOAuthToken: false,
    defaultToolName: null,
    enabled: true,
    lastHealthCheck: null,
    lastHealthCheckStatus: null,
    createdAt: '2026-02-01T08:20:00.000Z',
    updatedAt: '2026-02-05T08:10:00.000Z',
  },
  {
    id: 'mock-4',
    userId: 'mock-user',
    name: 'GitHub Issues',
    serverUrl: 'https://api.github.com/mcp',
    serverType: 'github',
    transportType: 'http',
    command: '',
    authType: 'api_key',
    hasApiKey: true,
    hasOAuthToken: false,
    defaultToolName: null,
    enabled: true,
    lastHealthCheck: '2026-02-05T08:05:00.000Z',
    lastHealthCheckStatus: 'unhealthy',
    createdAt: '2026-02-01T08:30:00.000Z',
    updatedAt: '2026-02-05T08:05:00.000Z',
  },
]


type ConnectorTemplateKey = 'notion' | 'todoist' | 'lark' | 'custom'

type ConnectorTemplatePreset = {
  key: ConnectorTemplateKey
  serverType: string
  command: string
  transportType: 'stdio' | 'http'
  authType: 'oauth' | 'api_key'
  tokenEnvKey?: string
  supportsOAuth: boolean
  tokenOptional: boolean
}

const CONNECTOR_TEMPLATE_PRESETS: Record<ConnectorTemplateKey, ConnectorTemplatePreset> = {
  notion: {
    key: 'notion',
    serverType: 'notion',
    command: 'npx -y @notionhq/notion-mcp-server',
    transportType: 'stdio',
    authType: 'oauth',
    tokenEnvKey: 'NOTION_TOKEN',
    supportsOAuth: true,
    tokenOptional: true,
  },
  todoist: {
    key: 'todoist',
    serverType: 'todoist',
    command: 'npx -y mcp-remote https://ai.todoist.net/mcp',
    transportType: 'stdio',
    authType: 'oauth',
    tokenEnvKey: 'TODOIST_API_TOKEN',
    supportsOAuth: true,
    tokenOptional: true,
  },
  lark: {
    key: 'lark',
    serverType: 'lark',
    command: 'npx -y @modelcontextprotocol/server-lark',
    transportType: 'stdio',
    authType: 'api_key',
    tokenEnvKey: 'LARK_APP_TOKEN',
    supportsOAuth: false,
    tokenOptional: false,
  },
  custom: {
    key: 'custom',
    serverType: 'custom',
    command: 'npx -y @modelcontextprotocol/server-memory',
    transportType: 'stdio',
    authType: 'api_key',
    tokenEnvKey: 'MCP_API_KEY',
    supportsOAuth: false,
    tokenOptional: true,
  },
}

const CONNECTOR_TEMPLATE_ORDER: ConnectorTemplateKey[] = ['notion', 'todoist', 'lark', 'custom']

const SERVER_TYPE_TOKEN_ENV_KEYS: Record<string, string> = {
  notion: 'NOTION_TOKEN',
  todoist: 'TODOIST_API_TOKEN',
  lark: 'LARK_APP_TOKEN',
  github: 'GITHUB_TOKEN',
  custom: 'MCP_API_KEY',
}

function getTokenEnvKeyForServerType(serverType: string): string | undefined {
  const normalizedServerType = serverType.toLowerCase()

  if (SERVER_TYPE_TOKEN_ENV_KEYS[normalizedServerType]) {
    return SERVER_TYPE_TOKEN_ENV_KEYS[normalizedServerType]
  }

  const preset = Object.values(CONNECTOR_TEMPLATE_PRESETS).find(
    (item) => item.serverType === normalizedServerType
  )

  return preset?.tokenEnvKey
}

function inferServerTypeFromCommand(command: string, fallback = 'custom'): string {
  const normalizedCommand = command.toLowerCase()

  if (normalizedCommand.includes('ai.todoist.net')) return 'todoist'
  if (normalizedCommand.includes('notion')) return 'notion'
  if (normalizedCommand.includes('server-github')) return 'github'
  if (normalizedCommand.includes('server-obsidian')) return 'obsidian'
  if (normalizedCommand.includes('lark')) return 'lark'

  return fallback
}

function buildTemplateJson(template: ConnectorTemplatePreset, name: string, token?: string): string {
  const env = token && template.tokenEnvKey
    ? { [template.tokenEnvKey]: token }
    : undefined

  const serverConfig: Record<string, unknown> = {
    command: template.command,
  }

  if (env) {
    serverConfig.env = env
  }

  return JSON.stringify(
    {
      mcpServers: {
        [name || `${template.serverType}-connector`]: serverConfig,
      },
    },
    null,
    2
  )
}

function extractApiKeyFromEnv(env?: Record<string, string>): string | undefined {
  if (!env) return undefined

  const tokenKey = Object.keys(env).find((key) =>
    key.toUpperCase().includes('TOKEN') || key.toUpperCase().includes('KEY')
  )

  return tokenKey ? env[tokenKey] : undefined
}

function syncCredentialToTemplateJson(
  jsonString: string,
  tokenEnvKey: string | undefined,
  credential: string
): string {
  if (!tokenEnvKey) {
    return jsonString
  }

  try {
    const config = JSON.parse(jsonString) as Record<string, unknown>
    const servers = (config.mcpServers && typeof config.mcpServers === 'object'
      ? config.mcpServers
      : config) as Record<string, unknown>

    const serverKey = Object.keys(servers)[0]
    if (!serverKey) {
      return jsonString
    }

    const serverConfig = servers[serverKey]
    if (!serverConfig || typeof serverConfig !== 'object' || Array.isArray(serverConfig)) {
      return jsonString
    }

    const mutableServerConfig = serverConfig as Record<string, unknown>
    const existingEnv = mutableServerConfig.env
    const nextEnv =
      existingEnv && typeof existingEnv === 'object' && !Array.isArray(existingEnv)
        ? { ...(existingEnv as Record<string, string>) }
        : {}

    const normalizedCredential = credential.trim()

    if (normalizedCredential) {
      nextEnv[tokenEnvKey] = normalizedCredential
      mutableServerConfig.env = nextEnv
    } else {
      delete nextEnv[tokenEnvKey]
      if (Object.keys(nextEnv).length > 0) {
        mutableServerConfig.env = nextEnv
      } else {
        delete mutableServerConfig.env
      }
    }

    return JSON.stringify(config, null, 2)
  } catch {
    return jsonString
  }
}

function extractCredentialFromMcpJson(
  jsonString: string,
  tokenEnvKey: string | undefined
): string | null {
  try {
    const config = JSON.parse(jsonString) as Record<string, unknown>
    const servers = (config.mcpServers && typeof config.mcpServers === 'object'
      ? config.mcpServers
      : config) as Record<string, unknown>

    const serverKey = Object.keys(servers)[0]
    if (!serverKey) {
      return ''
    }

    const serverConfig = servers[serverKey]
    if (!serverConfig || typeof serverConfig !== 'object' || Array.isArray(serverConfig)) {
      return ''
    }

    const env = (serverConfig as { env?: Record<string, string> }).env
    if (!env || typeof env !== 'object' || Array.isArray(env)) {
      return ''
    }

    if (tokenEnvKey && env[tokenEnvKey]) {
      return env[tokenEnvKey]
    }

    return extractApiKeyFromEnv(env) || ''
  } catch {
    return null
  }
}

/**
 * Parse MCP JSON configuration
 */
function parseMcpJson(
  jsonString: string,
  t: (key: string) => string
): { name: string; command: string; env?: Record<string, string> } | null {
  try {
    const config = JSON.parse(jsonString)
    const servers = config.mcpServers || config

    if (!servers || typeof servers !== 'object') {
      throw new Error(t('jsonConfig.errors.invalidFormat'))
    }

    const serverKey = Object.keys(servers)[0]
    if (!serverKey) {
      throw new Error(t('jsonConfig.errors.noServer'))
    }

    const server = servers[serverKey] as { command?: string; args?: string[]; env?: Record<string, string> }

    if (!server.command) {
      throw new Error(t('jsonConfig.errors.noCommand'))
    }

    const fullCommand = server.args && server.args.length > 0
      ? `${server.command} ${server.args.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ')}`
      : server.command

    return {
      name: serverKey,
      command: fullCommand,
      env: server.env
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(t('jsonConfig.errors.invalidJson'))
    } else {
      throw new Error(err instanceof Error ? err.message : t('jsonConfig.errors.invalidJson'))
    }
  }
}

export default function MCPAdaptersPage() {
  const t = useTranslations('mcpAdapters')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const isMockMode = searchParams.get('mcpMock') === '1'

  const { data: connectorsData, isLoading, refetch } = useQuery({
    queryKey: ['mcp-connectors'],
    queryFn: () => mcpConnectorsApi.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mcpConnectorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-connectors'] })
      toast({
        title: t('toast.deleteSuccess.title'),
        description: t('toast.deleteSuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.deleteFailure.title'),
        description: getApiErrorMessage(error, errors, common('operationFailed')),
        variant: 'destructive',
      })
    },
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => mcpConnectorsApi.test(id),
    onSuccess: (data) => {
      const status = data.data?.status
      const message = data.data?.message
      toast({
        title: status === 'healthy' ? t('toast.testSuccess.title') : t('toast.testFailure.title'),
        description: status === 'healthy'
          ? (message || t('toast.testSuccess.description'))
          : (message || t('toast.testFailure.description', { status })),
        variant: status === 'healthy' ? 'default' : 'destructive',
      })
      refetch()
    },
    onError: (error) => {
      toast({
        title: t('toast.testFailure.title'),
        description: getApiErrorMessage(error, errors, common('operationFailed')),
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setTestingId(null)
    },
  })

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingConnector, setEditingConnector] = useState<MCPConnectorConfig | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [manualTokenDialogOpen, setManualTokenDialogOpen] = useState(false)
  const [authConnector, setAuthConnector] = useState<MCPConnectorListItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<ConnectorStatusFilter>('all')

  const connectors = isMockMode ? MOCK_CONNECTORS : (connectorsData?.data ?? EMPTY_CONNECTORS)

  const connectorStats = useMemo(() => {
    const healthy = connectors.filter((connector) => connector.lastHealthCheckStatus === 'healthy').length
    const unhealthy = connectors.filter((connector) => connector.lastHealthCheckStatus && connector.lastHealthCheckStatus !== 'healthy').length
    const pending = connectors.filter((connector) => !connector.lastHealthCheckStatus).length
    return {
      total: connectors.length,
      healthy,
      unhealthy,
      pending,
    }
  }, [connectors])


  const statusPills = [
    { value: 'all' as ConnectorStatusFilter, label: t('filters.all'), count: connectorStats.total, icon: LayoutGrid },
    { value: 'healthy' as ConnectorStatusFilter, label: t('filters.healthy'), count: connectorStats.healthy, icon: CheckCircle2 },
    { value: 'unhealthy' as ConnectorStatusFilter, label: t('filters.unhealthy'), count: connectorStats.unhealthy, icon: XCircle },
    { value: 'pending' as ConnectorStatusFilter, label: t('filters.pending'), count: connectorStats.pending, icon: Clock },
  ]

  const pageLoading = isLoading && !isMockMode
  const showDesktopPillActionRow = !pageLoading && connectors.length > 0

  const filteredConnectors = useMemo(() => {
    return connectors.filter((connector) => {
      return (
        statusFilter === 'all' ||
        (statusFilter === 'healthy' && connector.lastHealthCheckStatus === 'healthy') ||
        (statusFilter === 'unhealthy' && !!connector.lastHealthCheckStatus && connector.lastHealthCheckStatus !== 'healthy') ||
        (statusFilter === 'pending' && !connector.lastHealthCheckStatus)
      )
    })
  }, [connectors, statusFilter])

  const handleCreate = () => {
    setEditingConnector(null)
    setCreateDialogOpen(true)
  }

  const handleEdit = (connector: MCPConnectorConfig) => {
    setEditingConnector(connector)
    setEditDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (isMockMode) {
      return
    }

    if (!window.confirm(t('confirmDelete'))) {
      return
    }
    deleteMutation.mutate(id)
  }

  const handleTest = (id: string) => {
    if (isMockMode) {
      return
    }

    setTestingId(id)
    testMutation.mutate(id)
  }

  const handleAuthorize = (connector: MCPConnectorListItem) => {
    if (isMockMode) {
      return
    }

    setAuthConnector(connector)
    // Show manual dialog after a short delay or immediately to allow manual entry if popup fails/blocks
    // But primarily we open the popup
    const width = 600
    const height = 700
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'
    const authUrl = `${apiUrl}/auth/oauth/${connector.serverType}/authorize`

    const popup = window.open(
      authUrl,
      'OAuth Login',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    // Open manual dialog immediately behind the popup as fallback
    setManualTokenDialogOpen(true)

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_SUCCESS' && event.data?.provider === connector.serverType) {
        // ... (existing logic) ...
        setManualTokenDialogOpen(false) // Close manual dialog on success
      }
      // ...
    }
    // ...
  }

  const handleManualTokenSubmit = async (token: string) => {
    if (isMockMode) return
    if (!authConnector) return

    try {
      await mcpConnectorsApi.update(authConnector.id, {
        oauthAccessToken: token,
        authType: 'oauth'
      })
      toast({
        title: t('toast.oauthSuccess.title'),
        description: t('toast.oauthSuccess.description'),
      })
      queryClient.invalidateQueries({ queryKey: ['mcp-connectors'] })
      setManualTokenDialogOpen(false)
    } catch (error) {
      toast({
        title: t('toast.oauthFailure.title'),
        description: getApiErrorMessage(error, errors, common('operationFailed')),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="w-full space-y-6 px-4 md:px-6 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {t('subtitle') ? (
          <div className="flex-1 min-w-0 md:pr-6 text-sm leading-relaxed text-muted-foreground">
            {t('subtitle')}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <Button
          onClick={handleCreate}
          className={cn('shrink-0 self-end md:self-auto', showDesktopPillActionRow && 'md:hidden')}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('actions.add')}
        </Button>
      </div>

      {pageLoading ? (
        <div className="text-center py-8 text-muted-foreground">{common('loading')}</div>
      ) : connectors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 overflow-x-auto">
              <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as ConnectorStatusFilter)}>
                <TabsList className="h-auto w-max min-w-full justify-start gap-2 rounded-none bg-transparent p-0 md:min-w-0">
                  {statusPills.map((pill) => {
                    const Icon = pill.icon
                    return (
                      <TabsTrigger
                        key={pill.value}
                        value={pill.value}
                        className="whitespace-nowrap shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase flex items-center gap-2 transition-all md:px-4 md:py-2 md:text-[11px] data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none dark:data-[state=active]:bg-white dark:data-[state=active]:text-black data-[state=inactive]:bg-black/5 data-[state=inactive]:opacity-40 hover:data-[state=inactive]:opacity-100 dark:data-[state=inactive]:bg-white/5"
                      >
                        <Icon className="h-[11px] w-[11px]" />
                        <span>{`${pill.label}(${pill.count})`}</span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </Tabs>
            </div>

            <Button onClick={handleCreate} className="hidden shrink-0 md:inline-flex">
              <Plus className="h-4 w-4 mr-2" />
              {t('actions.add')}
            </Button>
          </div>

          {filteredConnectors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 py-10 text-center text-sm text-muted-foreground">
              {t('filters.empty')}
            </div>
          ) : (
            <div className="rounded-xl border bg-card">
              {filteredConnectors.map((connector) => (
                <MCPConnectorCard
                  key={connector.id}
                  connector={connector}
                  onEdit={(connector) => {
                    if (isMockMode) {
                      return
                    }

                    mcpConnectorsApi.get(connector.id).then((response) => {
                      if (response.data) {
                        handleEdit(response.data)
                      }
                    })
                  }}
                  onDelete={handleDelete}
                  onTest={handleTest}
                  onAuthorize={handleAuthorize}
                  isTesting={testingId === connector.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <CreateConnectorDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={() => {
          refetch()
          setCreateDialogOpen(false)
        }}
      />

      <EditConnectorDialog
        open={editDialogOpen}
        connector={editingConnector}
        onClose={() => setEditDialogOpen(false)}
        onUpdated={() => {
          refetch()
          setEditDialogOpen(false)
        }}
      />

      <ManualTokenDialog
        open={manualTokenDialogOpen}
        onClose={() => setManualTokenDialogOpen(false)}
        onSubmit={handleManualTokenSubmit}
        connectorName={authConnector?.name || ''}
      />
    </div>
  )
}

function ManualTokenDialog({ open, onClose, onSubmit, connectorName }: { open: boolean, onClose: () => void, onSubmit: (token: string) => void, connectorName: string }) {
  const [token, setToken] = useState('')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>手动输入 Token</DialogTitle>
          <DialogDescription>
            如果自动授权窗口没有自动关闭，请从该窗口复制 Token 并粘贴到此处。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="manual-token">Access Token</Label>
            <Input
              id="manual-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="粘贴 Token..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSubmit(token)} disabled={!token}>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateConnectorDialog({ open, onClose, onCreated }: { open: boolean, onClose: () => void, onCreated: () => void }) {
  const t = useTranslations('mcpAdapters')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const { toast } = useToast()

  const [templateKey, setTemplateKey] = useState<ConnectorTemplateKey>('notion')
  const [name, setName] = useState('')
  const [credential, setCredential] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [jsonConfig, setJsonConfig] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedTemplate = CONNECTOR_TEMPLATE_PRESETS[templateKey]
  const isCustomTemplate = templateKey === 'custom'
  const shouldUseAdvancedConfig = isCustomTemplate || advancedOpen


  useEffect(() => {
    if (!open) {
      return
    }

    const initialTemplate: ConnectorTemplateKey = 'notion'
    const defaultName = t(`quickCreate.templates.${initialTemplate}.defaultName`)
    const template = CONNECTOR_TEMPLATE_PRESETS[initialTemplate]

    setTemplateKey(initialTemplate)
    setName(defaultName)
    setCredential('')
    setAdvancedOpen(false)
    setJsonConfig(buildTemplateJson(template, defaultName))
    setJsonError(null)
  }, [open, t])

  useEffect(() => {
    if (!open) {
      return
    }

    const nextTemplate = CONNECTOR_TEMPLATE_PRESETS[templateKey]
    const defaultName = t(`quickCreate.templates.${templateKey}.defaultName`)

    setName(defaultName)
    setCredential('')
    setAdvancedOpen(templateKey === 'custom')
    setJsonConfig(buildTemplateJson(nextTemplate, defaultName))
    setJsonError(null)
  }, [templateKey, open, t])

  const handleSubmit = async () => {
    setJsonError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setJsonError(t('validation.name.description'))
      return
    }

    if (!selectedTemplate.tokenOptional && !credential.trim() && !shouldUseAdvancedConfig) {
      setJsonError(t('quickCreate.errors.tokenRequired'))
      return
    }

    let payload: CreateMCPConnectorRequest

    if (shouldUseAdvancedConfig) {
      if (!jsonConfig.trim()) {
        setJsonError(t('jsonConfig.errors.required'))
        return
      }

      let parsed
      try {
        parsed = parseMcpJson(jsonConfig, t)
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : t('jsonConfig.errors.invalidJson'))
        return
      }

      if (!parsed) {
        return
      }

      const inferredServerType = templateKey === 'custom'
        ? inferServerTypeFromCommand(parsed.command, 'custom')
        : selectedTemplate.serverType

      const env: Record<string, string> = { ...(parsed.env || {}) }
      const trimmedCredential = credential.trim()

      if (trimmedCredential && selectedTemplate.tokenEnvKey && !env[selectedTemplate.tokenEnvKey]) {
        env[selectedTemplate.tokenEnvKey] = trimmedCredential
      }

      const apiKeyValue = trimmedCredential || extractApiKeyFromEnv(env)
      const authType: 'oauth' | 'api_key' =
        selectedTemplate.authType === 'oauth' || inferredServerType === 'notion' || inferredServerType === 'todoist'
          ? 'oauth'
          : 'api_key'

      payload = {
        name: trimmedName || parsed.name,
        serverType: inferredServerType,
        transportType: 'stdio',
        command: parsed.command,
        env: Object.keys(env).length > 0 ? env : undefined,
        apiKey: apiKeyValue,
        authType,
        oauthProvider: authType === 'oauth' ? inferredServerType : undefined,
        oauthAccessToken: authType === 'oauth' && trimmedCredential ? trimmedCredential : undefined,
        enabled: true,
      }
    } else {
      const trimmedCredential = credential.trim()
      const env = trimmedCredential && selectedTemplate.tokenEnvKey
        ? { [selectedTemplate.tokenEnvKey]: trimmedCredential }
        : undefined

      payload = {
        name: trimmedName,
        serverType: selectedTemplate.serverType,
        transportType: selectedTemplate.transportType,
        command: selectedTemplate.command,
        env,
        apiKey: trimmedCredential || undefined,
        authType: selectedTemplate.authType,
        oauthProvider: selectedTemplate.authType === 'oauth' ? selectedTemplate.serverType : undefined,
        oauthAccessToken: selectedTemplate.authType === 'oauth' && trimmedCredential ? trimmedCredential : undefined,
        enabled: true,
      }
    }

    try {
      setSaving(true)
      await mcpConnectorsApi.create(payload)
      toast({
        title: t('toast.createSuccess.title'),
        description: t('toast.createSuccess.description', { name: payload.name || trimmedName }),
      })
      onCreated()
    } catch (error) {
      toast({
        title: t('toast.createFailure.title'),
        description: getApiErrorMessage(error, errors, common('operationFailed')),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('dialog.create.title')}</DialogTitle>
          <DialogDescription>{t('quickCreate.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('quickCreate.templateLabel')}</Label>
            <div className="flex flex-wrap gap-2">
              {CONNECTOR_TEMPLATE_ORDER.map((key) => {
                const isActive = key === templateKey
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTemplateKey(key)}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all md:px-4 md:py-2',
                      isActive
                        ? 'bg-black text-white dark:bg-white dark:text-black'
                        : 'bg-black/5 text-foreground/70 hover:text-foreground dark:bg-white/5'
                    )}
                    disabled={saving}
                  >
                    {t(`quickCreate.templates.${key}.label`)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-connector-name">{t('fields.name.label')}</Label>
            <Input
              id="create-connector-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setJsonError(null)
              }}
              placeholder={t('fields.name.placeholder')}
              disabled={saving}
            />
          </div>

          {!isCustomTemplate && (
            <div className="space-y-2">
              <Label htmlFor="connector-credential">{t('quickCreate.tokenLabel')}</Label>
              <Input
                id="connector-credential"
                type="password"
                value={credential}
                onChange={(event) => {
                  const nextCredential = event.target.value
                  setCredential(nextCredential)
                  setJsonConfig((prev) =>
                    syncCredentialToTemplateJson(prev, selectedTemplate.tokenEnvKey, nextCredential)
                  )
                  setJsonError(null)
                }}
                placeholder={t('quickCreate.tokenPlaceholder')}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                {selectedTemplate.supportsOAuth
                  ? t('quickCreate.oauthHint')
                  : t('quickCreate.tokenHint', { envKey: selectedTemplate.tokenEnvKey || 'TOKEN' })}
              </p>
            </div>
          )}

          {isCustomTemplate ? (
            <div className="space-y-2">
              <Label htmlFor="jsonConfig">{t('jsonConfig.label')}</Label>
              <Textarea
                id="jsonConfig"
                value={jsonConfig}
                onChange={(event) => {
                  setJsonConfig(event.target.value)
                  setJsonError(null)
                }}
                className="min-h-[240px] font-mono text-sm"
                disabled={saving}
              />
            </div>
          ) : (
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <div className="rounded-lg border border-dashed p-3">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-sm font-medium"
                    disabled={saving}
                  >
                    <span>{t('quickCreate.advancedToggle')}</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', advancedOpen && 'rotate-180')} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {t('quickCreate.advancedDescription')}
                  </p>
                  <Textarea
                    value={jsonConfig}
                    onChange={(event) => {
                      setJsonConfig(event.target.value)
                      setJsonError(null)
                    }}
                    className="min-h-[180px] font-mono text-sm"
                    disabled={saving}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{common('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t('actions.creating') : t('actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditConnectorDialog({ open, connector, onClose, onUpdated }: { open: boolean, connector: MCPConnectorConfig | null, onClose: () => void, onUpdated: () => void }) {
  const t = useTranslations('mcpAdapters')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const { toast } = useToast()

  const [serverType, setServerType] = useState('custom')
  const [name, setName] = useState('')
  const [credential, setCredential] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [jsonConfig, setJsonConfig] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const tokenEnvKey = getTokenEnvKeyForServerType(serverType)

  useEffect(() => {
    if (open && connector) {
      const currentServerType = connector.serverType || 'custom'
      setServerType(currentServerType)
      setName(connector.name)
      setAdvancedOpen(false)

      const mcpJson: Record<string, unknown> = { mcpServers: {} }
      const serverConfig: Record<string, unknown> = {
        command: '',
        args: [],
        env: connector.env || {}
      }
      if (connector.transportType === 'stdio') {
        if (connector.command) {
          const parts = connector.command.split(' ')
          serverConfig.command = parts[0]
          if (parts.length > 1) serverConfig.args = parts.slice(1)
        }
      } else {
        if (connector.serverUrl) (serverConfig as any).url = connector.serverUrl
      }

      ;(mcpJson.mcpServers as Record<string, unknown>)[connector.name] = serverConfig
      const finalJson = JSON.stringify(mcpJson, null, 2)
      const defaultTokenEnvKey = getTokenEnvKeyForServerType(currentServerType)

      setJsonConfig(finalJson)
      setCredential(extractCredentialFromMcpJson(finalJson, defaultTokenEnvKey) || '')
      setJsonError(null)
    }
  }, [open, connector])

  const handleSubmit = async () => {
    if (!connector) return
    setJsonError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setJsonError(t('validation.name.description'))
      return
    }

    let parsed
    try {
      parsed = parseMcpJson(jsonConfig, t)
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : t('jsonConfig.errors.invalidJson'))
      return
    }
    if (!parsed) return

    try {
      setSaving(true)
      const authType = (serverType === 'todoist' || serverType === 'notion') ? 'oauth' : 'api_key'

      let apiKeyValue: string | undefined
      if (parsed.env) {
        const tokenKey = Object.keys(parsed.env).find((key) =>
          key.toUpperCase().includes('TOKEN') || key.toUpperCase().includes('KEY')
        )
        if (tokenKey) apiKeyValue = parsed.env[tokenKey]
      }

      await mcpConnectorsApi.update(connector.id, {
        name: trimmedName,
        serverType,
        transportType: parsed.command ? 'stdio' : 'http',
        command: parsed.command,
        env: parsed.env,
        apiKey: apiKeyValue,
        authType,
      })

      toast({
        title: t('toast.updateSuccess.title'),
        description: t('toast.updateSuccess.description', { name: trimmedName }),
      })
      onUpdated()
    } catch (error) {
      toast({
        title: t('toast.updateFailure.title'),
        description: getApiErrorMessage(error, errors, common('operationFailed')),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('dialog.edit.title')}</DialogTitle>
          <DialogDescription>{t('dialog.edit.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-connector-name">{t('fields.name.label')}</Label>
            <Input
              id="edit-connector-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setJsonError(null)
              }}
              placeholder={t('fields.name.placeholder')}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-connector-credential">{t('quickCreate.tokenLabel')}</Label>
            <Input
              id="edit-connector-credential"
              type="password"
              value={credential}
              onChange={(event) => {
                const nextCredential = event.target.value
                setCredential(nextCredential)
                setJsonConfig((prev) =>
                  syncCredentialToTemplateJson(prev, tokenEnvKey, nextCredential)
                )
                setJsonError(null)
              }}
              placeholder={t('quickCreate.tokenPlaceholder')}
              disabled={saving}
            />
            {tokenEnvKey ? (
              <p className="text-xs text-muted-foreground">
                {serverType === 'notion' || serverType === 'todoist'
                  ? t('quickCreate.oauthHint')
                  : t('quickCreate.tokenHint', { envKey: tokenEnvKey })}
              </p>
            ) : null}
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <div className="rounded-lg border border-dashed p-3">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-sm font-medium"
                  disabled={saving}
                >
                  <span>{t('quickCreate.advancedToggle')}</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', advancedOpen && 'rotate-180')} />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="pt-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  {t('quickCreate.advancedDescription')}
                </p>
                <Textarea
                  id="edit-json-config"
                  value={jsonConfig}
                  onChange={(event) => {
                    const nextJsonConfig = event.target.value
                    setJsonConfig(nextJsonConfig)

                    const nextCredential = extractCredentialFromMcpJson(nextJsonConfig, tokenEnvKey)
                    if (nextCredential !== null) {
                      setCredential(nextCredential)
                    }

                    setJsonError(null)
                  }}
                  className="min-h-[180px] font-mono text-sm"
                  disabled={saving}
                />
              </CollapsibleContent>
            </div>
          </Collapsible>

          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{common('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving || !connector}>
            {saving ? t('actions.updating') : t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
