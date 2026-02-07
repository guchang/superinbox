"use client"

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LayoutGrid, Library, List, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { categoriesApi, type CategoryPromptGenerateMode } from '@/lib/api/categories'
import type { Category } from '@/types'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { useIsMobile } from '@/hooks/use-is-mobile'
import {
  CATEGORY_LIBRARY_SCENARIOS,
  getLocalizedCategoryLibraryCategory,
} from '@/lib/category-library'
import {
  CATEGORY_ICON_OPTIONS,
  getCategoryBadgeStyle,
  getCategoryIconComponent,
  getCategorySoftStyle,
  hasCategoryDefaultAppearance,
  resolveCategoryColor,
  resolveCategoryIconName,
} from '@/lib/category-appearance'

type CategoryDraft = {
  id?: string
  originalKey?: string
  key: string
  name: string
  description: string
  examplesText: string
  icon: string
  color: string
  isActive: boolean
}

const UNKNOWN_CATEGORY_KEY = 'unknown'
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

const normalizeDraftColor = (value?: string): string => String(value ?? '').trim().toLowerCase()

const isDraftColorValid = (value?: string): boolean => {
  const normalized = normalizeDraftColor(value)
  return !normalized || HEX_COLOR_PATTERN.test(normalized)
}

const isUnknownCategory = (
  category?: Pick<CategoryDraft, 'key'> | Pick<Category, 'key'> | null
) => category?.key?.trim().toLowerCase() === UNKNOWN_CATEGORY_KEY

const createLibrarySelectionKey = (scenarioId: string, categoryKey: string) =>
  `${scenarioId}::${categoryKey.trim().toLowerCase()}`

