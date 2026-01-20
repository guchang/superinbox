"use client"

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { categoriesApi } from '@/lib/api/categories'
import { aiTemplatesApi } from '@/lib/api/ai'
import type { AiTemplateVersion, Category } from '@/types'

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('zh-CN') : '—'

const buildCoverageSuggestions = (
  prompt: string,
  categories: Category[]
): string[] => {
  const normalizedPrompt = prompt.toLowerCase()
  const matches = categories.filter((category) => {
    const keyMatch = normalizedPrompt.includes(category.key.toLowerCase())
    const nameMatch = normalizedPrompt.includes(category.name.toLowerCase())
    return keyMatch || nameMatch
  })

  if (matches.length > 0) {
    return matches.map((category) => category.key)
  }

  return categories
    .filter((category) => category.isActive)
    .slice(0, 3)
    .map((category) => category.key)
}

type CategoryDraft = {
  id?: string
  originalKey?: string
  key: string
  name: string
  description: string
  examplesText: string
  isActive: boolean
}

type TemplateDraft = {
  id?: string
  name: string
  description: string
  prompt: string
  confirmedCoverage: string[]
  aiCoverage: string[]
  confirmedAt?: string
  lastParsedPrompt?: string
}

type TemplateSampleResult = {
  categoryKey: string
  confidence?: number
  reason?: string
}

