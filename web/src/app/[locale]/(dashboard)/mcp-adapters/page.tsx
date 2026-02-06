"use client"

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mcpConnectorsApi } from '@/lib/api/mcp-connectors'
import type { MCPConnectorConfig, MCPConnectorListItem } from '@/types'
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
import { useToast } from '@/hooks/use-toast'
import { CheckCircle2, Clock, LayoutGrid, Plus, XCircle } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { MCPConnectorCard } from '@/components/mcp-connectors/connector-card'

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
        <Button onClick={handleCreate} className="shrink-0 self-end md:self-auto">
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
          <div className="overflow-x-auto">
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as ConnectorStatusFilter)}>
              <TabsList className="h-auto w-max min-w-full justify-start gap-2 rounded-none bg-transparent p-0">
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

  const [serverType, setServerType] = useState('custom')
  const [jsonConfig, setJsonConfig] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setServerType('custom')
      setJsonConfig(`{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}`)
      setJsonError(null)
    }
  }, [open])

  useEffect(() => {
    if (!jsonConfig) return
    if (jsonConfig.includes('todoist')) setServerType('todoist')
    else if (jsonConfig.includes('notion')) setServerType('notion')
  }, [jsonConfig])

  const handleSubmit = async () => {
    setJsonError(null)
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

    if (!parsed) return

    try {
      setSaving(true)
      const authType = (serverType === 'todoist' || serverType === 'notion') ? 'oauth' : 'api_key'

      let apiKeyValue: string | undefined
      if (parsed.env) {
        const tokenKey = Object.keys(parsed.env).find(key =>
          key.toUpperCase().includes('TOKEN') || key.toUpperCase().includes('KEY')
        )
        if (tokenKey) apiKeyValue = parsed.env[tokenKey]
      }

      await mcpConnectorsApi.create({
        name: parsed.name,
        serverType,
        transportType: 'stdio',
        command: parsed.command,
        env: parsed.env,
        apiKey: apiKeyValue,
        authType,
        enabled: true
      })

      toast({
        title: t('toast.createSuccess.title'),
        description: t('toast.createSuccess.description', { name: parsed.name }),
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
          <DialogDescription>{t('jsonConfig.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jsonConfig">{t('jsonConfig.label')}</Label>
            <Textarea
              id="jsonConfig"
              value={jsonConfig}
              onChange={(e) => {
                setJsonConfig(e.target.value)
                setJsonError(null)
              }}
              className="font-mono text-sm min-h-[300px]"
              disabled={saving}
            />
            {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          </div>
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
  const [jsonConfig, setJsonConfig] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && connector) {
      setServerType(connector.serverType || 'custom')
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
      setJsonConfig(JSON.stringify(mcpJson, null, 2))
      setJsonError(null)
    }
  }, [open, connector])

  const handleSubmit = async () => {
    if (!connector) return
    setJsonError(null)
    let parsed
    try {
      parsed = parseMcpJson(jsonConfig, t)
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : t('jsonConfig.errors.invalidJson'))
      return
    }
    if (!parsed || !parsed.name) return

    try {
      setSaving(true)
      const authType = (serverType === 'todoist' || serverType === 'notion') ? 'oauth' : 'api_key'

      let apiKeyValue: string | undefined
      if (parsed.env) {
        const tokenKey = Object.keys(parsed.env).find(k =>
          k.toUpperCase().includes('TOKEN') || k.toUpperCase().includes('KEY')
        )
        if (tokenKey) apiKeyValue = parsed.env[tokenKey]
      }

      await mcpConnectorsApi.update(connector.id, {
        name: parsed.name,
        serverType,
        transportType: parsed.command ? 'stdio' : 'http',
        command: parsed.command,
        env: parsed.env,
        apiKey: apiKeyValue,
        authType,
      })

      toast({
        title: t('toast.updateSuccess.title'),
        description: t('toast.updateSuccess.description', { name: parsed.name }),
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
            <Label htmlFor="edit-json-config">{t('jsonConfig.label')}</Label>
            <Textarea
              id="edit-json-config"
              value={jsonConfig}
              onChange={(e) => {
                setJsonConfig(e.target.value)
                setJsonError(null)
              }}
              className="font-mono text-sm min-h-[300px]"
              disabled={saving}
            />
            {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          </div>
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
