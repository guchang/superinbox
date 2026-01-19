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
    return [...categories].sort((a, b) => Number(b.isActive) - Number(a.isActive))
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
    return [...templates].sort((a, b) => Number(b.isActive) - Number(a.isActive))
  }, [templates])

  const keyMap = useMemo(() => {
    return new Map(categories.map((category) => [category.key, category.name]))
  }, [categories])

  const missingCoverageKeys = useMemo(() => {
    if (!activeTemplate) return activeCategoryKeys
    return activeCategoryKeys.filter(
      (key) => !activeTemplate.confirmedCoverage.includes(key)
    )
  }, [activeTemplate, activeCategoryKeys])

  const categoryKeyConflict = useMemo(() => {
    if (!categoryDraft?.key) return false
    return categories.some(
      (category) =>
        category.key === categoryDraft.key && category.id !== categoryDraft.id
    )
  }, [categories, categoryDraft])

  const templateCoverageMissing = useMemo(() => {
    if (!templateDraft) return []
    return activeCategories
      .filter((category) => !templateDraft.confirmedCoverage.includes(category.key))
      .map((category) => category.key)
  }, [templateDraft, activeCategories])

  const canSaveCategory =
    categoryDraft &&
    categoryDraft.name.trim().length > 0 &&
    categoryDraft.key.trim().length > 0 &&
    !categoryKeyConflict

  const isRefreshing = categoriesFetching || templatesFetching

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
    if (!draft.id) {
      toast({
        title: '请先保存模板版本',
        description: '保存后再进行 AI 解析覆盖。',
        variant: 'destructive',
      })
      return
    }

    setIsParsingCoverage(true)
    try {
      const response = await aiTemplatesApi.parseCoverage(draft.id, {
        prompt: draft.prompt,
        categories: categories.map((category) => ({
          key: category.key,
          name: category.name,
        })),
      })
      const aiCoverage = response.data?.coverage ||
        buildCoverageSuggestions(draft.prompt, categories)

      setTemplateDraft((prev) =>
        prev
          ? {
              ...prev,
              aiCoverage,
              confirmedCoverage:
                prev.confirmedCoverage.length > 0
                  ? prev.confirmedCoverage
                  : aiCoverage,
            }
          : prev
      )
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

    const draft: TemplateDraft = template
      ? {
          id: template.id,
          name: template.name,
          description: template.description || '',
          prompt: template.prompt,
          confirmedCoverage: [...(template.confirmedCoverage || [])],
          aiCoverage: [...(template.aiCoverage || [])],
          confirmedAt: template.confirmedAt,
        }
      : {
          id: undefined,
          name: activeBase ? `${activeBase.name} - 副本` : '新模板版本',
          description: activeBase?.description || '',
          prompt: activeBase?.prompt || '',
          confirmedCoverage: activeBase?.confirmedCoverage || [],
          aiCoverage: activeBase?.aiCoverage || [],
          confirmedAt: activeBase?.confirmedAt,
        }

    setTemplateDraft(draft)
    setTemplateDialogOpen(true)

    if (parseOnOpen) {
      void parseCoverage(draft)
    }
  }

  const handleToggleCoverageKey = (key: string) => {
    setTemplateDraft((prev) => {
      if (!prev) return prev
      const exists = prev.confirmedCoverage.includes(key)
      const nextCoverage = exists
        ? prev.confirmedCoverage.filter((item) => item !== key)
        : [...prev.confirmedCoverage, key]
      return { ...prev, confirmedCoverage: nextCoverage }
    })
  }

  const handleSaveTemplate = async () => {
    if (!templateDraft) return
    setIsSavingTemplate(true)

    const payload = {
      name: templateDraft.name.trim(),
      description: templateDraft.description.trim(),
      prompt: templateDraft.prompt.trim(),
      confirmedCoverage: templateDraft.confirmedCoverage,
      aiCoverage: templateDraft.aiCoverage,
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
    } catch (error) {
      toast({
        title: '保存模板失败',
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
    const confirmed = template.confirmedCoverage || []

    if (confirmed.length === 0) {
      return { label: '未确认', variant: 'secondary' as const, missing: activeCategoryKeys }
    }

    const missing = activeCategoryKeys.filter((key) => !confirmed.includes(key))

    if (missing.length > 0) {
      return {
        label: `缺失 ${missing.length}`,
        variant: 'destructive' as const,
        missing,
      }
    }

    return { label: '覆盖完整', variant: 'default' as const, missing: [] }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">分类管理</h1>
          <p className="text-muted-foreground">
            管理意图分类与单模板分类策略，覆盖结果需人工确认。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCategoryDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            新增分类
          </Button>
          <Button variant="outline" onClick={() => openTemplateDialog()}>
            <Copy className="mr-2 h-4 w-4" />
            新建模板版本
          </Button>
          <Button variant="ghost" onClick={refreshAll} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
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
            <CardTitle>模板版本</CardTitle>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>分类</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>示例</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>覆盖</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoriesLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : categoryList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无分类
                  </TableCell>
                </TableRow>
              ) : (
                categoryList.map((category) => {
                  const isCovered =
                    activeTemplate &&
                    activeTemplate.confirmedCoverage.includes(category.key)
                  const coverVariant = category.isActive
                    ? isCovered
                      ? 'default'
                      : 'destructive'
                    : 'outline'
                  const coverLabel = category.isActive
                    ? isCovered
                      ? '已覆盖'
                      : '缺失'
                    : '不参与'

                  return (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="font-medium">{category.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {category.key}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {category.description || '—'}
                      </TableCell>
                      <TableCell>
                        {category.examples && category.examples.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {category.examples.slice(0, 2).map((example, index) => (
                              <Badge key={`${category.id}-${index}`} variant="secondary">
                                {example}
                              </Badge>
                            ))}
                            {category.examples.length > 2 && (
                              <Badge variant="outline">
                                +{category.examples.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={category.isActive ? 'default' : 'secondary'}>
                          {category.isActive ? '启用' : '停用'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={coverVariant}>{coverLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openCategoryDialog(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleCategoryActive(category)}
                            aria-label={category.isActive ? '停用分类' : '启用分类'}
                            disabled={togglingCategoryId === category.id}
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
          <CardTitle>分类模板版本</CardTitle>
          <CardDescription>
            单模板分类策略，启用前需确认覆盖所有启用分类。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">
                    {activeTemplate ? activeTemplate.name : '暂无启用模板'}
                  </h3>
                  {activeTemplate ? (
                    <Badge variant="default">启用中</Badge>
                  ) : (
                    <Badge variant="secondary">未启用</Badge>
                  )}
                  {activeTemplate && missingCoverageKeys.length > 0 && (
                    <Badge variant="destructive">
                      缺失 {missingCoverageKeys.length}
                    </Badge>
                  )}
                  {activeTemplate && missingCoverageKeys.length === 0 && (
                    <Badge variant="default">覆盖完整</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeTemplate?.description ||
                    '请启用一个模板版本以进行分类。'}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  最近确认覆盖：{formatDate(activeTemplate?.confirmedAt)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeTemplate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTemplateDialog(activeTemplate, true)}
                    disabled={isParsingCoverage}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    解析覆盖
                  </Button>
                )}
                {activeTemplate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTemplateDialog(activeTemplate)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    编辑模板
                  </Button>
                )}
              </div>
            </div>
          </div>

          {templatesLoading ? (
            <div className="text-center text-muted-foreground">加载中...</div>
          ) : templateList.length === 0 ? (
            <div className="text-center text-muted-foreground">暂无模板版本</div>
          ) : (
            templateList.map((template) => {
              const coverageStatus = getCoverageStatus(template)
              const canActivate = coverageStatus.missing.length === 0
              const snippet = template.prompt.slice(0, 90)

              return (
                <div key={template.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{template.name}</h3>
                        <Badge variant={template.isActive ? 'default' : 'secondary'}>
                          {template.isActive ? '启用' : '未启用'}
                        </Badge>
                        <Badge variant={coverageStatus.variant}>
                          {coverageStatus.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {template.description || '—'}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {snippet}
                        {template.prompt.length > 90 ? '…' : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {template.confirmedCoverage.length > 0 ? (
                          template.confirmedCoverage.map((key) => (
                            <Badge key={key} variant="outline">
                              {keyMap.get(key) || key}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            尚未确认覆盖
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTemplateDialog(template, true)}
                        disabled={isParsingCoverage}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        解析覆盖
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTemplateDialog(template)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleActivateTemplate(template.id)}
                        disabled={!canActivate || activatingTemplateId === template.id}
                        title={
                          canActivate
                            ? '启用该版本'
                            : '需覆盖所有启用分类后才能启用'
                        }
                      >
                        启用
                      </Button>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {templateDraft?.id ? '编辑模板版本' : '新建模板版本'}
            </DialogTitle>
            <DialogDescription>
              AI 解析覆盖后需人工确认，启用前确保覆盖所有启用分类。
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
                placeholder="例如：默认分类模板 v2"
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
              <Label htmlFor="template-prompt">模板内容</Label>
              <Textarea
                id="template-prompt"
                value={templateDraft?.prompt || ''}
                onChange={(event) =>
                  setTemplateDraft((prev) =>
                    prev ? { ...prev, prompt: event.target.value } : prev
                  )
                }
                placeholder="输入分类提示词或结构化指令"
                className="min-h-[160px]"
              />
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">覆盖确认</h4>
                    {templateCoverageMissing.length === 0 &&
                      templateDraft?.confirmedCoverage?.length > 0 && (
                        <Badge variant="default">覆盖完整</Badge>
                      )}
                    {templateCoverageMissing.length > 0 && (
                      <Badge variant="destructive">
                        缺失 {templateCoverageMissing.length}
                      </Badge>
                    )}
                    {templateDraft?.confirmedCoverage?.length === 0 && (
                      <Badge variant="secondary">未确认</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI 解析得到候选分类后，请手动勾选确认。
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => templateDraft && parseCoverage(templateDraft)}
                  disabled={isParsingCoverage}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI 解析覆盖
                </Button>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AI 解析结果</p>
                {templateDraft?.aiCoverage?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {templateDraft.aiCoverage.map((key) => (
                      <Badge key={key} variant="outline">
                        {keyMap.get(key) || key}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    尚未解析覆盖分类
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                {categories.map((category) => (
                  <label
                    key={category.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={templateDraft?.confirmedCoverage.includes(category.key)}
                      onCheckedChange={() => handleToggleCoverageKey(category.key)}
                    />
                    <span>{category.name}</span>
                    {!category.isActive && (
                      <Badge variant="outline">已停用</Badge>
                    )}
                  </label>
                ))}
              </div>
              {templateCoverageMissing.length > 0 && (
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
              {templateCoverageMissing.length === 0 &&
                templateDraft?.confirmedCoverage.length > 0 && (
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
              保存版本
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
