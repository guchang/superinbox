"use client"

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { LayoutGrid, List, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { categoriesApi } from '@/lib/api/categories'
import type { Category } from '@/types'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { useIsMobile } from '@/hooks/use-is-mobile'

type CategoryDraft = {
  id?: string
  originalKey?: string
  key: string
  name: string
  description: string
  examplesText: string
  isActive: boolean
}

const UNKNOWN_CATEGORY_KEY = 'unknown'

const isUnknownCategory = (
  category?: Pick<CategoryDraft, 'key'> | Pick<Category, 'key'> | null
) => category?.key?.trim().toLowerCase() === UNKNOWN_CATEGORY_KEY

export default function CategoryPage() {
  const { toast } = useToast()
  const t = useTranslations('aiPage')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
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

      return a.createdAt.localeCompare(b.createdAt)
    })
  }, [categories])

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

  const canSavePrompt =
    promptDraft.trim().length > 0 &&
    promptDraft.trim() !== (categoryPrompt?.prompt || '').trim()
  const isPromptBusy =
    categoryPromptLoading || isSavingPrompt || isGeneratingPrompt || isRollingBackPrompt
  const previousPrompt = categoryPrompt?.previousPrompt?.trim() || ''
  const hasPreviousPrompt = Boolean(previousPrompt)
  const canRollbackPrompt = Boolean(categoryPrompt?.canRollback && hasPreviousPrompt)

  const openCategoryDialog = (category?: Category) => {
    setCategoryDraft({
      id: category?.id,
      originalKey: category?.key,
      key: category?.key || '',
      name: category?.name || '',
      description: category?.description || '',
      examplesText: (category?.examples || []).join('\n'),
      isActive: isUnknownCategory(category) ? true : (category?.isActive ?? true),
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
    if (isUnknownCategory(category)) {
      return
    }

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

  const handleDeleteCategory = async (category: Category) => {
    if (isUnknownCategory(category)) {
      return
    }

    if (!window.confirm(t('confirmDelete', { name: category.name }))) {
      return
    }

    try {
      await categoriesApi.delete(category.id)
      await refetchCategories()
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

  const handleGeneratePrompt = async () => {
    setIsGeneratingPrompt(true)

    try {
      const response = await categoriesApi.generatePrompt()
      const generatedPrompt = response.data?.prompt?.trim()
      if (generatedPrompt) {
        setPromptDraft(generatedPrompt)
      }
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
          <Button onClick={() => openCategoryDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            {t('actions.addCategory')}
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>{t('promptEditor.title')}</CardTitle>
          <CardDescription>{t('promptEditor.description')}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 space-y-3">
          <Textarea
            value={promptDraft}
            onChange={(event) => setPromptDraft(event.target.value)}
            placeholder={t('promptEditor.placeholder')}
            className="min-h-[260px] font-mono text-xs leading-5"
            disabled={isPromptBusy}
          />
          <div className="space-y-2 text-xs text-muted-foreground">
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
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleGeneratePrompt}
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
      </Card>

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
                  const previewExamples = (category.examples || []).slice(0, 1)
                  const extraExamples =
                    (category.examples?.length || 0) - previewExamples.length
                  const isSystemFallbackCategory = isUnknownCategory(category)
                  const toggleDisabled =
                    togglingCategoryId === category.id || isSystemFallbackCategory

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
                      <TableCell className="hidden lg:table-cell max-w-[300px]">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="text-sm text-muted-foreground truncate" title={descriptionLabel}>
                            {descriptionLabel}
                          </div>
                          {previewExamples.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {previewExamples.map((example, index) => (
                                <Badge
                                  key={`${category.id}-${index}`}
                                  variant="secondary"
                                  className="max-w-[120px] truncate"
                                  title={example}
                                >
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

                return (
                  <Card key={category.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{nameLabel}</CardTitle>
                          <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{keyLabel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={category.isActive}
                            onCheckedChange={() => toggleCategoryActive(category)}
                            disabled={toggleDisabled}
                          />
                        </div>
                      </div>
                      {descriptionLabel && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{descriptionLabel}</p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      {(category.examples || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {(category.examples || []).slice(0, 3).map((example, index) => (
                            <Badge
                              key={`${category.id}-${index}`}
                              variant="secondary"
                              className="text-xs max-w-[120px] truncate"
                              title={example}
                            >
                              {example}
                            </Badge>
                          ))}
                          {(category.examples || []).length > 3 && (
                            <Badge variant="outline" className="text-xs">
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
