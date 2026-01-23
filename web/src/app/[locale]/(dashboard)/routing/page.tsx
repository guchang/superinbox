"use client"

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
import { getApiErrorMessage, type ApiError } from '@/lib/i18n/api-errors'

// Helper functions - defined before components that use them

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return String(value ?? '')
}

function formatDate(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleString(locale, {
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

function getActionDisplayName(
  action: RuleAction,
  actionLabels: Record<string, string>
): string {
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
  connectorName: string,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  if (categoryKeys.length === 0) return t('ruleName.empty')
  const categoryNames = categoryKeys
    .map((key) => categories.find((c) => c.key === key)?.name || key)
    .join('+')
  return t('ruleName.pattern', { categories: categoryNames, connector: connectorName })
}

export default function RoutingPage() {
  const { toast } = useToast()
  const t = useTranslations('routingPage')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const locale = useLocale()
  const actionLabels = useMemo(
    () => ({
      mcp: t('actions.mcp'),
      mcp_http: t('actions.mcpHttp'),
    }),
    [t]
  )
  const fieldLabels = useMemo(
    () => ({
      category: t('fields.category'),
      source: t('fields.source'),
      priority: t('fields.priority'),
      content: t('fields.content'),
    }),
    [t]
  )
  const operatorLabels = useMemo(
    () => ({
      equals: t('operators.equals'),
      contains: t('operators.contains'),
      matches: t('operators.matches'),
      in: t('operators.in'),
    }),
    [t]
  )
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
    if (!window.confirm(t('confirmDelete', { name: rule.name }))) {
      return
    }

    try {
      await routingApi.deleteRule(rule.id)
      toast({
        title: t('toasts.ruleDeleted.title'),
        description: t('toasts.ruleDeleted.description', { name: rule.name }),
      })
      refetch()
    } catch (error) {
      toast({
        title: t('toasts.deleteFailed.title'),
        description: getApiErrorMessage(error, errors, common('operationFailed')),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>
        <div />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{t('ruleList.title')}</CardTitle>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t('ruleList.summary.total', { count: rules.length })}</span>
                <span>·</span>
                <span>{t('ruleList.summary.active', { count: activeRules.length })}</span>
                <span>·</span>
                <span>{t('ruleList.summary.inactive', { count: inactiveRules })}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('ruleList.searchPlaceholder')}
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
                      <SelectValue placeholder={t('ruleList.statusFilter.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('ruleList.statusFilter.all')}
                      </SelectItem>
                      <SelectItem value="active">
                        {t('ruleList.statusFilter.active')}
                      </SelectItem>
                      <SelectItem value="inactive">
                        {t('ruleList.statusFilter.inactive')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('actions.createRule')}
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {common('loading')}
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('ruleList.empty')}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRules.map((rule) => {
                  const conditions =
                    rule.conditions?.length
                      ? rule.conditions
                      : [
                          {
                            field: 'category',
                            operator: 'equals',
                            value: t('ruleList.conditions.all'),
                          },
                        ]
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
                            {rule.isActive
                              ? t('ruleList.status.active')
                              : t('ruleList.status.inactive')}
                          </Badge>
                          <Badge variant="outline">
                            {t('ruleList.priority', { value: rule.priority })}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {rule.description || t('ruleList.descriptionEmpty')}
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
                                → {getActionDisplayName(action, actionLabels)}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">
                              {t('ruleList.actionsEmpty')}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {t('ruleList.updatedAt', {
                            date: formatDate(rule.updatedAt, locale),
                          })}
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
                <CardTitle>{t('connectors.title')}</CardTitle>
                <CardDescription>{t('connectors.description')}</CardDescription>
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
                  onClick={() => window.open(`/${locale}/mcp-adapters`, '_blank')}
                >
                  {t('connectors.manage')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {connectorsLoading ? (
                <div className="text-sm text-muted-foreground">{common('loading')}</div>
              ) : mcpConnectors.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {t('connectors.empty')}
                  <a
                    href="https://www.notion.so/my-integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline ml-1"
                  >
                    {t('connectors.notionLink')}
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
                        <span>
                          {connector.enabled
                            ? t('connectors.status.enabled')
                            : t('connectors.status.disabled')}
                        </span>
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
                                ? t('connectors.health.healthy')
                                : t('connectors.health.unhealthy')}
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
        actionLabels={actionLabels}
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
  actionLabels: Record<string, string>
  onClose: () => void
  onSaved: () => void
}

function RuleEditDialog({
  open,
  rule,
  categories,
  connectorOptions,
  mcpConnectors,
  actionLabels,
  onClose,
  onSaved,
}: RuleEditDialogProps) {
  const { toast } = useToast()
  const t = useTranslations('routingPage')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
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
    const currentConnector = rule.actions?.[0]
      ? getActionDisplayName(rule.actions[0], actionLabels)
      : ''
    setConnectorSelection(connectorOptions.includes(currentConnector) ? currentConnector : '')
    setPreviewContent('')
    setPreviewResult(null)
    setPreviewError(null)
  }, [rule, open, connectorOptions, actionLabels])

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
    () => buildRuleName(categoryKeys, categories, connectorName, t),
    [categoryKeys, categories, connectorName, t]
  )

  const handleSave = async () => {
    if (!rule) {
      return
    }

    if (categoryKeys.length === 0) {
      toast({
        title: t('toasts.categoryRequired.title'),
        description: t('toasts.categoryRequired.description'),
        variant: 'destructive',
      })
      return
    }

    if (!connectorName) {
      toast({
        title: t('toasts.connectorRequired.title'),
        description: t('toasts.connectorRequired.description'),
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
        title: t('toasts.ruleUpdated.title'),
        description: t('toasts.ruleUpdated.description', { name: derivedName }),
      })
      onSaved()
      onClose()
    } catch (error) {
      toast({
        title: t('toasts.updateFailed.title'),
        description: getApiErrorMessage(error, errors, common('operationFailed')),
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
        title: t('toasts.previewContentRequired.title'),
        description: t('toasts.previewContentRequired.description'),
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
      setPreviewError(getApiErrorMessage(error, errors, t('preview.failed')))
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
        title: t('toasts.testConnectorRequired.title'),
        description: t('toasts.testConnectorRequired.description'),
        variant: 'destructive',
      })
      return
    }

    const pageId = testPageId.trim()
    if (!pageId) {
      toast({
        title: t('toasts.pageIdRequired.title'),
        description: t('toasts.pageIdRequired.description'),
        variant: 'destructive',
      })
      return
    }

    if (!testContent.trim()) {
      toast({
        title: t('toasts.testContentRequired.title'),
        description: t('toasts.testContentRequired.description'),
        variant: 'destructive',
      })
      return
    }

    if (!description.trim()) {
      toast({
        title: t('toasts.descriptionRequired.title'),
        description: t('toasts.descriptionRequired.description'),
        variant: 'destructive',
      })
      return
    }

    const mcpAdapterId = getMcpConnectorIdByName(connectorName)
    if (!mcpAdapterId) {
      toast({
        title: t('toasts.connectorNotFound.title'),
        description: t('toasts.connectorNotFound.description', {
          name: connectorName,
        }),
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
        const apiError = new Error(
          response.error || response.message || t('testDispatch.failed')
        ) as ApiError
        apiError.code = response.code
        apiError.params = response.params
        const errorMessage = getApiErrorMessage(apiError, errors, t('testDispatch.failed'))
        setTestResult({
          success: false,
          status: data?.status,
          toolName: data?.toolName,
          toolSchema: data?.toolSchema,
          steps: data?.steps,
          error: errorMessage,
        })
        toast({
          title: t('toasts.dispatchFailed.title'),
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
        error: response.error,
      })

      toast({
        title: t('toasts.dispatchSuccess.title'),
        description: t('toasts.dispatchSuccess.description'),
      })
    } catch (error) {
      const errorMessage = getApiErrorMessage(
        error,
        errors,
        t('testDispatch.sendFailed')
      )
      setTestResult({
        success: false,
        error: errorMessage,
      })
      toast({
        title: t('toasts.dispatchFailed.title'),
        description: errorMessage,
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
          <DialogTitle>{t('editDialog.title')}</DialogTitle>
          <DialogDescription>{t('editDialog.description')}</DialogDescription>
        </DialogHeader>

        {!rule ? (
          <div className="text-sm text-muted-foreground">{t('editDialog.noRule')}</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="rule-name">{t('editDialog.fields.name.label')}</Label>
                <Input id="rule-name" value={derivedName} readOnly />
                <p className="text-xs text-muted-foreground">
                  {t('editDialog.fields.name.hint')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-priority">
                  {t('editDialog.fields.priority.label')}
                </Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('editDialog.fields.categories.label')}</Label>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('editDialog.fields.categories.empty')}
                </p>
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
                {t('editDialog.fields.categories.hint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-connector">
                {t('editDialog.fields.connector.label')}
              </Label>
              {connectorOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('editDialog.fields.connector.empty')}
                </p>
              ) : (
                <Select value={connectorSelection} onValueChange={setConnectorSelection}>
                  <SelectTrigger id="rule-connector">
                    <SelectValue placeholder={t('editDialog.fields.connector.placeholder')} />
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
              <Label htmlFor="rule-description">
                {t('editDialog.fields.description.label')}
              </Label>
              <Textarea
                id="rule-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('editDialog.fields.description.placeholder')}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="rule-active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(Boolean(checked))}
              />
              <Label htmlFor="rule-active">{t('editDialog.fields.active')}</Label>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('preview.title')}</CardTitle>
                <CardDescription>{t('preview.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={previewContent}
                  onChange={(event) => setPreviewContent(event.target.value)}
                  placeholder={t('preview.placeholder')}
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handlePreview} disabled={previewLoading}>
                    {previewLoading
                      ? t('preview.actions.loading')
                      : t('preview.actions.run')}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t('preview.hint')}
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
                    {t('preview.empty')}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('testDispatch.title')}</CardTitle>
                <CardDescription>{t('testDispatch.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  placeholder={t('testDispatch.contentPlaceholder')}
                  rows={3}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="test-page-id">{t('testDispatch.pageId.label')}</Label>
                    <Input
                      id="test-page-id"
                      value={testPageId}
                      onChange={(e) => setTestPageId(e.target.value)}
                      placeholder={t('testDispatch.pageId.placeholder')}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleTestDispatch} disabled={testLoading || !connectorName}>
                      {testLoading
                        ? t('testDispatch.actions.loading')
                        : t('testDispatch.actions.run')}
                    </Button>
                  </div>
                </div>
                {testResult && (
                  <div
                    className={`rounded-md border p-3 text-sm ${
                      testResult.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="font-medium mb-1">
                      {testResult.success
                        ? t('testDispatch.result.success')
                        : t('testDispatch.result.failed')}
                    </div>
                    {testResult.status && (
                      <div className="text-xs text-muted-foreground mb-1">
                        {t('testDispatch.result.status', { status: testResult.status })}
                      </div>
                    )}
                    {testResult.toolName && (
                      <div className="text-xs text-muted-foreground mb-1">
                        {t('testDispatch.result.tool', { tool: testResult.toolName })}
                      </div>
                    )}
                    {testResult.toolSchema && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          {t('testDispatch.result.toolSchema')}
                        </div>
                        <pre className="rounded-md border bg-muted/50 p-2 text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(testResult.toolSchema, null, 2)}
                        </pre>
                      </div>
                    )}
                    {testResult.steps && testResult.steps.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {testResult.steps.map((step) => (
                          <div
                            key={step.step}
                            className="rounded-md border bg-muted/50 p-2 text-xs text-muted-foreground"
                          >
                            <div className="font-medium mb-1">
                              {t('testDispatch.result.stepTitle', {
                                step: step.step,
                                tool: step.toolName,
                              })}
                            </div>
                            <pre className="overflow-x-auto">
                              {JSON.stringify(step.toolArgs, null, 2)}
                            </pre>
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
            {common('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !rule}>
            {saving ? t('editDialog.actions.saving') : t('editDialog.actions.save')}
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
  const t = useTranslations('routingPage')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
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
        title: t('toasts.categoryRequired.title'),
        description: t('toasts.categoryRequired.description'),
        variant: 'destructive',
      })
      return
    }

    const connectorName = connectorSelection
    if (!connectorName) {
      toast({
        title: t('toasts.connectorRequired.title'),
        description: t('toasts.connectorRequired.description'),
        variant: 'destructive',
      })
      return
    }

    const nextPriority = Number.parseInt(priority, 10)
    const derivedName = buildRuleName(categoryKeys, categories, connectorName, t)
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
        title: t('toasts.ruleCreated.title'),
        description: t('toasts.ruleCreated.description', { name: derivedName }),
      })
      onCreated()
      onClose()
    } catch (error) {
      toast({
        title: t('toasts.createFailed.title'),
        description: getApiErrorMessage(error, errors, common('operationFailed')),
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
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="new-rule-name">{t('createDialog.fields.name.label')}</Label>
              <Input
                id="new-rule-name"
                value={buildRuleName(categoryKeys, categories, connectorName, t)}
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                {t('createDialog.fields.name.hint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-rule-priority">
                {t('createDialog.fields.priority.label')}
              </Label>
              <Input
                id="new-rule-priority"
                type="number"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('createDialog.fields.categories.label')}</Label>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('createDialog.fields.categories.empty')}
              </p>
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
              {t('createDialog.fields.categories.hint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-rule-connector">
              {t('createDialog.fields.connector.label')}
            </Label>
            {connectorOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('createDialog.fields.connector.empty')}
              </p>
            ) : (
              <Select value={connectorSelection} onValueChange={setConnectorSelection}>
                <SelectTrigger id="new-rule-connector">
                  <SelectValue placeholder={t('createDialog.fields.connector.placeholder')} />
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
            <Label htmlFor="new-rule-description">
              {t('createDialog.fields.description.label')}
            </Label>
            <Textarea
              id="new-rule-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('createDialog.fields.description.placeholder')}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="new-rule-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(Boolean(checked))}
            />
            <Label htmlFor="new-rule-active">{t('createDialog.fields.active')}</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {common('cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? t('createDialog.actions.saving') : t('createDialog.actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
