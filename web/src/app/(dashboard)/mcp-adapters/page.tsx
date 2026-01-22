"use client"

import { useState, useEffect } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react'

const authTypeOptions = [
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth', label: 'OAuth' },
]

const serverTypeOptions = [
  { value: 'notion', label: 'Notion' },
  { value: 'github', label: 'GitHub' },
  { value: 'custom', label: '自定义' },
]

export default function MCPAdaptersPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
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
        title: '连接器已删除',
        description: 'MCP 连接器已成功删除',
      })
    },
    onError: (error) => {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '操作失败',
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
        title: status === 'healthy' ? '连接测试成功' : '连接测试失败',
        description: status === 'healthy'
          ? (message || 'MCP 服务器连接正常')
          : (message || `连接状态: ${status}`),
        variant: status === 'healthy' ? 'default' : 'destructive',
      })
      refetch()
    },
    onError: (error) => {
      toast({
        title: '测试失败',
        description: error instanceof Error ? error.message : '操作失败',
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
    if (!window.confirm('确定删除此连接器吗？')) {
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
          <h1 className="text-3xl font-bold">MCP 连接器</h1>
          <p className="text-muted-foreground">管理 Model Context Protocol 连接器配置</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          添加连接器
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>连接器列表</CardTitle>
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
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : connectors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              尚未配置 MCP 连接器
            </div>
          ) : (
            <div className="space-y-3">
              {connectors.map((connector) => (
                <div
                  key={connector.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{connector.name}</h3>
                      <Badge variant={connector.enabled ? 'default' : 'secondary'}>
                        {connector.enabled ? '已启用' : '已停用'}
                      </Badge>
                      <Badge variant="outline">{connector.serverType}</Badge>
                      {connector.transportType && (
                        <Badge variant={connector.transportType === 'stdio' ? 'default' : 'secondary'} className="text-xs">
                          {connector.transportType === 'stdio' ? '📡 Stdio' : '🌐 HTTP'}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {connector.transportType === 'stdio' ? (
                        <div>命令: npx -y @notionhq/notion-mcp-server</div>
                      ) : (
                        <div>服务器: {connector.serverUrl}</div>
                      )}
                      {connector.lastHealthCheckStatus && (
                        <div className="flex items-center gap-1">
                          {connector.lastHealthCheckStatus === 'healthy' ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-600" />
                          )}
                          <span
                            className={
                              connector.lastHealthCheckStatus === 'healthy'
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {connector.lastHealthCheckStatus === 'healthy'
                              ? '健康'
                              : '异常'}
                          </span>
                        </div>
                      )}
                      {connector.lastHealthCheck && (
                        <div className="text-xs text-muted-foreground">
                          上次检查: {new Date(connector.lastHealthCheck).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(connector.id)}
                      disabled={testingId === connector.id}
                    >
                      {testingId === connector.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          测试中
                        </>
                      ) : (
                        '测试连接'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Get full connector details for editing
                        mcpConnectorsApi.get(connector.id).then((response) => {
                          if (response.data) {
                            handleEdit(response.data)
                          }
                        })
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(connector.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [serverType, setServerType] = useState('custom')
  const [authType, setAuthType] = useState<'api_key' | 'oauth'>('api_key')
  const [apiKey, setApiKey] = useState('')
  const [defaultToolName, setDefaultToolName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

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
    }
  }, [open])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: '请输入连接器名称',
        description: '连接器名称不能为空',
        variant: 'destructive',
      })
      return
    }

    // For HTTP type, serverUrl is required
    if (transportType === 'http' && !serverUrl.trim()) {
      toast({
        title: '请输入服务器 URL',
        description: 'HTTP 类型需要服务器 URL',
        variant: 'destructive',
      })
      return
    }

    // For stdio type with API key auth, apiKey is required
    if (transportType === 'stdio' && authType === 'api_key' && !apiKey.trim()) {
      toast({
        title: '请输入 API Key',
        description: 'API Key 不能为空（将作为环境变量传递给 MCP 服务器）',
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
        title: '连接器已创建',
        description: `已创建 "${name.trim()}"`,
      })
      onCreated()
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '操作失败',
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
          <DialogTitle>添加 MCP 连接器</DialogTitle>
          <DialogDescription>
            配置新的 Model Context Protocol 连接器
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">连接器名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Notion Workspace"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serverType">服务器类型</Label>
              <Select value={serverType} onValueChange={setServerType} disabled={saving}>
                <SelectTrigger id="serverType">
                  <SelectValue placeholder="选择类型" />
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
              <Label>传输类型</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                <span className={transportType === 'stdio' ? 'text-blue-600 font-medium' : ''}>
                  {transportType === 'stdio' ? '📡 Stdio (本地进程)' : '🌐 HTTP (网络请求)'}
                </span>
                <span className="text-muted-foreground mx-2">•</span>
                <span className="text-muted-foreground">
                  {serverType === 'notion' ? '自动检测' : '自动检测'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {transportType === 'stdio'
                  ? '通过本地进程通信（适合 Notion）'
                  : '通过 HTTP 请求通信（适合自定义服务器）'}
              </p>
            </div>
          </div>

          {transportType === 'http' && (
            <div className="space-y-2">
              <Label htmlFor="serverUrl">服务器 URL</Label>
              <Input
                id="serverUrl"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://mcp.example.com/mcp"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                MCP 服务器的 HTTP 地址
              </p>
            </div>
          )}

          {transportType === 'stdio' && (
            <div className="space-y-2">
              <Label>执行命令</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                <code className="text-xs">
                  {serverType === 'notion'
                    ? 'npx -y @notionhq/notion-mcp-server'
                    : serverType === 'github'
                    ? 'npx -y @modelcontextprotocol/server-github'
                    : 'npx [您的 MCP 服务器]'}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                命令由后端自动生成并执行
              </p>
            </div>
          )}

          {transportType === 'http' && (
            <div className="space-y-2">
              <Label htmlFor="authType">认证类型</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as 'api_key' | 'oauth')} disabled={saving}>
                <SelectTrigger id="authType">
                  <SelectValue placeholder="选择认证类型" />
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
              API Key {transportType === 'stdio' ? '(环境变量)' : ''}
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={transportType === 'stdio'
                ? 'Notion Integration Token (ntn_xxx)'
                : '输入 API Key'
              }
              disabled={saving}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {transportType === 'stdio'
                ? 'Notion Integration Token，将作为环境变量 NOTION_TOKEN 传递给 MCP 服务器'
                : '用于身份验证的密钥'
              }
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultToolName">默认工具名称（可选）</Label>
            <Input
              id="defaultToolName"
              value={defaultToolName}
              onChange={(e) => setDefaultToolName(e.target.value)}
              placeholder="例如：API-patch-block-children"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              为空时使用系统默认推断工具名称
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
              启用此连接器
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? '创建中...' : '创建'}
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
  const { toast } = useToast()
  const queryClient = useQueryClient()

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
        title: '请输入连接器名称',
        description: '连接器名称不能为空',
        variant: 'destructive',
      })
      return
    }

    // For HTTP type, serverUrl is required
    if (transportType === 'http' && !serverUrl.trim()) {
      toast({
        title: '请输入服务器 URL',
        description: 'HTTP 类型需要服务器 URL',
        variant: 'destructive',
      })
      return
    }

    // For stdio type with API key auth, apiKey is required
    if (transportType === 'stdio' && authType === 'api_key' && !apiKey.trim()) {
      toast({
        title: '请输入 API Key',
        description: 'API Key 不能为空（将作为环境变量传递给 MCP 服务器）',
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
        title: '连接器已更新',
        description: `已更新 "${name.trim()}"`,
      })
      onUpdated()
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '操作失败',
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
          <DialogTitle>编辑 MCP 连接器</DialogTitle>
          <DialogDescription>修改连接器配置</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">连接器名称</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-serverType">服务器类型</Label>
              <Select value={serverType} onValueChange={setServerType} disabled={saving}>
                <SelectTrigger id="edit-serverType">
                  <SelectValue placeholder="选择类型" />
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
              <Label>传输类型</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                <span className={transportType === 'stdio' ? 'text-blue-600 font-medium' : ''}>
                  {transportType === 'stdio' ? '📡 Stdio (本地进程)' : '🌐 HTTP (网络请求)'}
                </span>
                <span className="text-muted-foreground mx-2">•</span>
                <span className="text-muted-foreground text-xs">
                  基于配置自动检测
                </span>
              </div>
            </div>
          </div>

          {transportType === 'http' && (
            <div className="space-y-2">
              <Label htmlFor="edit-serverUrl">服务器 URL</Label>
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
              <Label>执行命令</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                <code className="text-xs">
                  {serverType === 'notion'
                    ? 'npx -y @notionhq/notion-mcp-server'
                    : serverType === 'github'
                    ? 'npx -y @modelcontextprotocol/server-github'
                    : 'npx [您的 MCP 服务器]'}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                命令由后端自动生成并执行
              </p>
            </div>
          )}

          {transportType === 'http' && (
            <div className="space-y-2">
              <Label htmlFor="edit-authType">认证类型</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as 'api_key' | 'oauth')} disabled={saving}>
                <SelectTrigger id="edit-authType">
                  <SelectValue placeholder="选择认证类型" />
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
              API Key {transportType === 'stdio' ? '(环境变量)' : ''}
            </Label>
            <Input
              id="edit-apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={transportType === 'stdio'
                ? 'Notion Integration Token (ntn_xxx)'
                : '输入新的 API Key（留空保持不变）'}
              disabled={saving}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {transportType === 'stdio'
                ? 'Notion Integration Token，将作为环境变量 NOTION_TOKEN 传递给 MCP 服务器'
                : '留空则保持现有值不变'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-defaultToolName">默认工具名称（可选）</Label>
            <Input
              id="edit-defaultToolName"
              value={defaultToolName}
              onChange={(e) => setDefaultToolName(e.target.value)}
              placeholder="例如：API-patch-block-children"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              为空时使用系统默认推断工具名称
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
              启用此连接器
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !connector}>
            {saving ? '更新中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