export default function AIPage() {
  const { toast } = useToast()
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [isParsingCoverage, setIsParsingCoverage] = useState(false)
  const [activatingTemplateId, setActivatingTemplateId] = useState<string | null>(null)
  const [togglingCategoryId, setTogglingCategoryId] = useState<string | null>(null)
  const [coverageSampleInput, setCoverageSampleInput] = useState('')
  const [coverageSample, setCoverageSample] = useState('')
  const [isSampleRunning, setIsSampleRunning] = useState(false)
  const [sampleResult, setSampleResult] = useState<TemplateSampleResult | null>(null)
  const [sampleError, setSampleError] = useState<string | null>(null)

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isFetching: categoriesFetching,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const {
    data: templatesData,
    isLoading: templatesLoading,
    isFetching: templatesFetching,
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ['ai-templates'],
    queryFn: () => aiTemplatesApi.list(),
  })

  const categories = useMemo(() => {
    return (categoriesData?.data || []).map((category) => ({
      ...category,
      examples: category.examples || [],
    }))
  }, [categoriesData])

  const templates = useMemo(() => {
    return (templatesData?.data || []).map((template) => ({
      ...template,
      confirmedCoverage: template.confirmedCoverage || [],
      aiCoverage: template.aiCoverage || [],
    }))
  }, [templatesData])

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories]
  )

  const categoryList = useMemo(() => {
    return [...categories].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [categories])

  const activeCategoryKeys = useMemo(
    () => activeCategories.map((category) => category.key),
    [activeCategories]
  )

  const activeTemplate = useMemo(
    () => templates.find((template) => template.isActive),
    [templates]
  )

  const templateList = useMemo(() => {
    return [...templates].sort((a, b) => {
      // Active template first
      const activeDiff = Number(b.isActive) - Number(a.isActive)
      if (activeDiff !== 0) return activeDiff
      // Then by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [templates])

  const keyMap = useMemo(() => {
    return new Map(categories.map((category) => [category.key, category.name]))
  }, [categories])

  const activeTemplateCoverage = useMemo(() => {
    if (!activeTemplate) return []
    return activeTemplate.aiCoverage?.length
      ? activeTemplate.aiCoverage
      : activeTemplate.confirmedCoverage || []
  }, [activeTemplate])

  const missingCoverageKeys = useMemo(() => {
    if (!activeTemplate) return activeCategoryKeys
    return activeCategoryKeys.filter((key) => !activeTemplateCoverage.includes(key))
  }, [activeTemplate, activeCategoryKeys, activeTemplateCoverage])

  const categoryKeyConflict = useMemo(() => {
    if (!categoryDraft?.key) return false
    return categories.some(
      (category) =>
        category.key === categoryDraft.key && category.id !== categoryDraft.id
    )
  }, [categories, categoryDraft])

  const canSaveCategory =
    categoryDraft &&
    categoryDraft.name.trim().length > 0 &&
    categoryDraft.key.trim().length > 0 &&
    !categoryKeyConflict

  const isRefreshing = categoriesFetching || templatesFetching
  const parsedCategoryKeys = useMemo(() => {
    if (!templateDraft) return []
    if (templateDraft.aiCoverage.length > 0) return templateDraft.aiCoverage
    return templateDraft.confirmedCoverage || []
  }, [templateDraft])
  const isCoverageParsed = parsedCategoryKeys.length > 0
  const isParseStale = Boolean(
    templateDraft?.aiCoverage.length &&
      templateDraft?.lastParsedPrompt &&
      templateDraft.lastParsedPrompt !== templateDraft.prompt
  )
  const unknownParsedKeys = parsedCategoryKeys.filter((key) => !keyMap.has(key))
  const parsedKnownCategories = useMemo(() => {
    if (parsedCategoryKeys.length === 0) return []
    return categories
      .filter((category) => parsedCategoryKeys.includes(category.key))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive))
  }, [categories, parsedCategoryKeys])

  const unparsedActiveCategories = useMemo(() => {
    if (parsedCategoryKeys.length === 0) return []
    return activeCategories.filter((category) => !parsedCategoryKeys.includes(category.key))
  }, [activeCategories, parsedCategoryKeys])

  const templateCoverageMissing = useMemo(() => {
    if (!templateDraft) return []
    return activeCategories
      .filter((category) => !parsedCategoryKeys.includes(category.key))
      .map((category) => category.key)
  }, [templateDraft, activeCategories, parsedCategoryKeys])

  const coveredActiveCount = parsedCategoryKeys.filter((key) =>
    activeCategoryKeys.includes(key)
  ).length

  const refreshAll = () => {
    refetchCategories()
    refetchTemplates()
  }

  const openCategoryDialog = (category?: Category) => {
    setCategoryDraft({
      id: category?.id,
      originalKey: category?.key,
      key: category?.key || '',
      name: category?.name || '',
      description: category?.description || '',
      examplesText: (category?.examples || []).join('\n'),
      isActive: category?.isActive ?? true,
    })
    setCategoryDialogOpen(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryDraft) return
    setIsSavingCategory(true)

    const examples = categoryDraft.examplesText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

    const payload = {
      key: categoryDraft.key.trim(),
      name: categoryDraft.name.trim(),
      description: categoryDraft.description.trim(),
      examples,
      isActive: categoryDraft.isActive,
    }

    try {
      if (categoryDraft.id) {
        await categoriesApi.update(categoryDraft.id, payload)
        if (categoryDraft.originalKey && categoryDraft.originalKey !== payload.key) {
          toast({
            title: '分类标识已更新',
            description: '请重新解析模板覆盖以保持一致。',
          })
        }
      } else {
        await categoriesApi.create(payload)
      }

      await refetchCategories()
      setCategoryDialogOpen(false)
      setCategoryDraft(null)
    } catch (error) {
      toast({
        title: '保存分类失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setIsSavingCategory(false)
    }
  }

  const toggleCategoryActive = async (category: Category) => {
    setTogglingCategoryId(category.id)
    try {
      await categoriesApi.update(category.id, { isActive: !category.isActive })
      await refetchCategories()
    } catch (error) {
      toast({
        title: '更新分类失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setTogglingCategoryId(null)
    }
  }

  const parseCoverage = async (draft: TemplateDraft) => {
    setIsParsingCoverage(true)
    try {
      // For new templates (no id), use frontend pre-parsing
      // For existing templates, use AI backend parsing
      let aiCoverage: string[]

      if (!draft.id) {
        // Frontend pre-parsing for new templates
        aiCoverage = buildCoverageSuggestions(draft.prompt, categories)
        toast({
          title: '前端预解析完成',
          description: '新建提示词使用关键词匹配预解析，保存后可使用 AI 解析获得更准确结果。',
        })
      } else {
        // AI backend parsing for existing templates
        const response = await aiTemplatesApi.parseCoverage(draft.id, {
          prompt: draft.prompt,
          categories: categories.map((category) => ({
            key: category.key,
            name: category.name,
          })),
        })
        aiCoverage = response.data?.coverage || buildCoverageSuggestions(draft.prompt, categories)
      }

      const normalizedCoverage = Array.from(new Set(aiCoverage))
      setTemplateDraft((prev) =>
        prev
          ? {
              ...prev,
              aiCoverage: normalizedCoverage,
              confirmedCoverage: normalizedCoverage,
              lastParsedPrompt: draft.prompt,
            }
          : prev
      )
      setCoverageSampleInput('')
      setCoverageSample('')
      setSampleResult(null)
      setSampleError(null)
    } catch (error) {
      toast({
        title: '解析覆盖失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setIsParsingCoverage(false)
    }
  }

  const openTemplateDialog = (template?: AiTemplateVersion, parseOnOpen = false) => {
    const activeBase = templates.find((item) => item.isActive)
    const resolveCoverage = (item?: AiTemplateVersion) => {
      if (!item) return []
      return item.aiCoverage?.length ? item.aiCoverage : item.confirmedCoverage || []
    }
    const baseCoverage = template
      ? resolveCoverage(template)
      : resolveCoverage(activeBase)

    const draft: TemplateDraft = template
      ? {
          id: template.id,
          name: template.name,
          description: template.description || '',
          prompt: template.prompt,
          confirmedCoverage: [...baseCoverage],
          aiCoverage: [...baseCoverage],
          confirmedAt: template.confirmedAt,
          lastParsedPrompt: baseCoverage.length ? template.prompt : undefined,
        }
      : {
          id: undefined,
          name: activeBase ? `${activeBase.name} - 副本` : '新提示词版本',
          description: activeBase?.description || '',
          prompt: activeBase?.prompt || '',
          confirmedCoverage: [...baseCoverage],
          aiCoverage: [...baseCoverage],
          confirmedAt: activeBase?.confirmedAt,
          lastParsedPrompt: baseCoverage.length ? activeBase?.prompt : undefined,
        }

    setCoverageSampleInput('')
    setCoverageSample('')
    setSampleResult(null)
    setSampleError(null)
    setIsSampleRunning(false)
    setTemplateDraft(draft)
    setTemplateDialogOpen(true)

    if (parseOnOpen) {
      void parseCoverage(draft)
    }
  }

  const runSamplePreview = async () => {
    if (!templateDraft || isSampleRunning) return
    const sample = coverageSampleInput.trim()
    if (!sample) return
    if (!templateDraft.prompt.trim()) {
      toast({
        title: '请填写提示词内容',
        variant: 'destructive',
      })
      return
    }
    if (isParseStale) {
      toast({
        title: '覆盖已过期',
        description: '请先重新解析覆盖后再试运行。',
        variant: 'destructive',
      })
      return
    }
    if (parsedCategoryKeys.length === 0) {
      toast({
        title: '尚未解析覆盖',
        description: '请先解析覆盖后再试运行。',
        variant: 'destructive',
      })
      return
    }

    const parsedActiveCategories = parsedKnownCategories.filter(
      (category) => category.isActive
    )
    const previewCategories =
      parsedActiveCategories.length > 0 ? parsedActiveCategories : parsedKnownCategories

    if (previewCategories.length === 0) {
      toast({
        title: '没有可用分类',
        description: '请先完善分类或重新解析覆盖。',
        variant: 'destructive',
      })
      return
    }

    setIsSampleRunning(true)
    setSampleError(null)
    setSampleResult(null)
    setCoverageSample(sample)

    try {
      const response = await aiTemplatesApi.preview({
        prompt: templateDraft.prompt.trim(),
        content: sample,
        categories: previewCategories.map((category) => ({
          key: category.key,
          name: category.name,
        })),
      })

      if (!response.success || !response.data) {
        throw new Error(response.error || 'AI 试运行失败')
      }

      const allowedKeys = previewCategories.map((category) => category.key)
      const normalizedKey = String(response.data.category || '').trim()
      const categoryKey = allowedKeys.includes(normalizedKey)
        ? normalizedKey
        : allowedKeys[0]

      setSampleResult({
        categoryKey,
        confidence: response.data.confidence,
        reason: response.data.reason,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 试运行失败'
      setSampleError(message)
      toast({
        title: '试运行失败',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSampleRunning(false)
    }
  }

  const ignoreUnknownCoverageKey = (key: string) => {
    setTemplateDraft((prev) => {
      if (!prev) return prev
      if (!prev.aiCoverage.includes(key)) return prev
      return {
        ...prev,
        aiCoverage: prev.aiCoverage.filter((item) => item !== key),
        confirmedCoverage: prev.confirmedCoverage.filter((item) => item !== key),
      }
    })
  }

  const quickCreateCategoryFromUnknown = (key: string) => {
    // Open category dialog with pre-filled data for editing
    setTemplateDialogOpen(false)
    setCategoryDraft({
      key,
      name: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize first letter
      description: '',
      examplesText: '',
      isActive: true,
    })
    setCategoryDialogOpen(true)

    toast({
      title: '打开分类编辑',
      description: '请完善分类信息后保存，保存后可在模板中重新解析覆盖。',
    })
  }

  const handleSaveTemplate = async () => {
    if (!templateDraft) return

    // Validate required fields
    if (!templateDraft.name.trim()) {
      toast({
        title: '请填写版本名称',
        variant: 'destructive',
      })
      return
    }

    if (!templateDraft.prompt.trim()) {
      toast({
        title: '请填写提示词内容',
        variant: 'destructive',
      })
      return
    }

    // Warn about incomplete coverage but allow save
    const resolvedCoverage = templateDraft.aiCoverage.length
      ? templateDraft.aiCoverage
      : templateDraft.confirmedCoverage
    const missingKeys = activeCategoryKeys.filter(
      (key) => !resolvedCoverage.includes(key)
    )

    if (missingKeys.length > 0) {
      const missingNames = missingKeys.map((key) => keyMap.get(key) || key).join('、')
      toast({
        title: '覆盖不完整',
        description: `解析结果未覆盖以下分类：${missingNames}。保存后请调整提示词并重新解析，否则无法启用。`,
        variant: 'default',
      })
    }

    setIsSavingTemplate(true)

    const payload = {
      name: templateDraft.name.trim(),
      description: templateDraft.description.trim(),
      prompt: templateDraft.prompt.trim(),
      confirmedCoverage: resolvedCoverage,
      aiCoverage: resolvedCoverage,
    }

    try {
      if (templateDraft.id) {
        await aiTemplatesApi.update(templateDraft.id, payload)
      } else {
        await aiTemplatesApi.create(payload)
      }

      await refetchTemplates()
      setTemplateDialogOpen(false)
      setTemplateDraft(null)
      toast({
        title: '提示词保存成功',
        description: missingKeys.length === 0
          ? '解析结果已覆盖所有启用分类，可以启用。'
          : '请调整提示词并重新解析后再启用。',
      })
    } catch (error) {
      toast({
        title: '保存提示词失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const handleActivateTemplate = async (templateId: string) => {
    setActivatingTemplateId(templateId)
    try {
      await aiTemplatesApi.activate(templateId)
      await refetchTemplates()
    } catch (error) {
      toast({
        title: '启用失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setActivatingTemplateId(null)
    }
  }

  const getCoverageStatus = (template: AiTemplateVersion) => {
    const confirmed =
      template.aiCoverage?.length ? template.aiCoverage : template.confirmedCoverage || []

    if (confirmed.length === 0) {
      return {
        label: '未解析',
        variant: 'secondary' as const,
        missing: activeCategoryKeys,
        show: false,
      }
    }

    const missing = activeCategoryKeys.filter((key) => !confirmed.includes(key))

    if (missing.length > 0) {
      return {
        label: `缺失 ${missing.length}`,
        variant: 'destructive' as const,
        missing,
        show: true,
      }
    }

    // Coverage is complete, don't show a badge
    return { label: '', variant: 'secondary' as const, missing: [], show: false }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">分类管理</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCategoryDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            新增分类
          </Button>
          <Button variant="outline" onClick={() => openTemplateDialog()}>
            <Copy className="mr-2 h-4 w-4" />
            新建提示词版本
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>分类总数</CardTitle>
            <CardDescription>已配置的分类数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>启用分类</CardTitle>
            <CardDescription>参与分类的意图数量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCategories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>提示词版本</CardTitle>
            <CardDescription>历史版本数量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>覆盖缺失</CardTitle>
            <CardDescription>未覆盖的启用分类</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {activeTemplate ? missingCoverageKeys.length : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>分类列表</CardTitle>
          <CardDescription>启用分类将参与 AI 分类与分发规则</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>分类</TableHead>
                <TableHead className="hidden lg:table-cell">概览</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoriesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : categoryList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    暂无分类
                  </TableCell>
                </TableRow>
              ) : (
                categoryList.map((category) => {
                  const hasActiveTemplate = Boolean(activeTemplate)
                  const isCovered =
                    hasActiveTemplate && activeTemplateCoverage.includes(category.key)
                  const statusLabel = !isCovered
                    ? '未覆盖'
                    : category.isActive
                      ? '启用'
                      : '停用'
                  const statusVariant = !isCovered
                    ? 'destructive'
                    : category.isActive
                      ? 'default'
                      : 'secondary'
                  const nameLabel = category.name?.trim() || '未命名'
                  const keyLabel = category.key?.trim() || '—'
                  const descriptionLabel = category.description?.trim() || '—'
                  const previewExamples = (category.examples || []).slice(0, 1)
                  const extraExamples =
                    (category.examples?.length || 0) - previewExamples.length
                  const toggleDisabled =
                    togglingCategoryId === category.id || !isCovered
                  const toggleTitle = !isCovered
                    ? '模板未覆盖，无法操作'
                    : category.isActive
                      ? '停用分类'
                      : '启用分类'

                  return (
                    <TableRow key={category.id}>
                      <TableCell className="min-w-[160px]">
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{nameLabel}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {keyLabel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="text-sm text-muted-foreground truncate">
                            {descriptionLabel}
                          </div>
                          {previewExamples.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {previewExamples.map((example, index) => (
                                <Badge key={`${category.id}-${index}`} variant="secondary">
                                  {example}
                                </Badge>
                              ))}
                              {extraExamples > 0 && (
                                <Badge variant="outline">+{extraExamples}</Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={statusVariant} className="whitespace-nowrap">
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openCategoryDialog(category)}
                            aria-label="编辑分类"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleCategoryActive(category)}
                            aria-label={toggleTitle}
                            disabled={toggleDisabled}
                            title={toggleTitle}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>分类提示词管理</CardTitle>
          <CardDescription>
            启用前需覆盖所有启用分类。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templatesLoading ? (
            <div className="text-center text-muted-foreground">加载中...</div>
          ) : templateList.length === 0 ? (
            <div className="text-center text-muted-foreground">暂无提示词版本</div>
          ) : (
            templateList.map((template) => {
              const coverageStatus = getCoverageStatus(template)
              const canActivate = coverageStatus.missing.length === 0
              const snippet = template.prompt.slice(0, 90)

              return (
                <div key={template.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{template.name}</h3>
                        {template.isActive ? (
                          <Badge className="bg-green-600 text-white hover:bg-green-700">启用中</Badge>
                        ) : (
                          <Badge variant="secondary">未启用</Badge>
                        )}
                        {coverageStatus.show && (
                          <Badge variant={coverageStatus.variant}>
                            {coverageStatus.label}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {template.description || '—'}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {snippet}
                        {template.prompt.length > 90 ? '…' : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(() => {
                          const coverage =
                            template.aiCoverage?.length
                              ? template.aiCoverage
                              : template.confirmedCoverage || []
                          if (coverage.length === 0) {
                            return (
                              <span className="text-xs text-muted-foreground">
                                尚未解析覆盖
                              </span>
                            )
                          }
                          return coverage.map((key) => (
                            <Badge key={key} variant="outline">
                              {keyMap.get(key) || key}
                            </Badge>
                          ))
                        })()}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        创建时间：{formatDate(template.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTemplateDialog(template)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                      {(() => {
                        const isDisabled = template.isActive || !canActivate || activatingTemplateId === template.id
                        const tooltipText = template.isActive
                          ? '当前已启用'
                          : canActivate
                            ? '启用该版本'
                            : `需覆盖以下分类后才能启用：${coverageStatus.missing.map((key) => keyMap.get(key) || key).join('、')}`

                        if (isDisabled) {
                          // For disabled buttons, wrap with tooltip
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block">
                                  <Button
                                    size="sm"
                                    onClick={() => handleActivateTemplate(template.id)}
                                    disabled
                                  >
                                    启用
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{tooltipText}</p>
                              </TooltipContent>
                            </Tooltip>
                          )
                        }

                        // For enabled buttons, show without tooltip
                        return (
                          <Button
                            size="sm"
                            onClick={() => handleActivateTemplate(template.id)}
                          >
                            启用
                          </Button>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{categoryDraft?.id ? '编辑分类' : '新增分类'}</DialogTitle>
            <DialogDescription>
              分类用于 AI 意图识别和分发规则条件，停用分类不会删除历史数据。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="category-name">分类名称</Label>
              <Input
                id="category-name"
                value={categoryDraft?.name || ''}
                onChange={(event) =>
                  setCategoryDraft((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev
                  )
                }
                placeholder="例如：待办"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-key">分类标识</Label>
              <Input
                id="category-key"
                value={categoryDraft?.key || ''}
                onChange={(event) =>
                  setCategoryDraft((prev) =>
                    prev ? { ...prev, key: event.target.value } : prev
                  )
                }
                placeholder="例如：todo"
              />
              <p className="text-xs text-muted-foreground">
                建议使用英文小写，作为规则条件和 API 字段。
              </p>
              {categoryKeyConflict && (
                <p className="text-xs text-destructive">该标识已存在。</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-description">描述</Label>
              <Textarea
                id="category-description"
                value={categoryDraft?.description || ''}
                onChange={(event) =>
                  setCategoryDraft((prev) =>
                    prev ? { ...prev, description: event.target.value } : prev
                  )
                }
                placeholder="一句话描述该分类用于哪些内容"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-examples">示例</Label>
              <Textarea
                id="category-examples"
                value={categoryDraft?.examplesText || ''}
                onChange={(event) =>
                  setCategoryDraft((prev) =>
                    prev ? { ...prev, examplesText: event.target.value } : prev
                  )
                }
                placeholder="每行一个示例"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="category-active"
                checked={categoryDraft?.isActive ?? true}
                onCheckedChange={(checked) =>
                  setCategoryDraft((prev) =>
                    prev ? { ...prev, isActive: Boolean(checked) } : prev
                  )
                }
              />
              <Label htmlFor="category-active">启用该分类</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCategoryDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveCategory} disabled={!canSaveCategory || isSavingCategory}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {templateDraft?.id ? '编辑提示词版本' : '新建提示词版本'}
            </DialogTitle>
            <DialogDescription>
              AI 解析后生成覆盖结果，需覆盖所有启用分类才能启用。修改提示词后请重新解析。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="template-name">版本名称</Label>
              <Input
                id="template-name"
                value={templateDraft?.name || ''}
                onChange={(event) =>
                  setTemplateDraft((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev
                  )
                }
                placeholder="例如：默认分类提示词 v2"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-description">版本描述</Label>
              <Input
                id="template-description"
                value={templateDraft?.description || ''}
                onChange={(event) =>
                  setTemplateDraft((prev) =>
                    prev ? { ...prev, description: event.target.value } : prev
                  )
                }
                placeholder="描述此次版本变更"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-prompt">提示词内容</Label>
              <Textarea
                id="template-prompt"
                value={templateDraft?.prompt || ''}
                onChange={(event) => {
                  const nextPrompt = event.target.value
                  setTemplateDraft((prev) =>
                    prev ? { ...prev, prompt: nextPrompt } : prev
                  )
                  if (coverageSample || sampleResult || sampleError) {
                    setCoverageSample('')
                    setSampleResult(null)
                    setSampleError(null)
                  }
                }}
                placeholder="输入分类提示词或结构化指令"
                className="min-h-[160px]"
              />
              {isParseStale && (
                <p className="text-xs text-destructive">
                  覆盖已过期，需要重新解析。
                </p>
              )}
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">覆盖解析</h4>
                    {isParsingCoverage && (
                      <Badge variant="secondary">解析中</Badge>
                    )}
                    {isParseStale && <Badge variant="destructive">已过期</Badge>}
                    {templateCoverageMissing.length === 0 && parsedCategoryKeys.length > 0 && (
                      <Badge variant="default">覆盖完整</Badge>
                    )}
                    {parsedCategoryKeys.length > 0 && templateCoverageMissing.length > 0 && (
                      <Badge variant="destructive">
                        缺失 {templateCoverageMissing.length}
                      </Badge>
                    )}
                    {parsedCategoryKeys.length === 0 && <Badge variant="secondary">未解析</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    解析结果即覆盖结果，修改提示词后请重新解析。
                  </p>
                  {isParseStale && (
                    <p className="text-xs text-destructive">
                      覆盖已过期，需要重新解析。
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => templateDraft && parseCoverage(templateDraft)}
                  disabled={isParsingCoverage}
                >
                  {isParsingCoverage ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {isParsingCoverage ? '解析覆盖中…' : 'AI 解析覆盖'}
                </Button>
              </div>
              {isCoverageParsed ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      已覆盖 {coveredActiveCount}/{activeCategoryKeys.length}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        已覆盖 {coveredActiveCount}/{activeCategoryKeys.length}
                      </span>
                      {templateCoverageMissing.length > 0 ? (
                        <span className="text-destructive">
                          缺失 {templateCoverageMissing.length}
                        </span>
                      ) : (
                        <span className="text-green-600">风险低</span>
                      )}
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={[
                          'h-2 rounded-full transition-all',
                          templateCoverageMissing.length === activeCategoryKeys.length
                            ? 'bg-destructive'
                            : templateCoverageMissing.length > 0
                              ? 'bg-amber-500'
                              : 'bg-green-600',
                        ].join(' ')}
                        style={{
                          width: `${
                            activeCategoryKeys.length === 0
                              ? 0
                              : Math.min(
                                  100,
                                  Math.round(
                                    (coveredActiveCount / activeCategoryKeys.length) *
                                      100
                                  )
                                )
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">已解析</div>
                        <Badge variant="outline">{parsedKnownCategories.length}</Badge>
                      </div>
                      {parsedKnownCategories.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {parsedKnownCategories.map((category) => (
                            <Badge key={category.key} variant="outline">
                              {category.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">无</p>
                      )}
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">未解析</div>
                        <Badge variant="outline">{unparsedActiveCategories.length}</Badge>
                      </div>
                      {unparsedActiveCategories.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {unparsedActiveCategories.map((category) => (
                            <Badge key={category.key} variant="secondary">
                              {category.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">已全部解析</p>
                      )}
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">未知</div>
                        <Badge variant="outline">{unknownParsedKeys.length}</Badge>
                      </div>
                      {unknownParsedKeys.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {unknownParsedKeys.map((key) => (
                            <div key={key} className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{key}</Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void quickCreateCategoryFromUnknown(key)}
                                disabled={isParsingCoverage || isParseStale}
                              >
                                新建分类
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => ignoreUnknownCoverageKey(key)}
                                disabled={isParsingCoverage || isParseStale}
                              >
                                忽略
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">无</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border p-3 space-y-2">
                    <div className="text-sm font-medium">试运行</div>
                    <div className="text-xs text-muted-foreground">
                      输入一句示例内容，调用 AI 进行一次分类预览。
                    </div>
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-2">
                      <div className="flex items-start gap-2 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          <strong>注意：</strong>试运行会调用 AI，结果可能受模型与配置影响。
                          保存模板后，建议使用真实数据验证分类准确性。
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
                      <div className="grid gap-2">
                        <Label htmlFor="coverage-sample">示例内容</Label>
                        <Input
                          id="coverage-sample"
                          value={coverageSampleInput}
                          onChange={(event) => {
                            setCoverageSampleInput(event.target.value)
                            if (coverageSample) setCoverageSample('')
                            if (sampleResult) setSampleResult(null)
                            if (sampleError) setSampleError(null)
                          }}
                          placeholder="例如：明天 10 点和张三开会"
                          disabled={isParsingCoverage || isSampleRunning}
                        />
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={runSamplePreview}
                        disabled={
                          isParsingCoverage ||
                          isSampleRunning ||
                          !coverageSampleInput.trim()
                        }
                      >
                        {isSampleRunning && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {isSampleRunning ? '试运行中…' : '试运行'}
                      </Button>
                    </div>
                    {coverageSample.trim().length > 0 ? (
                      isSampleRunning ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>AI 试运行中…</span>
                        </div>
                      ) : sampleResult ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="default">命中</Badge>
                            <span>
                              {keyMap.get(sampleResult.categoryKey) ||
                                sampleResult.categoryKey}
                            </span>
                            <Badge variant="outline">{sampleResult.categoryKey}</Badge>
                            {typeof sampleResult.confidence === 'number' && (
                              <Badge variant="outline">
                                置信 {Math.round(sampleResult.confidence * 100)}%
                              </Badge>
                            )}
                          </div>
                          {sampleResult.reason && (
                            <p className="text-xs text-muted-foreground">
                              理由：{sampleResult.reason}
                            </p>
                          )}
                        </div>
                      ) : sampleError ? (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <Badge variant="destructive">失败</Badge>
                          <span>{sampleError}</span>
                        </div>
                      ) : null
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium">
                      {isParsingCoverage ? '解析覆盖中…' : '先解析'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isParsingCoverage
                        ? '正在生成覆盖建议，请稍候。'
                        : '未解析时仅展示空态；解析后会展示覆盖差异与风险提示。'}
                    </div>
                  </div>
                </div>
              )}
              {isCoverageParsed && templateCoverageMissing.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>
                    启用前需覆盖：
                    {templateCoverageMissing
                      .map((key) => keyMap.get(key) || key)
                      .join('、')}
                  </span>
                </div>
              )}
              {isCoverageParsed &&
                templateCoverageMissing.length === 0 &&
                parsedCategoryKeys.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-green-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4" />
                    <span>已覆盖所有启用分类，可以启用。</span>
                  </div>
                )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTemplateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
              保存提示词版本
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
