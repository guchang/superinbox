"use client"

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Category, RoutingRule, RuleAction, RuleCondition, MCPConnectorListItem } from '@/types'
import { categoriesApi } from '@/lib/api/categories'
import { routingApi } from '@/lib/api/routing'
import { mcpConnectorsApi } from '@/lib/api/mcp-connectors'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react'

const actionLabels: Record<string, string> = {
  notion: 'Notion',
  obsidian: 'Obsidian',
  webhook: 'Webhook',
}

// Helper functions - defined before components that use them
const fieldLabels: Record<string, string> = {
  category: '分类',
  source: '来源',
  priority: '优先级',
  content: '内容',
}

const operatorLabels: Record<string, string> = {
  equals: '等于',
  contains: '包含',
  matches: '匹配',
  in: '属于',
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return String(value ?? '')
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getCategoryKeys(conditions?: RuleCondition[]): string[] {
  if (!conditions) return []
  const categoryCondition = conditions.find((c) => c.field === 'category')
  if (!categoryCondition) return []
  if (Array.isArray(categoryCondition.value)) {
    return categoryCondition.value as string[]
  }
  return [String(categoryCondition.value)]
}

function getActionDisplayName(action: RuleAction): string {
  const connectorName = action.config?.connectorName as string | undefined
  if (connectorName) return connectorName
  return actionLabels[action.type] || action.type
}

function getActionTypeForConnector(connectorName: string): RuleAction['type'] {
  // Map connector name to action type
  // For now, default to 'mcp_http' for MCP connectors
  return 'mcp_http'
}

function buildRuleName(
  categoryKeys: string[],
  categories: Category[],
  connectorName: string
): string {
  if (categoryKeys.length === 0) return '未命名规则'
  const categoryNames = categoryKeys
    .map((key) => categories.find((c) => c.key === key)?.name || key)
    .join('+')
  return `${categoryNames} → ${connectorName}`
}

export default function RoutingPage() {
  const { toast } = useToast()
  const { data: rulesData, isLoading, refetch } = useQuery({
    queryKey: ['routing-rules'],
    queryFn: () => routingApi.getRules(),
  })
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  // 从后端 API 获取 MCP 连接器列表
  const { data: mcpConnectorsData, isLoading: connectorsLoading, refetch: refetchConnectors } = useQuery({
    queryKey: ['mcp-connectors'],
    queryFn: () => mcpConnectorsApi.list(),
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const rules = rulesData?.data || []
  const categories = categoriesData?.data || []
  const mcpConnectors = mcpConnectorsData?.data || []
  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => b.priority - a.priority),
    [rules]
  )
  const activeRules = rules.filter((rule) => rule.isActive)
  const inactiveRules = rules.length - activeRules.length

  const filteredRules = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return sortedRules.filter((rule) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? rule.isActive : !rule.isActive)
      const matchesSearch =
        !normalizedSearch ||
        rule.name.toLowerCase().includes(normalizedSearch) ||
        (rule.description || '').toLowerCase().includes(normalizedSearch)
      return matchesStatus && matchesSearch
    })
  }, [sortedRules, search, statusFilter])

  // 连接器选项：从 MCP 连接器中提取名称
  const connectorOptions = useMemo(
    () => mcpConnectors.map((connector) => connector.name),
    [mcpConnectors]
  )

  const handleEditRule = (rule: RoutingRule) => {
    setEditingRule(rule)
    setEditOpen(true)
  }

  const handleDeleteRule = async (rule: RoutingRule) => {
    if (!window.confirm(`确定删除规则"${rule.name}"吗？`)) {
      return
    }

    try {
      await routingApi.deleteRule(rule.id)
      toast({
        title: '规则已删除',
        description: `已删除"${rule.name}"`,
      })
      refetch()
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">分发规则</h1>
        </div>
        <div />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>规则管理</CardTitle>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>总计 {rules.length}</span>
                <span>·</span>
                <span>活跃 {activeRules.length}</span>
                <span>·</span>
                <span>停用 {inactiveRules}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索规则名称或描述"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                <div className="sm:w-[180px]">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as 'all' | 'active' | 'inactive')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="状态筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="active">仅活跃</SelectItem>
                      <SelectItem value="inactive">仅停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  新建规则
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无分发规则
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRules.map((rule) => {
                  const conditions =
                    rule.conditions?.length
                      ? rule.conditions
                      : [{ field: 'category', operator: 'equals', value: '全部' }]
                  const actions = rule.actions ?? []

                  return (
                    <div
                      key={rule.id}
                      className="flex flex-col gap-4 border-b pb-4 last:border-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-medium">{rule.name}</h3>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? '活跃' : '停用'}
                          </Badge>
                          <Badge variant="outline">优先级: {rule.priority}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {rule.description || '未填写规则说明'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {conditions.map((condition, index) => (
                            <Badge key={`${rule.id}-condition-${index}`} variant="secondary">
                              {fieldLabels[condition.field] || condition.field}{' '}
                              {operatorLabels[condition.operator] || condition.operator}{' '}
                              {formatValue(condition.value)}
                            </Badge>
                          ))}
                          {actions.length ? (
                            actions.map((action, index) => (
                              <Badge key={`${rule.id}-action-${index}`} variant="outline">
                                → {getActionDisplayName(action)}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">未配置动作</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          更新于 {formatDate(rule.updatedAt)}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditRule(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRule(rule)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>MCP 连接器</CardTitle>
                <CardDescription>管理后端 MCP 连接器配置</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchConnectors()}
                  disabled={connectorsLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${connectorsLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/mcp-adapters', '_blank')}
                >
                  管理连接器
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {connectorsLoading ? (
                <div className="text-sm text-muted-foreground">加载中...</div>
              ) : mcpConnectors.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  尚未配置 MCP 连接器。
                  <a
                    href="https://www.notion.so/my-integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline ml-1"
                  >
                    前往 Notion 创建 Integration
                  </a>
                </div>
              ) : (
                mcpConnectors.map((connector) => (
                  <div
                    key={connector.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <div className="text-sm font-medium">{connector.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{connector.serverType}</span>
                        <span>·</span>
                        <span>{connector.enabled ? '已启用' : '已停用'}</span>
                        {connector.lastHealthCheckStatus && (
                          <>
                            <span>·</span>
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <RuleEditDialog
        open={editOpen}
        rule={editingRule}
        categories={categories}
        connectorOptions={connectorOptions}
        mcpConnectors={mcpConnectors}
        onClose={() => {
          setEditOpen(false)
          setEditingRule(null)
        }}
        onSaved={() => refetch()}
      />
      <CreateRuleDialog
        open={createOpen}
        categories={categories}
        connectorOptions={connectorOptions}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  )
}

interface RuleEditDialogProps {
  open: boolean
  rule: RoutingRule | null
  categories: Category[]
  connectorOptions: string[]
  mcpConnectors: MCPConnectorListItem[]
  onClose: () => void
  onSaved: () => void
}

function RuleEditDialog({
  open,
  rule,
  categories,
  connectorOptions,
  mcpConnectors,
  onClose,
  onSaved,
}: RuleEditDialogProps) {
  const { toast } = useToast()
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [categoryKeys, setCategoryKeys] = useState<string[]>([])
  const [connectorSelection, setConnectorSelection] = useState('')
  const [previewContent, setPreviewContent] = useState('')
  const [previewResult, setPreviewResult] = useState<unknown>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Test dispatch state
  const [testContent, setTestContent] = useState('')
  const [testPageId, setTestPageId] = useState('2efdca6525fe8110bd7de53062d860f7')
  const [testResult, setTestResult] = useState<{
    success: boolean
    status?: string
    toolName?: string
    toolSchema?: Record<string, unknown>
    steps?: Array<{
      step: number
      toolName: string
      toolArgs: Record<string, unknown>
      toolResponse?: unknown
      error?: string
    }>
    error?: string
  } | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    if (!rule || !open) {
      return
    }
    setDescription(rule.description || '')
    setPriority(String(rule.priority ?? 0))
    setIsActive(rule.isActive)
    setCategoryKeys(getCategoryKeys(rule.conditions))
    const currentConnector = rule.actions?.[0] ? getActionDisplayName(rule.actions[0]) : ''
    setConnectorSelection(connectorOptions.includes(currentConnector) ? currentConnector : '')
    setPreviewContent('')
    setPreviewResult(null)
    setPreviewError(null)
  }, [rule, open, connectorOptions])

  const toggleCategory = (key: string, checked: boolean) => {
    setCategoryKeys((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key]
      }
      return prev.filter((item) => item !== key)
    })
  }

  const connectorName = connectorSelection
  const derivedName = useMemo(
    () => buildRuleName(categoryKeys, categories, connectorName),
    [categoryKeys, categories, connectorName]
  )

  const handleSave = async () => {
    if (!rule) {
      return
    }

    if (categoryKeys.length === 0) {
      toast({
        title: '请选择分类',
        description: '规则必须选择至少一个分类',
        variant: 'destructive',
      })
      return
    }

    if (!connectorName) {
      toast({
        title: '请选择连接器',
        description: '规则必须选择一个连接器',
        variant: 'destructive',
      })
      return
    }

    const nextPriority = Number.parseInt(priority, 10)
    const nextConditions: RuleCondition[] = [
      { field: 'category', operator: 'in', value: categoryKeys },
    ]
    const existingConfig =
      rule.actions && rule.actions.length > 0 ? rule.actions[0].config || {} : {}
    const nextActions: RuleAction[] = [
      {
        type: getActionTypeForConnector(connectorName),
        config: {
          ...existingConfig,
          connectorName,
        },
      },
    ]

    try {
      setSaving(true)
      await routingApi.updateRule(rule.id, {
        name: derivedName,
        description: description.trim(),
        priority: Number.isNaN(nextPriority) ? 0 : nextPriority,
        isActive,
        conditions: nextConditions,
        actions: nextActions,
      })
      toast({
        title: '规则已更新',
        description: `已保存"${derivedName}"`,
      })
      onSaved()
      onClose()
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

  const handlePreview = async () => {
    if (!rule) {
      return
    }
    if (!previewContent.trim()) {
      toast({
        title: '请输入样例内容',
        description: '用于测试规则是否匹配',
        variant: 'destructive',
      })
      return
    }

    try {
      setPreviewLoading(true)
      setPreviewError(null)
      const result = await routingApi.testRule(rule.id, previewContent)
      setPreviewResult(result.data)
    } catch (error) {
      setPreviewResult(null)
      setPreviewError(error instanceof Error ? error.message : '测试失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Get MCP connector ID by name
  const getMcpConnectorIdByName = (name: string): string | undefined => {
    return mcpConnectors.find((connector) => connector.name === name)?.id
  }

  const handleTestDispatch = async () => {
    if (!connectorName) {
      toast({
        title: '请先选择连接器',
        description: '需要选择一个 MCP 连接器来运行测试',
        variant: 'destructive',
      })
      return
    }

    const pageId = testPageId.trim()
    if (!pageId) {
      toast({
        title: '请输入页面 ID',
        description: '需要提供 Notion 页面 ID 才能追加内容',
        variant: 'destructive',
      })
      return
    }

    if (!testContent.trim()) {
      toast({
        title: '请输入测试内容',
        description: '输入要追加到 Notion 页面里的内容',
        variant: 'destructive',
      })
      return
    }

    if (!description.trim()) {
      toast({
        title: '请输入规则描述',
        description: '规则描述将作为 LLM 处理指令',
        variant: 'destructive',
      })
      return
    }

    const mcpAdapterId = getMcpConnectorIdByName(connectorName)
    if (!mcpAdapterId) {
      toast({
        title: '找不到连接器',
        description: `无法找到 "${connectorName}" 的 MCP 连接器配置`,
        variant: 'destructive',
      })
      return
    }

    try {
      setTestLoading(true)
      setTestResult(null)

      const response = await routingApi.testDispatch({
        content: testContent.trim(),
        mcpAdapterId,
        pageId,
        instructions: description.trim()
      })

      const data = response.data
      if (!response.success) {
        const errorMessage = response.error || response.message || '追加失败'
      setTestResult({
        success: false,
        status: data?.status,
        toolName: data?.toolName,
        toolSchema: data?.toolSchema,
        steps: data?.steps,
        error: errorMessage
      })
        toast({
          title: '追加失败',
          description: errorMessage,
          variant: 'destructive',
        })
        return
      }

      setTestResult({
        success: true,
        status: data?.status,
        toolName: data?.toolName,
        toolSchema: data?.toolSchema,
        steps: data?.steps,
        error: response.error
      })

      toast({
        title: '追加成功',
        description: '内容已追加到 Notion 页面',
      })
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : '测试发送失败'
      })
      toast({
        title: '追加失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑规则</DialogTitle>
          <DialogDescription>调整规则配置并预览匹配结果</DialogDescription>
        </DialogHeader>

        {!rule ? (
          <div className="text-sm text-muted-foreground">未选择规则</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="rule-name">名称</Label>
                <Input id="rule-name" value={derivedName} readOnly />
                <p className="text-xs text-muted-foreground">名称自动生成</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-priority">优先级</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>分类条件（必选，可多选）</Label>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无分类可选</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => {
                    const checked = categoryKeys.includes(category.key)
                    return (
                      <label
                        key={category.id}
                        htmlFor={`rule-category-${category.id}`}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          id={`rule-category-${category.id}`}
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleCategory(category.key, Boolean(value))
                          }
                        />
                        <span>{category.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                当前仅支持按分类匹配
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-connector">连接器（必选）</Label>
              {connectorOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">请先在右侧创建连接器</p>
              ) : (
                <Select value={connectorSelection} onValueChange={setConnectorSelection}>
                  <SelectTrigger id="rule-connector">
                    <SelectValue placeholder="选择连接器" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectorOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">描述</Label>
              <Textarea
                id="rule-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="一句话描述这条规则"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="rule-active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(Boolean(checked))}
              />
              <Label htmlFor="rule-active">启用该规则</Label>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>规则预览</CardTitle>
                <CardDescription>输入样例内容测试规则匹配</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={previewContent}
                  onChange={(event) => setPreviewContent(event.target.value)}
                  placeholder="请输入样例内容或结构化文本"
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handlePreview} disabled={previewLoading}>
                    {previewLoading ? '测试中...' : '测试规则'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    调用 /routing/rules/:id/test
                  </span>
                </div>
                {previewError ? (
                  <div className="text-sm text-destructive">{previewError}</div>
                ) : previewResult ? (
                  <pre className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
                    {JSON.stringify(previewResult, null, 2)}
                  </pre>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    预览结果将在这里显示
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                  <CardTitle>运行测试</CardTitle>
                <CardDescription>输入内容并追加到 Notion 页面</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  placeholder="输入要追加到 Notion 页面里的内容..."
                  rows={3}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="test-page-id">Notion 页面 ID</Label>
                    <Input
                      id="test-page-id"
                      value={testPageId}
                      onChange={(e) => setTestPageId(e.target.value)}
                      placeholder="2efdca6525fe8110bd7de53062d860f7"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleTestDispatch} disabled={testLoading || !connectorName}>
                      {testLoading ? '追加中...' : '运行测试'}
                    </Button>
                  </div>
                </div>
                {testResult && (
                  <div className={`rounded-md border p-3 text-sm ${
                    testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="font-medium mb-1">
                      {testResult.success ? '✓ 追加成功' : '✗ 追加失败'}
                    </div>
                    {testResult.status && (
                      <div className="text-xs text-muted-foreground mb-1">
                        状态：{testResult.status}
                      </div>
                    )}
                    {testResult.toolName && (
                      <div className="text-xs text-muted-foreground mb-1">
                        工具：{testResult.toolName}
                      </div>
                    )}
                    {testResult.toolSchema && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">工具 Schema</div>
                        <pre className="rounded-md border bg-muted/50 p-2 text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(testResult.toolSchema, null, 2)}
                        </pre>
                      </div>
                    )}
                    {testResult.steps && testResult.steps.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {testResult.steps.map((step) => (
                          <div key={step.step} className="rounded-md border bg-muted/50 p-2 text-xs text-muted-foreground">
                            <div className="font-medium mb-1">步骤 {step.step}: {step.toolName}</div>
                            <pre className="overflow-x-auto">{JSON.stringify(step.toolArgs, null, 2)}</pre>
                            {step.toolResponse !== undefined && (
                              <pre className="mt-2 overflow-x-auto">
                                {JSON.stringify(step.toolResponse, null, 2)}
                              </pre>
                            )}
                            {step.error && (
                              <div className="text-destructive mt-1">{step.error}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {testResult.error && (
                      <div className="text-destructive text-xs">{testResult.error}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !rule}>
            {saving ? '保存中...' : '保存规则'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CreateRuleDialogProps {
  open: boolean
  categories: Category[]
  connectorOptions: string[]
  onClose: () => void
  onCreated: () => void
}

function CreateRuleDialog({
  open,
  categories,
  connectorOptions,
  onClose,
  onCreated,
}: CreateRuleDialogProps) {
  const { toast } = useToast()
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [categoryKeys, setCategoryKeys] = useState<string[]>([])
  const [connectorSelection, setConnectorSelection] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setDescription('')
    setPriority('0')
    setIsActive(true)
    setCategoryKeys([])
    setConnectorSelection('')
  }, [open])

  const toggleCategory = (key: string, checked: boolean) => {
    setCategoryKeys((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key]
      }
      return prev.filter((item) => item !== key)
    })
  }

  const connectorName = connectorSelection

  const handleCreate = async () => {
    if (categoryKeys.length === 0) {
      toast({
        title: '请选择分类',
        description: '规则必须选择至少一个分类',
        variant: 'destructive',
      })
      return
    }

    const connectorName = connectorSelection
    if (!connectorName) {
      toast({
        title: '请选择连接器',
        description: '规则必须选择一个连接器',
        variant: 'destructive',
      })
      return
    }

    const nextPriority = Number.parseInt(priority, 10)
    const derivedName = buildRuleName(categoryKeys, categories, connectorName)
    const nextConditions: RuleCondition[] = [
      { field: 'category', operator: 'in', value: categoryKeys },
    ]
    const nextActions: RuleAction[] = [
      {
        type: getActionTypeForConnector(connectorName),
        config: {
          connectorName,
        },
      },
    ]

    try {
      setSaving(true)
      await routingApi.createRule({
        name: derivedName,
        description: description.trim(),
        priority: Number.isNaN(nextPriority) ? 0 : nextPriority,
        isActive,
        conditions: nextConditions,
        actions: nextActions,
      })
      toast({
        title: '规则已创建',
        description: `已新增"${derivedName}"`,
      })
      onCreated()
      onClose()
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建规则</DialogTitle>
          <DialogDescription>创建新的分发规则</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="new-rule-name">名称</Label>
              <Input
                id="new-rule-name"
                value={buildRuleName(categoryKeys, categories, connectorName)}
                readOnly
              />
              <p className="text-xs text-muted-foreground">名称自动生成</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-rule-priority">优先级</Label>
              <Input
                id="new-rule-priority"
                type="number"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>分类条件（必选，可多选）</Label>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无分类可选</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((category) => {
                  const checked = categoryKeys.includes(category.key)
                  return (
                    <label
                      key={category.id}
                      htmlFor={`new-rule-category-${category.id}`}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        id={`new-rule-category-${category.id}`}
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleCategory(category.key, Boolean(value))
                        }
                      />
                      <span>{category.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              当前仅支持按分类匹配
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-rule-connector">连接器（必选）</Label>
            {connectorOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">请先在右侧创建连接器</p>
            ) : (
              <Select value={connectorSelection} onValueChange={setConnectorSelection}>
                <SelectTrigger id="new-rule-connector">
                  <SelectValue placeholder="选择连接器" />
                </SelectTrigger>
                <SelectContent>
                  {connectorOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-rule-description">描述</Label>
            <Textarea
              id="new-rule-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="一句话描述这条规则"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="new-rule-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(Boolean(checked))}
            />
            <Label htmlFor="new-rule-active">启用该规则</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? '创建中...' : '创建规则'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
