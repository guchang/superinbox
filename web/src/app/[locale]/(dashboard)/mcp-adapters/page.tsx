"use client"

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mcpConnectorsApi } from '@/lib/api/mcp-connectors'
import type { MCPConnectorConfig, MCPConnectorListItem } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { MCPConnectorCard } from '@/components/mcp-connectors/connector-card'

const getAuthTypeOptions = (t: (key: string) => string) => ([
  { value: 'api_key', label: t('authTypes.apiKey') },
  { value: 'oauth', label: t('authTypes.oauth') },
])

const getServerTypeOptions = (t: (key: string) => string) => ([
  { value: 'notion', label: t('serverTypes.notion') },
  { value: 'github', label: t('serverTypes.github') },
  { value: 'todoist', label: t('serverTypes.todoist') },
  { value: 'custom', label: t('serverTypes.custom') },
])

export default function MCPAdaptersPage() {
  const t = useTranslations('mcpAdapters')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const serverTypeLabels: Record<string, string> = {
    notion: t('serverTypes.notion'),
    github: t('serverTypes.github'),
    todoist: t('serverTypes.todoist'),
    custom: t('serverTypes.custom'),
  }
  const { data: connectorsData, isLoading, refetch } = useQuery({
    queryKey: ['mcp-connectors'],
    queryFn: () => mcpConnectorsApi.list(),
  })

  // Delete connector
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

  // Test connector
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

  const connectors = connectorsData?.data || []

  const handleCreate = () => {
    setEditingConnector(null)
    setCreateDialogOpen(true)
  }

  const handleEdit = (connector: MCPConnectorConfig) => {
    setEditingConnector(connector)
    setEditDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm(t('confirmDelete'))) {
      return
    }
    deleteMutation.mutate(id)
  }

  const handleTest = (id: string) => {
    setTestingId(id)
    testMutation.mutate(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('actions.add')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t('list.title')}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{common('loading')}</div>
          ) : connectors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('empty')}
            </div>
          ) : (
            <div className="space-y-3">
              {connectors.map((connector) => (
                <MCPConnectorCard
                  key={connector.id}
                  connector={connector}
                  onEdit={(connector) => {
                    // Get full connector details for editing
                    mcpConnectorsApi.get(connector.id).then((response) => {
                      if (response.data) {
                        handleEdit(response.data)
                      }
                    })
                  }}
                  onDelete={handleDelete}
                  onTest={handleTest}
                  isTesting={testingId === connector.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateConnectorDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={() => {
          refetch()
          setCreateDialogOpen(false)
        }}
      />

      {/* Edit Dialog */}
      <EditConnectorDialog
        open={editDialogOpen}
        connector={editingConnector}
        onClose={() => setEditDialogOpen(false)}
        onUpdated={() => {
          refetch()
          setEditDialogOpen(false)
        }}
      />
    </div>
  )
}

// Create Connector Dialog
interface CreateConnectorDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function CreateConnectorDialog({ open, onClose, onCreated }: CreateConnectorDialogProps) {
  const t = useTranslations('mcpAdapters')
  const common = useTranslations('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const authTypeOptions = getAuthTypeOptions(t)
  const serverTypeOptions = getServerTypeOptions(t)

  const [name, setName] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [serverType, setServerType] = useState('custom')
  const [authType, setAuthType] = useState<'api_key' | 'oauth'>('api_key')
  const [apiKey, setApiKey] = useState('')
  const [defaultToolName, setDefaultToolName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  // JSON configuration mode
  const [configMode, setConfigMode] = useState<'simple' | 'json'>('simple')
  const [jsonConfig, setJsonConfig] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Parse MCP JSON configuration
  const parseMcpJson = (jsonString: string): { name: string; command: string; env?: Record<string, string> } | null => {
    try {
      const config = JSON.parse(jsonString)

      // Support both { mcpServers: {...} } and direct {...} format
      const servers = config.mcpServers || config

      if (!servers || typeof servers !== 'object') {
        throw new Error('Invalid MCP configuration format')
      }

      // Get the first server key
      const serverKey = Object.keys(servers)[0]
      if (!serverKey) {
        throw new Error('No server configuration found')
      }

      const server = servers[serverKey] as { command?: string; args?: string[]; env?: Record<string, string> }

      if (!server.command) {
        throw new Error('Server configuration must include "command" field')
      }

      // Build command from command + args
      const fullCommand = server.args && server.args.length > 0
        ? `${server.command} ${server.args.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ')}`
        : server.command

      return {
        name: serverKey,
        command: fullCommand,
        env: server.env
      }
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON')
      return null
    }
  }

  // Validate JSON configuration
  const validateJsonConfig = () => {
    setJsonError(null)
    if (configMode === 'json') {
      if (!jsonConfig.trim()) {
        setJsonError('JSON configuration is required')
        return false
      }
      const parsed = parseMcpJson(jsonConfig)
      if (!parsed) {
        return false
      }
    }
    return true
  }

  // Determine transport type based on server type
  const transportType: 'http' | 'stdio' = serverType === 'notion' ? 'stdio' : 'http'

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setServerUrl('')
      setServerType('custom')
      setAuthType('api_key')
      setApiKey('')
      setDefaultToolName('')
      setEnabled(true)
      setConfigMode('simple')
      setJsonConfig('')
      setJsonError(null)
    }
  }, [open])

  const handleSubmit = async () => {
    // JSON mode: parse and validate JSON config
    if (configMode === 'json') {
      if (!validateJsonConfig()) {
        return
      }
      const parsed = parseMcpJson(jsonConfig)
      if (!parsed) {
        return
      }

      try {
        setSaving(true)
        // Extract API key from env if exists (e.g., TODOIST_API_TOKEN)
        let apiKeyValue: string | undefined
        if (parsed.env) {
          // Try to find API token in environment variables
          const tokenKey = Object.keys(parsed.env).find(key =>
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('api_key') ||
            key.toLowerCase().includes('apikey')
          )
          if (tokenKey) {
            apiKeyValue = parsed.env[tokenKey]
          }
        }

        await mcpConnectorsApi.create({
          name: parsed.name,
          serverType: 'custom',
          transportType: 'stdio',
          command: parsed.command,
          env: parsed.env,
          apiKey: apiKeyValue,
          authType: 'none',
          enabled,
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
      return
    }

    // Simple mode: original validation
    if (!name.trim()) {
      toast({
        title: t('validation.name.title'),
        description: t('validation.name.description'),
        variant: 'destructive',
      })
      return
    }

    // For HTTP type, serverUrl is required
    if (transportType === 'http' && !serverUrl.trim()) {
      toast({
        title: t('validation.serverUrl.title'),
        description: t('validation.serverUrl.description'),
        variant: 'destructive',
      })
      return
    }

    // For stdio type with API key auth, apiKey is required
    if (transportType === 'stdio' && authType === 'api_key' && !apiKey.trim()) {
      toast({
        title: t('validation.apiKey.title'),
        description: t('validation.apiKey.description'),
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      await mcpConnectorsApi.create({
        name: name.trim(),
        serverUrl: serverUrl.trim() || undefined,
        serverType,
        transportType,
        command: serverType === 'notion' ? undefined : undefined, // Auto-generated by backend
        authType: transportType === 'stdio' ? 'none' : authType,
        apiKey: apiKey.trim() || undefined,
        defaultToolName: defaultToolName.trim() || undefined,
        enabled,
      })
      toast({
        title: t('toast.createSuccess.title'),
        description: t('toast.createSuccess.description', { name: name.trim() }),
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
          <DialogDescription>
            {t('dialog.create.description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={configMode} onValueChange={(v) => setConfigMode(v as 'simple' | 'json')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">简化模式</TabsTrigger>
            <TabsTrigger value="json">JSON 配置</TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('fields.name.label')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('fields.name.placeholder')}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serverType">{t('fields.serverType.label')}</Label>
                <Select value={serverType} onValueChange={setServerType} disabled={saving}>
                  <SelectTrigger id="serverType">
                    <SelectValue placeholder={t('fields.serverType.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {serverTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('fields.transportType.label')}</Label>
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                  <span className={transportType === 'stdio' ? 'text-blue-600 font-medium' : ''}>
                    {transportType === 'stdio'
                      ? t('fields.transportType.stdio')
                      : t('fields.transportType.http')}
                </span>
                <span className="text-muted-foreground mx-2">•</span>
                <span className="text-muted-foreground">
                  {t('fields.transportType.auto')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {transportType === 'stdio'
                  ? t('fields.transportType.stdioHint')
                  : t('fields.transportType.httpHint')}
              </p>
            </div>
          </div>

          {transportType === 'http' && (
            <div className="space-y-2">
              <Label htmlFor="serverUrl">{t('fields.serverUrl.label')}</Label>
              <Input
                id="serverUrl"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://mcp.example.com/mcp"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                {t('fields.serverUrl.helper')}
              </p>
            </div>
          )}

          {transportType === 'stdio' && (
            <div className="space-y-2">
              <Label>{t('fields.command.label')}</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                <code className="text-xs">
                  {serverType === 'notion'
                    ? 'npx -y @notionhq/notion-mcp-server'
                    : serverType === 'github'
                    ? 'npx -y @modelcontextprotocol/server-github'
                    : serverType === 'todoist'
                    ? 'npx -y mcp-remote https://ai.todoist.net/mcp'
                    : t('fields.command.placeholder')}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('fields.command.helper')}
              </p>
            </div>
          )}

          {transportType === 'http' && (
            <div className="space-y-2">
              <Label htmlFor="authType">{t('fields.authType.label')}</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as 'api_key' | 'oauth')} disabled={saving}>
                <SelectTrigger id="authType">
                  <SelectValue placeholder={t('fields.authType.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {authTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              {t('fields.apiKey.label', { env: transportType === 'stdio' })}
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={transportType === 'stdio'
                ? t('fields.apiKey.placeholderStdio')
                : t('fields.apiKey.placeholder')}
              disabled={saving}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {transportType === 'stdio'
                ? t('fields.apiKey.hintStdio')
                : t('fields.apiKey.hint')
              }
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultToolName">{t('fields.defaultToolName.label')}</Label>
            <Input
              id="defaultToolName"
              value={defaultToolName}
              onChange={(e) => setDefaultToolName(e.target.value)}
              placeholder={t('fields.defaultToolName.placeholder')}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              {t('fields.defaultToolName.helper')}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="enabled"
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
              disabled={saving}
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              {t('fields.enabled.label')}
            </Label>
          </div>
          </TabsContent>

          <TabsContent value="json" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="jsonConfig">MCP 配置 JSON</Label>
              <p className="text-xs text-muted-foreground">
                粘贴 Claude Desktop 的 MCP 配置 JSON，支持格式：{`{ "mcpServers": { "serverName": { "command": "npx", "args": [...] } } }`}
              </p>
              <Textarea
                id="jsonConfig"
                value={jsonConfig}
                onChange={(e) => {
                  setJsonConfig(e.target.value)
                  setJsonError(null)
                }}
                placeholder={`{
  "mcpServers": {
    "todoist": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://ai.todoist.net/mcp"],
      "env": {
        "TODOIST_API_TOKEN": "your_token_here"
      }
    }
  }
}`}
                className="font-mono text-sm min-h-[200px]"
                disabled={saving}
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">配置说明：</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>直接粘贴 Claude Desktop 的 MCP 配置</li>
                <li>支持 <code>{`{ "mcpServers": { ... } }`}</code> 或直接 <code>{`{ "serverName": { ... } }`}</code> 格式</li>
                <li><code>command</code> 和 <code>args</code> 会自动合并为完整命令</li>
                <li><code>env</code> 中的 API Token 会自动提取</li>
                <li>服务器名称将从 JSON 的 key 中获取</li>
              </ul>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="enabled-json"
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(checked === true)}
                disabled={saving}
              />
              <Label htmlFor="enabled-json" className="cursor-pointer">
                {t('fields.enabled.label')}
              </Label>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {common('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t('actions.creating') : t('actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Edit Connector Dialog
interface EditConnectorDialogProps {
  open: boolean
  connector: MCPConnectorConfig | null
  onClose: () => void
  onUpdated: () => void
}

function EditConnectorDialog({ open, connector, onClose, onUpdated }: EditConnectorDialogProps) {
  const t = useTranslations('mcpAdapters')
  const common = useTranslations('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const authTypeOptions = getAuthTypeOptions(t)
  const serverTypeOptions = getServerTypeOptions(t)

  const [name, setName] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [serverType, setServerType] = useState('custom')
  const [authType, setAuthType] = useState<'api_key' | 'oauth'>('api_key')
  const [apiKey, setApiKey] = useState('')
  const [defaultToolName, setDefaultToolName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  // Determine transport type based on connector or serverType
  const transportType: 'http' | 'stdio' = connector?.transportType || (serverType === 'notion' ? 'stdio' : 'http')

  // Populate form when connector changes
  useEffect(() => {
    if (open && connector) {
      setName(connector.name)
      setServerUrl(connector.serverUrl)
      setServerType(connector.serverType)
      setAuthType(connector.authType as 'api_key' | 'oauth' || 'api_key')
      setApiKey(connector.apiKey || '')
      setDefaultToolName(connector.defaultToolName || '')
      setEnabled(connector.enabled === 1)
    }
  }, [open, connector])

  const handleSubmit = async () => {
    if (!connector) return

    if (!name.trim()) {
      toast({
        title: t('validation.name.title'),
        description: t('validation.name.description'),
        variant: 'destructive',
      })
      return
    }

    // For HTTP type, serverUrl is required
    if (transportType === 'http' && !serverUrl.trim()) {
      toast({
        title: t('validation.serverUrl.title'),
        description: t('validation.serverUrl.description'),
        variant: 'destructive',
      })
      return
    }

    // For stdio type with API key auth, apiKey is required
    if (transportType === 'stdio' && authType === 'api_key' && !apiKey.trim()) {
      toast({
        title: t('validation.apiKey.title'),
        description: t('validation.apiKey.description'),
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      await mcpConnectorsApi.update(connector.id, {
        name: name.trim(),
        serverUrl: serverUrl.trim() || undefined,
        serverType,
        authType: transportType === 'stdio' ? 'none' : authType,
        apiKey: apiKey.trim() || undefined,
        defaultToolName: defaultToolName.trim() || undefined,
        enabled,
      })
      toast({
        title: t('toast.updateSuccess.title'),
        description: t('toast.updateSuccess.description', { name: name.trim() }),
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
            <Label htmlFor="edit-name">{t('fields.name.label')}</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-serverType">{t('fields.serverType.label')}</Label>
              <Select value={serverType} onValueChange={setServerType} disabled={saving}>
                <SelectTrigger id="edit-serverType">
                  <SelectValue placeholder={t('fields.serverType.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {serverTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('fields.transportType.label')}</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                <span className={transportType === 'stdio' ? 'text-blue-600 font-medium' : ''}>
                  {transportType === 'stdio'
                    ? t('fields.transportType.stdio')
                    : t('fields.transportType.http')}
                </span>
                <span className="text-muted-foreground mx-2">•</span>
                <span className="text-muted-foreground text-xs">
                  {t('fields.transportType.auto')}
                </span>
              </div>
            </div>
          </div>

          {transportType === 'http' && (
            <div className="space-y-2">
              <Label htmlFor="edit-serverUrl">{t('fields.serverUrl.label')}</Label>
              <Input
                id="edit-serverUrl"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                disabled={saving}
              />
            </div>
          )}

          {transportType === 'stdio' && (
            <div className="space-y-2">
              <Label>{t('fields.command.label')}</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                <code className="text-xs">
                  {serverType === 'notion'
                    ? 'npx -y @notionhq/notion-mcp-server'
                    : serverType === 'github'
                    ? 'npx -y @modelcontextprotocol/server-github'
                    : serverType === 'todoist'
                    ? 'npx -y mcp-remote https://ai.todoist.net/mcp'
                    : t('fields.command.placeholder')}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('fields.command.helper')}
              </p>
            </div>
          )}

          {transportType === 'http' && (
            <div className="space-y-2">
              <Label htmlFor="edit-authType">{t('fields.authType.label')}</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as 'api_key' | 'oauth')} disabled={saving}>
                <SelectTrigger id="edit-authType">
                  <SelectValue placeholder={t('fields.authType.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {authTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-apiKey">
              {t('fields.apiKey.label', { env: transportType === 'stdio' })}
            </Label>
            <Input
              id="edit-apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={transportType === 'stdio'
                ? t('fields.apiKey.placeholderStdio')
                : t('fields.apiKey.placeholderEdit')}
              disabled={saving}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {transportType === 'stdio'
                ? t('fields.apiKey.hintStdio')
                : t('fields.apiKey.hintEdit')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-defaultToolName">{t('fields.defaultToolName.label')}</Label>
            <Input
              id="edit-defaultToolName"
              value={defaultToolName}
              onChange={(e) => setDefaultToolName(e.target.value)}
              placeholder={t('fields.defaultToolName.placeholder')}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              {t('fields.defaultToolName.helper')}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-enabled"
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
              disabled={saving}
            />
            <Label htmlFor="edit-enabled" className="cursor-pointer">
              {t('fields.enabled.label')}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {common('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !connector}>
            {saving ? t('actions.updating') : t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
