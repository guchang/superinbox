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
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { MCPConnectorCard } from '@/components/mcp-connectors/connector-card'

const getServerTypeOptions = (t: (key: string) => string) => ([
  { value: 'custom', label: 'Custom / API Key' },
  { value: 'todoist', label: 'Todoist (OAuth)' },
  { value: 'notion', label: 'Notion (OAuth)' },
  { value: 'github', label: 'GitHub (API Key)' },
])

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

  const handleAuthorize = (connector: MCPConnectorListItem) => {
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
    <div className="w-full max-w-4xl mx-auto space-y-6 px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('actions.add')}
        </Button>
      </div>

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
