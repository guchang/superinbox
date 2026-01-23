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

/**
 * Parse MCP JSON configuration
 * Supports both { mcpServers: {...} } and direct {...} format
 */
function parseMcpJson(
  jsonString: string,
  t: (key: string) => string
): { name: string; command: string; env?: Record<string, string> } | null {
  try {
    const config = JSON.parse(jsonString)

    // Support both { mcpServers: {...} } and direct {...} format
    const servers = config.mcpServers || config

    if (!servers || typeof servers !== 'object') {
      throw new Error(t('jsonConfig.errors.invalidFormat'))
    }

    // Get the first server key
    const serverKey = Object.keys(servers)[0]
    if (!serverKey) {
      throw new Error(t('jsonConfig.errors.noServer'))
    }

    const server = servers[serverKey] as { command?: string; args?: string[]; env?: Record<string, string> }

    if (!server.command) {
      throw new Error(t('jsonConfig.errors.noCommand'))
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
  const errors = useTranslations('errors')
  const { toast } = useToast()

  const [jsonConfig, setJsonConfig] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setJsonConfig(`{
  "mcpServers": {
    "example-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-server-example"
      ]
    }
  }
}`)
      setJsonError(null)
    }
  }, [open])

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

    if (!parsed) {
      return
    }

    try {
      setSaving(true)

      // Extract API key from env if exists
      let apiKeyValue: string | undefined
      if (parsed.env) {
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
          <DialogDescription>
            {t('jsonConfig.description')}
          </DialogDescription>
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
              className="font-mono text-sm min-h-[200px]"
              disabled={saving}
            />
            {jsonError && (
              <p className="text-xs text-destructive">{jsonError}</p>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">{t('jsonConfig.help.title')}</p>
            <p className="text-xs text-muted-foreground">{t('jsonConfig.help.tip1')}</p>
          </div>

        </div>

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
  const errors = useTranslations('errors')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [jsonConfig, setJsonConfig] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Convert connector to MCP JSON format
  useEffect(() => {
    if (open && connector) {
      const mcpJson: Record<string, unknown> = {
        mcpServers: {}
      }

      const serverConfig: Record<string, unknown> = {}

      if (connector.transportType === 'stdio') {
        // stdio type: command + env
        if (connector.command) {
          const parts = connector.command.split(' ')
          serverConfig.command = parts[0]
          if (parts.length > 1) {
            serverConfig.args = parts.slice(1)
          }
        }
        if (connector.apiKey) {
          serverConfig.env = { NOTION_TOKEN: connector.apiKey }
        }
      } else {
        // http type: serverUrl
        if (connector.serverUrl) {
          serverConfig.url = connector.serverUrl
        }
        if (connector.apiKey) {
          serverConfig.headers = { Authorization: `Bearer ${connector.apiKey}` }
        }
      }

      mcpJson.mcpServers[connector.name] = serverConfig
      setJsonConfig(JSON.stringify(mcpJson, null, 2))
      setJsonError(null)
    }
  }, [open, connector])

  const handleSubmit = async () => {
    if (!connector) return

    setJsonError(null)

    // Parse MCP JSON configuration
    let parsed
    try {
      parsed = parseMcpJson(jsonConfig, t)
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : t('jsonConfig.error.invalidJson'))
      return
    }

    if (!parsed) {
      return
    }

    if (!parsed.name) {
      setJsonError(t('jsonConfig.error.missingName'))
      return
    }

    try {
      setSaving(true)

      // Determine transport type
      const transportType: 'stdio' | 'http' = parsed.command ? 'stdio' : 'http'

      // Extract API key from env if present
      let apiKeyValue: string | undefined
      if (parsed.env && typeof parsed.env === 'object') {
        const tokenKey = Object.keys(parsed.env).find(k => k.toUpperCase().includes('TOKEN'))
        if (tokenKey) {
          apiKeyValue = parsed.env[tokenKey]
        }
      }

      await mcpConnectorsApi.update(connector.id, {
        name: parsed.name,
        serverType: 'custom',
        transportType,
        command: parsed.command,
        env: parsed.env,
        apiKey: apiKeyValue,
        authType: 'none',
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
              className="font-mono text-sm min-h-[200px]"
              disabled={saving}
            />
            {jsonError && (
              <p className="text-xs text-destructive">{jsonError}</p>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">{t('jsonConfig.help.title')}</p>
            <p className="text-xs text-muted-foreground">{t('jsonConfig.help.tip1')}</p>
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