export default function CategoryPage() {
  const { toast } = useToast()
  const t = useTranslations('aiPage')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [togglingCategoryId, setTogglingCategoryId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [promptDraft, setPromptDraft] = useState('')
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
  const [isRollingBackPrompt, setIsRollingBackPrompt] = useState(false)
  const [isPreviousPromptPreviewOpen, setIsPreviousPromptPreviewOpen] = useState(false)
  const [isAdvancedPromptOpen, setIsAdvancedPromptOpen] = useState(false)
  const [isGeneratePromptDialogOpen, setIsGeneratePromptDialogOpen] = useState(false)
  const [promptGenerateMode, setPromptGenerateMode] =
    useState<CategoryPromptGenerateMode>('low_cost')
  const [promptGenerateRequirement, setPromptGenerateRequirement] = useState('')
  const [isLibraryDialogOpen, setIsLibraryDialogOpen] = useState(false)
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([])
  const [selectedCategorySelection, setSelectedCategorySelection] = useState<Set<string>>(
    () => new Set<string>()
  )
  const [isApplyingLibrary, setIsApplyingLibrary] = useState(false)
  const isMobile = useIsMobile()

  // Load view mode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('category-view-mode')
    if (saved === 'list' || saved === 'grid') {
      setViewMode(saved)
    }
  }, [])

  useEffect(() => {
    if (isMobile) {
      setViewMode('grid')
    }
  }, [isMobile])

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('category-view-mode', viewMode)
  }, [viewMode])

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const {
    data: categoryPromptData,
    isLoading: categoryPromptLoading,
    refetch: refetchCategoryPrompt,
  } = useQuery({
    queryKey: ['categories-prompt'],
    queryFn: () => categoriesApi.getPrompt(),
  })

  const categoryPrompt = categoryPromptData?.data

  useEffect(() => {
    if (categoryPrompt) {
      setPromptDraft(categoryPrompt.prompt)
    }
  }, [categoryPrompt])

  const categories = useMemo(() => {
    return (categoriesData?.data || []).map((category) => ({
      ...category,
      examples: category.examples || [],
      icon: resolveCategoryIconName(category.key, category.icon),
      color: resolveCategoryColor(category.key, category.color),
      isActive: isUnknownCategory(category) ? true : category.isActive,
    }))
  }, [categoriesData])

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories]
  )

  const inactiveCategories = useMemo(
    () => categories.filter((category) => !category.isActive),
    [categories]
  )

  const categoryList = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aIsUnknown = isUnknownCategory(a)
      const bIsUnknown = isUnknownCategory(b)

      if (aIsUnknown !== bIsUnknown) {
        return aIsUnknown ? 1 : -1
      }

      const aSortOrder = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER
      const bSortOrder = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER
      if (aSortOrder !== bSortOrder) {
        return aSortOrder - bSortOrder
      }

      return a.createdAt.localeCompare(b.createdAt)
    })
  }, [categories])

  const categoryKeyConflict = useMemo(() => {
    const draftKey = categoryDraft?.key?.trim().toLowerCase()
    if (!draftKey) return false

    return categories.some(
      (category) =>
        category.key.trim().toLowerCase() === draftKey && category.id !== categoryDraft?.id
    )
  }, [categories, categoryDraft])

  const draftColorValue = normalizeDraftColor(categoryDraft?.color)
  const isDraftColorInputValid = isDraftColorValid(categoryDraft?.color)
  const resolvedDraftColor = resolveCategoryColor(categoryDraft?.key, categoryDraft?.color)
  const resolvedDraftIconName = resolveCategoryIconName(categoryDraft?.key, categoryDraft?.icon)
  const isColorAutoMode = !draftColorValue
  const hasDefaultAppearance = hasCategoryDefaultAppearance(categoryDraft?.key)
  const defaultDraftIcon = resolveCategoryIconName(categoryDraft?.key)
  const isDefaultDraftAppearance =
    resolvedDraftIconName === defaultDraftIcon &&
    isColorAutoMode
  const canRestoreDefaultAppearance =
    !isUnknownCategory(categoryDraft) &&
    hasDefaultAppearance &&
    !isDefaultDraftAppearance

  const canSaveCategory =
    categoryDraft &&
    categoryDraft.name.trim().length > 0 &&
    categoryDraft.key.trim().length > 0 &&
    !categoryKeyConflict &&
    isDraftColorInputValid

  const canSavePrompt =
    promptDraft.trim().length > 0 &&
    promptDraft.trim() !== (categoryPrompt?.prompt || '').trim()
  const isPromptBusy =
    categoryPromptLoading || isSavingPrompt || isGeneratingPrompt || isRollingBackPrompt
  const previousPrompt = categoryPrompt?.previousPrompt?.trim() || ''
  const hasPreviousPrompt = Boolean(previousPrompt)
  const canRollbackPrompt = Boolean(categoryPrompt?.canRollback && hasPreviousPrompt)
  const isCustomGenerateMode = promptGenerateMode === 'custom'
  const isGenerateRequirementOptional = !isCustomGenerateMode
  const generateRequirementTrimmed = promptGenerateRequirement.trim()
  const canSubmitGeneratePrompt =
    !isCustomGenerateMode || generateRequirementTrimmed.length > 0

  const syncCategoriesCache = async () => {
    await refetchCategories()
    await queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  const selectedScenarioIdSet = useMemo(
    () => new Set(selectedScenarioIds),
    [selectedScenarioIds]
  )

  const selectedScenarios = useMemo(
    () =>
      CATEGORY_LIBRARY_SCENARIOS.filter((scenario) =>
        selectedScenarioIdSet.has(scenario.id)
      ),
    [selectedScenarioIdSet]
  )

  const selectedScenarioCategories = useMemo(
    () =>
      selectedScenarios.flatMap((scenario) =>
        scenario.categories.map((category) => {
          const localizedCategory = getLocalizedCategoryLibraryCategory(category, locale)

          return {
            scenarioId: scenario.id,
            scenarioName: t(scenario.nameKey),
            categoryKey: category.key,
            icon: category.icon,
            color: category.color,
            name: localizedCategory.name,
            description: localizedCategory.description,
            examples: localizedCategory.examples,
            selectionKey: createLibrarySelectionKey(scenario.id, category.key),
          }
        })
      ),
    [locale, selectedScenarios, t]
  )

  const selectedImportCategories = useMemo(
    () =>
      selectedScenarioCategories.filter((item) =>
        selectedCategorySelection.has(item.selectionKey)
      ),
    [selectedCategorySelection, selectedScenarioCategories]
  )

  const selectedImportCount = selectedImportCategories.length

  const openLibraryDialog = () => {
    setIsLibraryDialogOpen(true)
  }

  const openCategoryDialog = (category?: Category) => {
    setCategoryDraft({
      id: category?.id,
      originalKey: category?.key,
      key: category?.key || '',
      name: category?.name || '',
      description: category?.description || '',
      examplesText: (category?.examples || []).join('\n'),
      icon: resolveCategoryIconName(category?.key, category?.icon),
      color: normalizeDraftColor(category?.color),
      isActive: isUnknownCategory(category) ? true : (category?.isActive ?? true),
    })
    setCategoryDialogOpen(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryDraft) return

    if (!isDraftColorValid(categoryDraft.color)) {
      toast({
        title: t('toasts.categorySaveFailed.title'),
        description: t('categoryDialog.fields.color.invalid'),
        variant: 'destructive',
      })
      return
    }

    setIsSavingCategory(true)

    const examples = categoryDraft.examplesText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

    const payload = {
      key: categoryDraft.key.trim().toLowerCase(),
      name: categoryDraft.name.trim(),
      description: categoryDraft.description.trim(),
      examples,
      icon: resolveCategoryIconName(categoryDraft.key, categoryDraft.icon),
      color: isUnknownCategory(categoryDraft)
        ? undefined
        : (draftColorValue || undefined),
      isActive: isUnknownCategory(categoryDraft) ? true : categoryDraft.isActive,
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

      await syncCategoriesCache()
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
    if (isUnknownCategory(category)) {
      return
    }

    setTogglingCategoryId(category.id)
    try {
      await categoriesApi.update(category.id, { isActive: !category.isActive })
      await syncCategoriesCache()
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

  const handleDeleteCategory = async (category: Category) => {
    if (isUnknownCategory(category)) {
      return
    }

    if (!window.confirm(t('confirmDelete', { name: category.name }))) {
      return
    }

    try {
      await categoriesApi.delete(category.id)
      await syncCategoriesCache()
      toast({
        title: t('toasts.categoryDeleted.title'),
        description: t('toasts.categoryDeleted.description', { name: category.name }),
      })
    } catch (error) {
      toast({
        title: t('toasts.categoryDeleteFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    }
  }

  const toggleLibraryScenario = (scenarioId: string, checked: boolean) => {
    const scenario = CATEGORY_LIBRARY_SCENARIOS.find((item) => item.id === scenarioId)
    if (!scenario) {
      return
    }

    setSelectedScenarioIds((prev) => {
      if (checked) {
        if (prev.includes(scenarioId)) {
          return prev
        }
        return [...prev, scenarioId]
      }

      return prev.filter((id) => id !== scenarioId)
    })

    setSelectedCategorySelection((prev) => {
      const next = new Set(prev)

      for (const category of scenario.categories) {
        const key = createLibrarySelectionKey(scenarioId, category.key)
        if (checked) {
          next.add(key)
        } else {
          next.delete(key)
        }
      }

      return next
    })
  }

  const toggleLibraryCategory = (
    scenarioId: string,
    categoryKey: string,
    checked: boolean
  ) => {
    const selectionKey = createLibrarySelectionKey(scenarioId, categoryKey)

    setSelectedCategorySelection((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(selectionKey)
      } else {
        next.delete(selectionKey)
      }
      return next
    })
  }

  const handleSelectAllScenarios = () => {
    const nextScenarioIds = CATEGORY_LIBRARY_SCENARIOS.map((scenario) => scenario.id)
    const nextCategorySelection = new Set<string>()

    for (const scenario of CATEGORY_LIBRARY_SCENARIOS) {
      for (const category of scenario.categories) {
        nextCategorySelection.add(createLibrarySelectionKey(scenario.id, category.key))
      }
    }

    setSelectedScenarioIds(nextScenarioIds)
    setSelectedCategorySelection(nextCategorySelection)
  }

  const handleClearScenarioSelection = () => {
    setSelectedScenarioIds([])
    setSelectedCategorySelection(new Set<string>())
  }

  const handleSelectAllSelectedCategories = () => {
    const next = new Set<string>()
    for (const item of selectedScenarioCategories) {
      next.add(item.selectionKey)
    }
    setSelectedCategorySelection(next)
  }

  const handleClearSelectedCategories = () => {
    setSelectedCategorySelection(new Set<string>())
  }

  const handleApplyLibrary = async () => {
    if (selectedImportCount === 0) {
      return
    }

    if (!window.confirm(t('library.confirmImport', { count: selectedImportCount }))) {
      return
    }

    setIsApplyingLibrary(true)

    try {
      const latestCategories = await categoriesApi.list()
      const existingCategories = latestCategories.data || []
      const existingKeys = new Set(
        existingCategories.map((category) => category.key.trim().toLowerCase())
      )
      const existingNames = new Set(
        existingCategories.map((category) => category.name.trim().toLowerCase())
      )

      const ensureUniqueValue = (
        baseValue: string,
        existing: Set<string>,
        normalize: (value: string) => string
      ) => {
        let candidate = baseValue
        let normalizedCandidate = normalize(candidate)
        let index = 2

        while (existing.has(normalizedCandidate)) {
          candidate = `${baseValue}-${index}`
          normalizedCandidate = normalize(candidate)
          index += 1
        }

        existing.add(normalizedCandidate)
        return candidate
      }

      let importedCount = 0

      for (const item of selectedImportCategories) {
        const baseKey = item.categoryKey.trim().toLowerCase()
        if (!baseKey || baseKey === UNKNOWN_CATEGORY_KEY) {
          continue
        }

        const baseName = item.name.trim() || baseKey
        const uniqueKey = ensureUniqueValue(baseKey, existingKeys, (value) =>
          value.trim().toLowerCase()
        )
        const uniqueName = ensureUniqueValue(baseName, existingNames, (value) =>
          value.trim().toLowerCase()
        )

        await categoriesApi.create({
          key: uniqueKey,
          name: uniqueName,
          description: item.description.trim(),
          examples: (item.examples || []).filter(Boolean),
          icon: resolveCategoryIconName(uniqueKey, item.icon),
          color: resolveCategoryColor(uniqueKey, item.color),
          isActive: false,
        })

        importedCount += 1
      }

      await syncCategoriesCache()
      setIsLibraryDialogOpen(false)
      toast({
        title: t('toasts.libraryImported.title'),
        description: t('toasts.libraryImported.description', {
          count: importedCount,
        }),
      })
    } catch (error) {
      toast({
        title: t('toasts.libraryImportFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setIsApplyingLibrary(false)
    }
  }


  const refreshPromptData = async () => {
    await refetchCategoryPrompt()
  }

  const handleSavePrompt = async () => {
    const trimmedPrompt = promptDraft.trim()
    if (!trimmedPrompt) {
      toast({
        title: t('toasts.promptSaveFailed.title'),
        description: t('promptEditor.emptyPromptError'),
        variant: 'destructive',
      })
      return
    }

    setIsSavingPrompt(true)

    try {
      await categoriesApi.updatePrompt(trimmedPrompt)
      await refreshPromptData()
      toast({
        title: t('toasts.promptSaved.title'),
      })
    } catch (error) {
      toast({
        title: t('toasts.promptSaveFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setIsSavingPrompt(false)
    }
  }

  const handleOpenGeneratePromptDialog = () => {
    setPromptGenerateMode('low_cost')
    setPromptGenerateRequirement('')
    setIsGeneratePromptDialogOpen(true)
  }

  const handleGeneratePrompt = async () => {
    if (isCustomGenerateMode && !generateRequirementTrimmed) {
      toast({
        title: t('toasts.promptGenerateFailed.title'),
        description: t('promptEditor.generateDialog.requirementRequired'),
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingPrompt(true)

    try {
      const response = await categoriesApi.generatePrompt({
        mode: promptGenerateMode,
        requirement: generateRequirementTrimmed || undefined,
        language: locale,
      })
      const generatedPrompt = response.data?.prompt?.trim()
      if (generatedPrompt) {
        setPromptDraft(generatedPrompt)
      }
      setIsGeneratePromptDialogOpen(false)
      toast({
        title: t('toasts.promptGenerated.title'),
      })
    } catch (error) {
      toast({
        title: t('toasts.promptGenerateFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingPrompt(false)
    }
  }

  const handleRollbackPrompt = async () => {
    if (!canRollbackPrompt) {
      return
    }

    if (!window.confirm(t('promptEditor.confirmRollback'))) {
      return
    }

    setIsRollingBackPrompt(true)

    try {
      await categoriesApi.rollbackPrompt()
      await refreshPromptData()
      toast({
        title: t('toasts.promptRollback.title'),
      })
    } catch (error) {
      toast({
        title: t('toasts.promptRollbackFailed.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setIsRollingBackPrompt(false)
    }
  }

  return (
    <div className="w-full space-y-6 px-4 md:px-6 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 min-w-0 md:pr-6 text-sm leading-relaxed text-muted-foreground">
          {t('description')}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            title={t('view.toggle')}
            className="hidden md:inline-flex"
          >
            {viewMode === 'list' ? (
              <LayoutGrid className="h-4 w-4" />
            ) : (
              <List className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            onClick={openLibraryDialog}
          >
            <Library className="mr-2 h-4 w-4" />
            {t('actions.openLibrary')}
          </Button>
          <Button onClick={() => openCategoryDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            {t('actions.addCategory')}
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="px-0">
          {categoriesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {common('loading')}
            </div>
          ) : categoryList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('categoryList.empty')}
            </div>
          ) : viewMode === 'list' ? (
            <Table className="w-full border-0">
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
              {categoryList.map((category) => {
                  const nameLabel = category.name?.trim() || t('labels.unnamed')
                  const keyLabel = category.key?.trim() || common('empty')
                  const descriptionLabel = category.description?.trim() || common('empty')
                  const previewExamples = (category.examples || []).slice(0, 2)
                  const extraExamples =
                    (category.examples?.length || 0) - previewExamples.length
                  const isSystemFallbackCategory = isUnknownCategory(category)
                  const toggleDisabled =
                    togglingCategoryId === category.id || isSystemFallbackCategory
                  const CategoryIcon = getCategoryIconComponent(category.icon, category.key)
                  const iconStyle = getCategorySoftStyle(category.key, category.color)
                  const categoryColor = resolveCategoryColor(category.key, category.color)

                  return (
                    <TableRow key={category.id}>
                      <TableCell className="min-w-[240px]">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60"
                            style={iconStyle}
                          >
                            <CategoryIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-sm font-semibold text-foreground">{nameLabel}</p>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-flex h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: categoryColor }}
                              />
                              <span className="truncate font-mono text-[11px] text-muted-foreground">
                                {keyLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[360px]">
                        <div className="space-y-2">
                          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground" title={descriptionLabel}>
                            {descriptionLabel}
                          </p>
                          {previewExamples.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {previewExamples.map((example, index) => (
                                <Badge
                                  key={`${category.id}-${index}`}
                                  variant="outline"
                                  className="max-w-[220px] truncate border-border/70 bg-muted/30 text-xs text-muted-foreground"
                                  title={example}
                                >
                                  {example}
                                </Badge>
                              ))}
                              {extraExamples > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-border/70 bg-muted/20 text-xs text-muted-foreground"
                                >
                                  +{extraExamples}
                                </Badge>
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
                        <Switch
                          checked={category.isActive}
                          onCheckedChange={() => toggleCategoryActive(category)}
                          disabled={toggleDisabled}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openCategoryDialog(category)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {t('actions.editCategory')}
                            </DropdownMenuItem>
                            {!isSystemFallbackCategory && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteCategory(category)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {common('delete')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryList.map((category) => {
                const nameLabel = category.name?.trim() || t('labels.unnamed')
                const keyLabel = category.key?.trim() || common('empty')
                const descriptionLabel = category.description?.trim() || common('empty')
                const isSystemFallbackCategory = isUnknownCategory(category)
                const toggleDisabled =
                  togglingCategoryId === category.id || isSystemFallbackCategory
                const CategoryIcon = getCategoryIconComponent(category.icon, category.key)
                const iconStyle = getCategorySoftStyle(category.key, category.color)
                const categoryColor = resolveCategoryColor(category.key, category.color)

                return (
                  <Card key={category.id} className="group relative overflow-hidden rounded-[24px] border border-black/[0.04] bg-white shadow-sm transition-all hover:shadow-xl dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60"
                            style={iconStyle}
                          >
                            <CategoryIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">{nameLabel}</CardTitle>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span
                                className="inline-flex h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: categoryColor }}
                              />
                              <span className="truncate font-mono text-[11px] text-muted-foreground">
                                {keyLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={category.isActive}
                          onCheckedChange={() => toggleCategoryActive(category)}
                          disabled={toggleDisabled}
                        />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                        {descriptionLabel}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                      {(category.examples || []).length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-1.5">
                          {(category.examples || []).slice(0, 3).map((example, index) => (
                            <Badge
                              key={`${category.id}-${index}`}
                              variant="outline"
                              className="h-6 w-full max-w-full truncate border-border/70 bg-transparent px-2.5 text-xs text-muted-foreground sm:w-auto sm:max-w-[280px]"
                              title={example}
                            >
                              {example}
                            </Badge>
                          ))}
                          {(category.examples || []).length > 3 && (
                            <Badge
                              variant="outline"
                              className="h-6 border-border/70 bg-transparent px-2.5 text-xs text-muted-foreground"
                            >
                              +{(category.examples || []).length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="absolute bottom-4 right-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openCategoryDialog(category)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {t('actions.editCategory')}
                            </DropdownMenuItem>
                            {!isSystemFallbackCategory && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteCategory(category)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {common('delete')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{t('stats.total', { count: categories.length })}</span>
              <span>·</span>
              <span>{t('stats.active', { count: activeCategories.length })}</span>
              <span>·</span>
              <span>{t('stats.inactive', { count: inactiveCategories.length })}</span>
            </span>
          </div>
        </CardContent>
      </Card>


      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">{t('promptEditor.advancedTitle')}</CardTitle>
              <CardDescription>{t('promptEditor.advancedDescription')}</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAdvancedPromptOpen((prev) => !prev)}
              className="shrink-0"
            >
              {isAdvancedPromptOpen
                ? t('promptEditor.actions.collapse')
                : t('promptEditor.actions.expand')}
            </Button>
          </div>
        </CardHeader>
        {isAdvancedPromptOpen && (
          <CardContent className="px-0 space-y-3">
            <div className="text-sm font-medium text-foreground">
              {t('promptEditor.currentTitle')}
            </div>
            <Textarea
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              placeholder={t('promptEditor.placeholder')}
              className="min-h-[260px] font-mono text-xs leading-5"
              disabled={isPromptBusy}
            />
            <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p>
                  {categoryPrompt?.isCustomized
                    ? t('promptEditor.updatedAtCustom', {
                        date: categoryPrompt.updatedAt || common('empty'),
                      })
                    : t('promptEditor.updatedAtDefault')}
                </p>
                <p>
                  {canRollbackPrompt
                    ? t('promptEditor.rollbackHint')
                    : t('promptEditor.rollbackUnavailable')}
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
                <Button
                  variant="outline"
                  onClick={handleOpenGeneratePromptDialog}
                  disabled={isPromptBusy}
                >
                  {isGeneratingPrompt
                    ? t('promptEditor.actions.generating')
                    : t('promptEditor.actions.generate')}
                </Button>
                <Button
                  onClick={handleSavePrompt}
                  disabled={!canSavePrompt || isPromptBusy}
                >
                  {t('promptEditor.actions.save')}
                </Button>
              </div>
            </div>
            <div className="text-sm font-medium text-foreground">
              {t('promptEditor.historyTitle')}
            </div>
            <div className="rounded border bg-muted/20 p-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="text-[11px] text-muted-foreground">
                    {categoryPrompt?.previousUpdatedAt || common('empty')}
                  </div>
                  <p className="line-clamp-2 text-xs text-foreground">
                    {hasPreviousPrompt ? previousPrompt : t('promptEditor.rollbackUnavailable')}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPreviousPromptPreviewOpen(true)}
                    disabled={isPromptBusy || !canRollbackPrompt}
                  >
                    {t('promptEditor.actions.viewFull')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRollbackPrompt}
                    disabled={isPromptBusy || !canRollbackPrompt}
                  >
                    {t('promptEditor.actions.rollback')}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog
        open={isLibraryDialogOpen}
        onOpenChange={(open) => {
          if (!isApplyingLibrary) {
            setIsLibraryDialogOpen(open)
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('library.title')}</DialogTitle>
            <DialogDescription>{t('library.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {t('library.selectedCount', { count: selectedImportCount })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllScenarios}
                  disabled={isApplyingLibrary}
                >
                  {t('library.selectAllScenarios')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearScenarioSelection}
                  disabled={isApplyingLibrary}
                >
                  {t('library.clearScenarios')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                {t('library.scenarioTitle')}
              </div>
              <div className="grid max-h-[32vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                {CATEGORY_LIBRARY_SCENARIOS.map((scenario) => {
                  const isSelected = selectedScenarioIdSet.has(scenario.id)
                  const selectedCount = scenario.categories.filter((category) =>
                    selectedCategorySelection.has(
                      createLibrarySelectionKey(scenario.id, category.key)
                    )
                  ).length

                  return (
                    <div
                      key={scenario.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleLibraryScenario(scenario.id, Boolean(checked))
                          }
                          disabled={isApplyingLibrary}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="text-sm font-medium text-foreground">
                            {t(scenario.nameKey)}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {t(scenario.descriptionKey)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {t('library.selectedCategoryCount', {
                              count: selectedCount,
                              total: scenario.categories.length,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {t('library.categorySelectionTitle')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('library.categorySelectionDescription', {
                      count: selectedScenarioCategories.length,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllSelectedCategories}
                    disabled={
                      isApplyingLibrary || selectedScenarioCategories.length === 0
                    }
                  >
                    {t('library.selectAllCategories')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelectedCategories}
                    disabled={isApplyingLibrary || selectedImportCount === 0}
                  >
                    {t('library.clearCategories')}
                  </Button>
                </div>
              </div>

              {selectedScenarioCategories.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  {t('library.emptyScenarioHint')}
                </div>
              ) : (
                <div className="grid max-h-[34vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedScenarioCategories.map((item) => {
                    const iconName = resolveCategoryIconName(item.categoryKey, item.icon)
                    const CategoryIcon = getCategoryIconComponent(iconName, item.categoryKey)
                    const iconStyle = getCategorySoftStyle(item.categoryKey, item.color)
                    const badgeStyle = getCategoryBadgeStyle(item.categoryKey, item.color)
                    const checked = selectedCategorySelection.has(item.selectionKey)

                    return (
                      <div
                        key={item.selectionKey}
                        className="rounded border border-border/70 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                              style={iconStyle}
                            >
                              <CategoryIcon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {item.name}
                              </div>
                              <Badge
                                variant="outline"
                                className="mt-1 max-w-[150px] truncate text-[10px] font-medium uppercase tracking-wide"
                                style={badgeStyle}
                              >
                                {item.categoryKey}
                              </Badge>
                            </div>
                          </div>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) =>
                              toggleLibraryCategory(
                                item.scenarioId,
                                item.categoryKey,
                                Boolean(nextChecked)
                              )
                            }
                            disabled={isApplyingLibrary}
                            className="mt-0.5"
                          />
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item.scenarioName}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4 border-t pt-4">
            <Button
              variant="ghost"
              onClick={() => setIsLibraryDialogOpen(false)}
              disabled={isApplyingLibrary}
            >
              {common('cancel')}
            </Button>
            <Button
              onClick={handleApplyLibrary}
              disabled={isApplyingLibrary || selectedImportCount === 0}
            >
              {isApplyingLibrary ? t('library.applying') : t('library.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isGeneratePromptDialogOpen}
        onOpenChange={(open) => {
          if (!isGeneratingPrompt) {
            setIsGeneratePromptDialogOpen(open)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('promptEditor.generateDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('promptEditor.generateDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs
              value={promptGenerateMode}
              onValueChange={(value) =>
                setPromptGenerateMode(value as CategoryPromptGenerateMode)
              }
              className="space-y-3"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="low_cost">
                  {t('promptEditor.generateDialog.modes.lowCost')}
                </TabsTrigger>
                <TabsTrigger value="high_precision">
                  {t('promptEditor.generateDialog.modes.highPrecision')}
                </TabsTrigger>
                <TabsTrigger value="custom">
                  {t('promptEditor.generateDialog.modes.custom')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="low_cost" className="mt-0 text-xs text-muted-foreground">
                {t('promptEditor.generateDialog.hints.lowCost')}
              </TabsContent>
              <TabsContent value="high_precision" className="mt-0 text-xs text-muted-foreground">
                {t('promptEditor.generateDialog.hints.highPrecision')}
              </TabsContent>
              <TabsContent value="custom" className="mt-0 text-xs text-muted-foreground">
                {t('promptEditor.generateDialog.hints.custom')}
              </TabsContent>
            </Tabs>
            <div className="space-y-2">
              <Label
                htmlFor="prompt-generate-requirement"
                className="inline-flex items-center gap-1"
              >
                {t('promptEditor.generateDialog.requirementLabel')}
                {isGenerateRequirementOptional && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {t('promptEditor.generateDialog.requirementOptional')}
                  </span>
                )}
              </Label>
              <Textarea
                id="prompt-generate-requirement"
                value={promptGenerateRequirement}
                onChange={(event) => setPromptGenerateRequirement(event.target.value)}
                placeholder={
                  promptGenerateMode === 'custom'
                    ? t('promptEditor.generateDialog.requirementPlaceholders.custom')
                    : promptGenerateMode === 'high_precision'
                      ? t('promptEditor.generateDialog.requirementPlaceholders.highPrecision')
                      : t('promptEditor.generateDialog.requirementPlaceholders.lowCost')
                }
                className="min-h-[140px]"
                disabled={isGeneratingPrompt}
              />
              {isCustomGenerateMode && !generateRequirementTrimmed && (
                <p className="text-xs text-destructive">
                  {t('promptEditor.generateDialog.requirementRequired')}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsGeneratePromptDialogOpen(false)}
              disabled={isGeneratingPrompt}
            >
              {common('cancel')}
            </Button>
            <Button
              onClick={handleGeneratePrompt}
              disabled={isGeneratingPrompt || !canSubmitGeneratePrompt}
            >
              {isGeneratingPrompt
                ? t('promptEditor.actions.generating')
                : t('promptEditor.generateDialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPreviousPromptPreviewOpen}
        onOpenChange={setIsPreviousPromptPreviewOpen}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('promptEditor.preview.title')}</DialogTitle>
            <DialogDescription>
              {categoryPrompt?.previousUpdatedAt || common('empty')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={previousPrompt}
            readOnly
            className="min-h-[420px] font-mono text-xs leading-5"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsPreviousPromptPreviewOpen(false)}
            >
              {common('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                disabled={isUnknownCategory(categoryDraft)}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="category-icon">{t('categoryDialog.fields.appearance.label')}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setCategoryDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            icon: resolveCategoryIconName(prev.key),
                            color: '',
                          }
                        : prev
                    )
                  }
                  disabled={!canRestoreDefaultAppearance}
                >
                  {t('categoryDialog.fields.appearance.reset')}
                </Button>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <Select
                  value={resolvedDraftIconName}
                  onValueChange={(value) =>
                    setCategoryDraft((prev) =>
                      prev ? { ...prev, icon: value } : prev
                    )
                  }
                >
                  <SelectTrigger id="category-icon">
                    <SelectValue placeholder={t('categoryDialog.fields.icon.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ICON_OPTIONS.map((iconName) => {
                      const Icon = getCategoryIconComponent(iconName)

                      return (
                        <SelectItem key={iconName} value={iconName}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{iconName}</span>
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Input
                    id="category-color-picker"
                    type="color"
                    value={resolvedDraftColor}
                    onChange={(event) =>
                      setCategoryDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              color: normalizeDraftColor(event.target.value),
                            }
                          : prev
                      )
                    }
                    disabled={isUnknownCategory(categoryDraft)}
                    className="h-10 w-16 shrink-0 cursor-pointer p-1"
                  />
                  <Input
                    id="category-color-input"
                    value={categoryDraft?.color || ''}
                    onChange={(event) =>
                      setCategoryDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              color: event.target.value,
                            }
                          : prev
                      )
                    }
                    placeholder={t('categoryDialog.fields.color.placeholder')}
                    disabled={isUnknownCategory(categoryDraft)}
                    className="min-w-0 flex-1 font-mono"
                  />
                </div>
              </div>

              {isUnknownCategory(categoryDraft) ? (
                <p className="text-xs text-muted-foreground">
                  {t('categoryDialog.fields.color.systemFallbackHint')}
                </p>
              ) : !hasDefaultAppearance ? (
                <p className="text-xs text-muted-foreground">
                  {t('categoryDialog.fields.appearance.noDefault')}
                </p>
              ) : !isDraftColorInputValid ? (
                <p className="text-xs text-destructive">
                  {t('categoryDialog.fields.color.invalid')}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {isColorAutoMode
                    ? t('categoryDialog.fields.color.hint')
                    : t('categoryDialog.fields.color.customHint')}
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
                disabled={isUnknownCategory(categoryDraft)}
                onCheckedChange={(checked) =>
                  setCategoryDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          isActive: isUnknownCategory(prev)
                            ? true
                            : Boolean(checked),
                        }
                      : prev
                  )
                }
              />
              <Label htmlFor="category-active">
                {t('categoryDialog.fields.active.label')}
              </Label>
            </div>
            {isUnknownCategory(categoryDraft) && (
              <p className="text-xs text-muted-foreground">
                {t('categoryDialog.fields.active.systemFallbackHint')}
              </p>
            )}
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
    </div>
  )
}
