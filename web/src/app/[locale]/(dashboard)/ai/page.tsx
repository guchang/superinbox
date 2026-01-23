"use client"

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
import { getApiErrorMessage, type ApiError } from '@/lib/i18n/api-errors'

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
  const t = useTranslations('aiPage')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const locale = useLocale()
  const formatDate = (value?: string) =>
    value ? new Intl.DateTimeFormat(locale).format(new Date(value)) : common('empty')
  const listSeparator = t('listSeparator')
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
            title: t('toasts.categoryKeyUpdated.title'),
            description: t('toasts.categoryKeyUpdated.description'),
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
        title: t('toasts.categorySaveFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
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
        title: t('toasts.categoryUpdateFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
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
          title: t('toasts.frontendParsed.title'),
          description: t('toasts.frontendParsed.description'),
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
        title: t('toasts.coverageParseFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
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
          name: activeBase
            ? t('templates.copyName', { name: activeBase.name })
            : t('templates.newVersion'),
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
        title: t('toasts.promptRequired.title'),
        variant: 'destructive',
      })
      return
    }
    if (isParseStale) {
      toast({
        title: t('toasts.coverageStale.title'),
        description: t('toasts.coverageStale.description'),
        variant: 'destructive',
      })
      return
    }
    if (parsedCategoryKeys.length === 0) {
      toast({
        title: t('toasts.coverageMissing.title'),
        description: t('toasts.coverageMissing.description'),
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
        title: t('toasts.noAvailableCategories.title'),
        description: t('toasts.noAvailableCategories.description'),
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
        const apiError = new Error(
          response.error || response.message || t('errors.sampleRunFailed')
        ) as ApiError
        apiError.code = response.code
        apiError.params = response.params
        throw apiError
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
      const message = getApiErrorMessage(error, errors, t('errors.sampleRunFailed'))
      setSampleError(message)
      toast({
        title: t('toasts.sampleRunFailed.title'),
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
      title: t('toasts.openCategoryEditor.title'),
      description: t('toasts.openCategoryEditor.description'),
    })
  }

  const handleSaveTemplate = async () => {
    if (!templateDraft) return

    // Validate required fields
    if (!templateDraft.name.trim()) {
      toast({
        title: t('toasts.templateNameRequired.title'),
        variant: 'destructive',
      })
      return
    }

    if (!templateDraft.prompt.trim()) {
      toast({
        title: t('toasts.promptRequired.title'),
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
      const missingNames = missingKeys
        .map((key) => keyMap.get(key) || key)
        .join(listSeparator)
      toast({
        title: t('toasts.coverageIncomplete.title'),
        description: t('toasts.coverageIncomplete.description', {
          categories: missingNames,
        }),
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
        title: t('toasts.templateSaved.title'),
        description:
          missingKeys.length === 0
            ? t('toasts.templateSaved.descriptionComplete')
            : t('toasts.templateSaved.descriptionIncomplete'),
      })
    } catch (error) {
      toast({
        title: t('toasts.templateSaveFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
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
        title: t('toasts.templateActivateFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
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
        label: t('coverage.badge.notParsed'),
        variant: 'secondary' as const,
        missing: activeCategoryKeys,
        show: false,
      }
    }

    const missing = activeCategoryKeys.filter((key) => !confirmed.includes(key))

    if (missing.length > 0) {
      return {
        label: t('coverage.badge.missing', { count: missing.length }),
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
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCategoryDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            {t('actions.addCategory')}
          </Button>
          <Button variant="outline" onClick={() => openTemplateDialog()}>
            <Copy className="mr-2 h-4 w-4" />
            {t('actions.newTemplate')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.totalCategories.title')}</CardTitle>
            <CardDescription>{t('stats.totalCategories.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.activeCategories.title')}</CardTitle>
            <CardDescription>{t('stats.activeCategories.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCategories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.templateVersions.title')}</CardTitle>
            <CardDescription>{t('stats.templateVersions.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.missingCoverage.title')}</CardTitle>
            <CardDescription>{t('stats.missingCoverage.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {activeTemplate ? missingCoverageKeys.length : common('empty')}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('categoryList.title')}</CardTitle>
          <CardDescription>{t('categoryList.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>{t('categoryList.headers.category')}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('categoryList.headers.overview')}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t('categoryList.headers.status')}
                </TableHead>
                <TableHead className="text-right">
                  {t('categoryList.headers.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoriesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {common('loading')}
                  </TableCell>
                </TableRow>
              ) : categoryList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t('categoryList.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                categoryList.map((category) => {
                  const hasActiveTemplate = Boolean(activeTemplate)
                  const isCovered =
                    hasActiveTemplate && activeTemplateCoverage.includes(category.key)
                  const statusLabel = !isCovered
                    ? t('status.uncovered')
                    : category.isActive
                      ? t('status.active')
                      : t('status.inactive')
                  const statusVariant = !isCovered
                    ? 'destructive'
                    : category.isActive
                      ? 'default'
                      : 'secondary'
                  const nameLabel = category.name?.trim() || t('labels.unnamed')
                  const keyLabel = category.key?.trim() || common('empty')
                  const descriptionLabel = category.description?.trim() || common('empty')
                  const previewExamples = (category.examples || []).slice(0, 1)
                  const extraExamples =
                    (category.examples?.length || 0) - previewExamples.length
                  const toggleDisabled =
                    togglingCategoryId === category.id || !isCovered
                  const toggleTitle = !isCovered
                    ? t('actions.coverageRequired')
                    : category.isActive
                      ? t('actions.disableCategory')
                      : t('actions.enableCategory')

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
                            <span className="text-xs text-muted-foreground">
                              {common('empty')}
                            </span>
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
                            aria-label={t('actions.editCategory')}
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
          <CardTitle>{t('templateSection.title')}</CardTitle>
          <CardDescription>
            {t('templateSection.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templatesLoading ? (
            <div className="text-center text-muted-foreground">{common('loading')}</div>
          ) : templateList.length === 0 ? (
            <div className="text-center text-muted-foreground">
              {t('templateSection.empty')}
            </div>
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
                          <Badge className="bg-green-600 text-white hover:bg-green-700">
                            {t('templateSection.status.active')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {t('templateSection.status.inactive')}
                          </Badge>
                        )}
                        {coverageStatus.show && (
                          <Badge variant={coverageStatus.variant}>
                            {coverageStatus.label}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {template.description || common('empty')}
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
                                {t('templateSection.notParsed')}
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
                        {t('templateSection.createdAt', {
                          date: formatDate(template.createdAt),
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTemplateDialog(template)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('actions.edit')}
                      </Button>
                      {(() => {
                        const isDisabled = template.isActive || !canActivate || activatingTemplateId === template.id
                        const tooltipText = template.isActive
                          ? t('templateSection.tooltip.active')
                          : canActivate
                            ? t('templateSection.tooltip.enable')
                            : t('templateSection.tooltip.missingCoverage', {
                                categories: coverageStatus.missing
                                  .map((key) => keyMap.get(key) || key)
                                  .join(listSeparator),
                              })

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
                                    {t('actions.enable')}
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
                            {t('actions.enable')}
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
            <DialogTitle>
              {categoryDraft?.id
                ? t('categoryDialog.titleEdit')
                : t('categoryDialog.titleCreate')}
            </DialogTitle>
            <DialogDescription>
              {t('categoryDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="category-name">
                {t('categoryDialog.fields.name.label')}
              </Label>
              <Input
                id="category-name"
                value={categoryDraft?.name || ''}
                onChange={(event) =>
                  setCategoryDraft((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev
                  )
                }
                placeholder={t('categoryDialog.fields.name.placeholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-key">
                {t('categoryDialog.fields.key.label')}
              </Label>
              <Input
                id="category-key"
                value={categoryDraft?.key || ''}
                onChange={(event) =>
                  setCategoryDraft((prev) =>
                    prev ? { ...prev, key: event.target.value } : prev
                  )
                }
                placeholder={t('categoryDialog.fields.key.placeholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('categoryDialog.fields.key.hint')}
              </p>
              {categoryKeyConflict && (
                <p className="text-xs text-destructive">
                  {t('categoryDialog.fields.key.conflict')}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-description">
                {t('categoryDialog.fields.description.label')}
              </Label>
              <Textarea
                id="category-description"
                value={categoryDraft?.description || ''}
                onChange={(event) =>
                  setCategoryDraft((prev) =>
                    prev ? { ...prev, description: event.target.value } : prev
                  )
                }
                placeholder={t('categoryDialog.fields.description.placeholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-examples">
                {t('categoryDialog.fields.examples.label')}
              </Label>
              <Textarea
                id="category-examples"
                value={categoryDraft?.examplesText || ''}
                onChange={(event) =>
                  setCategoryDraft((prev) =>
                    prev ? { ...prev, examplesText: event.target.value } : prev
                  )
                }
                placeholder={t('categoryDialog.fields.examples.placeholder')}
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
              <Label htmlFor="category-active">
                {t('categoryDialog.fields.active.label')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCategoryDialogOpen(false)}>
              {common('cancel')}
            </Button>
            <Button onClick={handleSaveCategory} disabled={!canSaveCategory || isSavingCategory}>
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {templateDraft?.id
                ? t('templateDialog.titleEdit')
                : t('templateDialog.titleCreate')}
            </DialogTitle>
            <DialogDescription>
              {t('templateDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="template-name">
                {t('templateDialog.fields.name.label')}
              </Label>
              <Input
                id="template-name"
                value={templateDraft?.name || ''}
                onChange={(event) =>
                  setTemplateDraft((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev
                  )
                }
                placeholder={t('templateDialog.fields.name.placeholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-description">
                {t('templateDialog.fields.description.label')}
              </Label>
              <Input
                id="template-description"
                value={templateDraft?.description || ''}
                onChange={(event) =>
                  setTemplateDraft((prev) =>
                    prev ? { ...prev, description: event.target.value } : prev
                  )
                }
                placeholder={t('templateDialog.fields.description.placeholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-prompt">
                {t('templateDialog.fields.prompt.label')}
              </Label>
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
                placeholder={t('templateDialog.fields.prompt.placeholder')}
                className="min-h-[160px]"
              />
              {isParseStale && (
                <p className="text-xs text-destructive">
                  {t('templateDialog.coverage.staleHint')}
                </p>
              )}
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{t('templateDialog.coverage.title')}</h4>
                    {isParsingCoverage && (
                      <Badge variant="secondary">
                        {t('templateDialog.coverage.badges.parsing')}
                      </Badge>
                    )}
                    {isParseStale && (
                      <Badge variant="destructive">
                        {t('templateDialog.coverage.badges.stale')}
                      </Badge>
                    )}
                    {templateCoverageMissing.length === 0 && parsedCategoryKeys.length > 0 && (
                      <Badge variant="default">
                        {t('templateDialog.coverage.badges.complete')}
                      </Badge>
                    )}
                    {parsedCategoryKeys.length > 0 && templateCoverageMissing.length > 0 && (
                      <Badge variant="destructive">
                        {t('templateDialog.coverage.badges.missing', {
                          count: templateCoverageMissing.length,
                        })}
                      </Badge>
                    )}
                    {parsedCategoryKeys.length === 0 && (
                      <Badge variant="secondary">
                        {t('templateDialog.coverage.badges.notParsed')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('templateDialog.coverage.hint')}
                  </p>
                  {isParseStale && (
                    <p className="text-xs text-destructive">
                      {t('templateDialog.coverage.staleHint')}
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
                  {isParsingCoverage
                    ? t('templateDialog.coverage.actions.parsing')
                    : t('templateDialog.coverage.actions.parse')}
                </Button>
              </div>
              {isCoverageParsed ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {t('templateDialog.coverage.summary.covered', {
                        covered: coveredActiveCount,
                        total: activeCategoryKeys.length,
                      })}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t('templateDialog.coverage.summary.covered', {
                          covered: coveredActiveCount,
                          total: activeCategoryKeys.length,
                        })}
                      </span>
                      {templateCoverageMissing.length > 0 ? (
                        <span className="text-destructive">
                          {t('templateDialog.coverage.summary.missing', {
                            count: templateCoverageMissing.length,
                          })}
                        </span>
                      ) : (
                        <span className="text-green-600">
                          {t('templateDialog.coverage.summary.lowRisk')}
                        </span>
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
                        <div className="text-sm font-medium">
                          {t('templateDialog.coverage.sections.parsed')}
                        </div>
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
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('templateDialog.coverage.sections.empty')}
                        </p>
                      )}
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          {t('templateDialog.coverage.sections.unparsed')}
                        </div>
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
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('templateDialog.coverage.sections.allParsed')}
                        </p>
                      )}
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          {t('templateDialog.coverage.sections.unknown')}
                        </div>
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
                                {t('templateDialog.coverage.actions.createCategory')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => ignoreUnknownCoverageKey(key)}
                                disabled={isParsingCoverage || isParseStale}
                              >
                                {t('templateDialog.coverage.actions.ignore')}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('templateDialog.coverage.sections.empty')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border p-3 space-y-2">
                    <div className="text-sm font-medium">
                      {t('templateDialog.sample.title')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('templateDialog.sample.description')}
                    </div>
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-2">
                      <div className="flex items-start gap-2 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          {t('templateDialog.sample.warning')}
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
                      <div className="grid gap-2">
                        <Label htmlFor="coverage-sample">
                          {t('templateDialog.sample.label')}
                        </Label>
                        <Input
                          id="coverage-sample"
                          value={coverageSampleInput}
                          onChange={(event) => {
                            setCoverageSampleInput(event.target.value)
                            if (coverageSample) setCoverageSample('')
                            if (sampleResult) setSampleResult(null)
                            if (sampleError) setSampleError(null)
                          }}
                          placeholder={t('templateDialog.sample.placeholder')}
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
                        {isSampleRunning
                          ? t('templateDialog.sample.running')
                          : t('templateDialog.sample.run')}
                      </Button>
                    </div>
                    {coverageSample.trim().length > 0 ? (
                      isSampleRunning ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t('templateDialog.sample.runningInline')}</span>
                        </div>
                      ) : sampleResult ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="default">
                              {t('templateDialog.sample.hit')}
                            </Badge>
                            <span>
                              {keyMap.get(sampleResult.categoryKey) ||
                                sampleResult.categoryKey}
                            </span>
                            <Badge variant="outline">{sampleResult.categoryKey}</Badge>
                            {typeof sampleResult.confidence === 'number' && (
                              <Badge variant="outline">
                                {t('templateDialog.sample.confidence', {
                                  percent: Math.round(sampleResult.confidence * 100),
                                })}
                              </Badge>
                            )}
                          </div>
                          {sampleResult.reason && (
                            <p className="text-xs text-muted-foreground">
                              {t('templateDialog.sample.reason', {
                                reason: sampleResult.reason,
                              })}
                            </p>
                          )}
                        </div>
                      ) : sampleError ? (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <Badge variant="destructive">
                            {t('templateDialog.sample.failed')}
                          </Badge>
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
                      {isParsingCoverage
                        ? t('templateDialog.coverage.emptyState.titleParsing')
                        : t('templateDialog.coverage.emptyState.titleIdle')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isParsingCoverage
                        ? t('templateDialog.coverage.emptyState.descriptionParsing')
                        : t('templateDialog.coverage.emptyState.descriptionIdle')}
                    </div>
                  </div>
                </div>
              )}
              {isCoverageParsed && templateCoverageMissing.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>
                    {t('templateDialog.coverage.alertMissing', {
                      categories: templateCoverageMissing
                        .map((key) => keyMap.get(key) || key)
                        .join(listSeparator),
                    })}
                  </span>
                </div>
              )}
              {isCoverageParsed &&
                templateCoverageMissing.length === 0 &&
                parsedCategoryKeys.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-green-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4" />
                    <span>{t('templateDialog.coverage.alertComplete')}</span>
                  </div>
                )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTemplateDialogOpen(false)}>
              {common('cancel')}
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
              {t('templateDialog.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
