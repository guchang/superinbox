"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Link, useRouter } from '@/i18n/navigation'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatRelativeTime } from '@/lib/utils'
import { CategoryType, ContentType, ItemStatus } from '@/types'
import { ArrowLeft, RefreshCw, Sparkles, Trash2, Loader2, Share2, FileText, AlertCircle, Paperclip, Settings2, Pencil } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { FilePreview } from '@/components/file-preview'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { getCategoryBadgeStyle, resolveCategoryColor, resolveCategoryIconName } from '@/lib/category-appearance'
import { LinkifiedText } from '@/components/shared/linkified-text'
import { MarkdownContent } from '@/components/shared/markdown-content'

export default function InboxDetailPage() {
  const t = useTranslations('inboxDetail')
  const common = useTranslations('common')
  const time = useTranslations('time')
  const errors = useTranslations('errors')
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const params = useParams()
  const id = params.id as string
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { data: itemData, isLoading, refetch } = useQuery({
    queryKey: ['inbox', id],
    queryFn: () => inboxApi.getItem(id),
    enabled: !!id,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const item = itemData?.data
  const categoryMetaMap = useMemo(() => {
    return new Map(
      (categoriesData?.data || []).map((category) => [
        category.key,
        {
          name: category.name,
          icon: resolveCategoryIconName(category.key, category.icon),
          color: resolveCategoryColor(category.key, category.color),
        },
      ])
    )
  }, [categoriesData])

  const categoryLabelMap = useMemo(() => {
    return new Map(
      Array.from(categoryMetaMap.entries()).map(([key, meta]) => [key, meta.name])
    )
  }, [categoryMetaMap])

  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [draftCategory, setDraftCategory] = useState('unknown')
  const [editModeTab, setEditModeTab] = useState<'write' | 'preview'>('write')
  const currentItemId = item?.id ?? null
  const currentItemContent = item?.content ?? ''
  const currentItemCategory = item?.analysis?.category ?? 'unknown'

  const categoryOptions = useMemo(() => {
    const fallback = [
      { key: 'todo', name: t('categories.todo') },
      { key: 'idea', name: t('categories.idea') },
      { key: 'expense', name: t('categories.expense') },
      { key: 'note', name: t('categories.note') },
      { key: 'bookmark', name: t('categories.bookmark') },
      { key: 'schedule', name: t('categories.schedule') },
      { key: 'unknown', name: t('categories.unknown') },
    ]

    const activeCategories = (categoriesData?.data || []).filter((category) => category.isActive !== false)
    const baseOptions = activeCategories.length > 0
      ? activeCategories.map((category) => ({ key: category.key, name: category.name }))
      : fallback

    const optionMap = new Map<string, string>()
    baseOptions.forEach((option) => {
      const key = String(option.key ?? '').trim()
      const name = String(option.name ?? '').trim()
      if (!key) return
      optionMap.set(key, name || key)
    })

    if (!optionMap.has('unknown')) {
      optionMap.set('unknown', t('categories.unknown'))
    }

    return Array.from(optionMap.entries()).map(([key, name]) => ({ key, name }))
  }, [categoriesData, t])

  useEffect(() => {
    if (!currentItemId) return
    setDraftContent(currentItemContent)
    setDraftCategory(currentItemCategory)
    setEditModeTab('write')
  }, [currentItemId, currentItemContent, currentItemCategory])

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await inboxApi.deleteItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      toast({
        title: t('toast.deleteSuccess.title'),
        description: t('toast.deleteSuccess.description'),
      })
      router.push('/inbox')
    },
    onError: (error) => {
      toast({
        title: t('toast.deleteFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  const reclassifyMutation = useMutation({
    mutationFn: async () => {
      await inboxApi.reclassifyItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox', id] })
      toast({
        title: t('toast.reclassifySuccess.title'),
        description: t('toast.reclassifySuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.reclassifyFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  const redistributeMutation = useMutation({
    mutationFn: async () => {
      await inboxApi.distributeItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox', id] })
      toast({
        title: t('toast.redistributeSuccess.title'),
        description: t('toast.redistributeSuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.redistributeFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ content, category }: { content: string; category: string }) => {
      const response = await inboxApi.updateItem(id, { content, category })
      if (!response.success || !response.data) {
        throw new Error(response.error || response.message || 'Failed to update item')
      }
      return response.data
    },
    onSuccess: (updatedItem) => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox', id] })

      setDraftContent(updatedItem.content ?? '')
      setDraftCategory(updatedItem.analysis?.category ?? 'unknown')
      setIsEditing(false)
      setEditModeTab('write')

      toast({
        title: t('toast.updateSuccess.title'),
        description: t('toast.updateSuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.updateFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  // Smart auto-refetch: only poll when necessary
  // - When item is actively being processed (PROCESSING status)
  // - When user manually triggers reclassify/redistribute operations
  // - NOT for COMPLETED, FAILED, or PENDING items (no changes expected)
  const { isPolling } = useAutoRefetch({
    refetch,
    items: item ? [item] : [],
    interval: 3000,
    enabled: !!item && (
      item.status === ItemStatus.PROCESSING ||
      reclassifyMutation.isPending ||
      redistributeMutation.isPending
    ),
  })

  const handleStartEdit = useCallback(() => {
    if (!item) return
    setDraftContent(item.content ?? '')
    setDraftCategory(item.analysis?.category ?? 'unknown')
    setEditModeTab('write')
    setIsEditing(true)
  }, [item])

  const handleCancelEdit = useCallback(() => {
    if (!item) return
    setDraftContent(item.content ?? '')
    setDraftCategory(item.analysis?.category ?? 'unknown')
    setEditModeTab('write')
    setIsEditing(false)
  }, [item])

  const handleSaveEdit = useCallback(async () => {
    await updateMutation.mutateAsync({
      content: draftContent,
      category: draftCategory,
    })
  }, [updateMutation, draftContent, draftCategory])

  const contentTypeTags = useMemo(() => {
    if (!item) return []
    const tags = new Set<string>()
    const content = item.content?.trim() ?? ''

    if (item.contentType === ContentType.URL) {
      tags.add(t('contentType.url'))
    } else if (content) {
      tags.add(t('contentType.text'))
    }

    const fileSources = item.allFiles && item.allFiles.length > 0
      ? item.allFiles
      : item.mimeType
        ? [{ mimeType: item.mimeType }]
        : []

    for (const file of fileSources) {
      const mimeType = file?.mimeType?.toLowerCase() ?? ''
      if (mimeType.startsWith('image/')) {
        tags.add(t('contentType.image'))
      } else if (mimeType.startsWith('audio/')) {
        tags.add(t('contentType.audio'))
      } else {
        tags.add(t('contentType.file'))
      }
    }

    if (tags.size === 0) {
      if (item.contentType === ContentType.IMAGE) {
        tags.add(t('contentType.image'))
      } else if (item.contentType === ContentType.AUDIO) {
        tags.add(t('contentType.audio'))
      } else if (item.contentType === ContentType.FILE) {
        tags.add(t('contentType.file'))
      } else if (item.contentType === ContentType.TEXT) {
        tags.add(t('contentType.text'))
      }
    }

    return Array.from(tags)
  }, [item, t])

  // Helpers
  const getStatusBadgeVariant = (status: ItemStatus) => {
    const variants: Record<ItemStatus, any> = {
      [ItemStatus.PENDING]: 'secondary',
      [ItemStatus.PROCESSING]: 'outline',
      [ItemStatus.COMPLETED]: 'default',
      [ItemStatus.FAILED]: 'destructive',
    }
    return variants[status] || 'outline'
  }

  const statusLabelMap: Record<ItemStatus, string> = {
    [ItemStatus.PENDING]: t('status.pending'),
    [ItemStatus.PROCESSING]: t('status.processing'),
    [ItemStatus.COMPLETED]: t('status.completed'),
    [ItemStatus.FAILED]: t('status.failed'),
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="p-4 rounded-full bg-muted">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">{t('notFound')}</p>
        <Link href="/inbox">
          <Button variant="outline">{t('backToInbox')}</Button>
        </Link>
      </div>
    )
  }

  // Data processing
  const entityGroups = (item.analysis?.entities || []).reduce<Record<string, string[]>>(
    (acc, entity) => {
      if (!entity?.type || entity.type === 'customFields') return acc
      const value = entity.value?.trim()
      if (!value) return acc
      if (!acc[entity.type]) acc[entity.type] = []
      acc[entity.type].push(value)
      return acc
    },
    {}
  )
  const entityEntries = Object.entries(entityGroups)
  const categoryKey = item.analysis?.category ?? 'unknown'
  const selectedCategoryKey = isEditing ? draftCategory : categoryKey
  const categoryLabel =
    categoryOptions.find((option) => option.key === selectedCategoryKey)?.name ||
    categoryLabelMap.get(selectedCategoryKey) ||
    ({
      [CategoryType.TODO]: t('categories.todo'),
      [CategoryType.IDEA]: t('categories.idea'),
      [CategoryType.EXPENSE]: t('categories.expense'),
      [CategoryType.NOTE]: t('categories.note'),
      [CategoryType.BOOKMARK]: t('categories.bookmark'),
      [CategoryType.SCHEDULE]: t('categories.schedule'),
      [CategoryType.UNKNOWN]: t('categories.unknown'),
    }[selectedCategoryKey] || selectedCategoryKey)

  const categoryBadgeStyle = getCategoryBadgeStyle(
    selectedCategoryKey,
    categoryMetaMap.get(selectedCategoryKey)?.color,
    isDark ? 'dark' : 'light'
  )

  const distributionEntries = (() => {
    const results = item.distributionResults
    if (!results) return []
    if (Array.isArray(results)) {
      return results.map((result: any, index: number) => {
        const target = result?.ruleName || result?.targetId || result?.adapter || result?.id || `目标${index + 1}`
        const status = result?.status || (result?.success ? 'success' : 'failed')
        const isSuccess = status === 'success' || status === 'completed'
        return { key: `${target}-${index}`, target, isSuccess }
      })
    }
    return Object.entries(results).map(([target, result]) => {
      const status = (result as any)?.status || ((result as any)?.success ? 'success' : 'failed')
      const isSuccess = status === 'success' || status === 'completed'
      return { key: target, target, isSuccess }
    })
  })()

  return (
    <div className="container py-6 max-w-7xl animate-in fade-in duration-500">
      {/* 1. Header Area: Explicit Back Button & Clean Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="flex flex-col gap-2">
          {/* Back Button */}
          <Link href="/inbox">
            <Button variant="ghost" size="sm" className="-ml-3 gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              {t('backToInbox')}
            </Button>
          </Link>

        </div>

        {/* Global Page Actions */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={updateMutation.isPending}
              >
                {t('actions.cancelEdit')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void handleSaveEdit()
                }}
                disabled={updateMutation.isPending || !draftContent.trim()}
              >
                {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                {t('actions.saveEdit')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEdit}
                disabled={item.status === ItemStatus.PROCESSING}
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                {t('actions.editContent')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isPolling}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
                {t('actions.refresh')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => reclassifyMutation.mutate()}
                disabled={reclassifyMutation.isPending || item.status === ItemStatus.PROCESSING}
              >
                {reclassifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
                {t('actions.reclassify')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => redistributeMutation.mutate()}
                disabled={redistributeMutation.isPending || item.status === ItemStatus.PROCESSING}
              >
                {redistributeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Share2 className="h-3.5 w-3.5 mr-2" />}
                {t('actions.redistribute')}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                    {common('delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                    <AlertDialogDescription />
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{common('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>{common('delete')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12 lg:gap-8">
        {/* Main Content (Left, 8 cols) */}
        <div className="md:col-span-8 flex flex-col gap-6">

          {/* Content Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {t('sections.content')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Tabs
                  value={editModeTab}
                  onValueChange={(value) => setEditModeTab(value as 'write' | 'preview')}
                  className="grid gap-3"
                >
                  <TabsList className="h-8 w-fit">
                    <TabsTrigger value="write" className="px-2 text-xs">
                      {t('edit.mode.write')}
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="px-2 text-xs">
                      {t('edit.mode.preview')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="write" className="mt-0">
                    <Textarea
                      value={draftContent}
                      onChange={(event) => setDraftContent(event.target.value)}
                      className="min-h-[220px] border border-white/45 bg-background/70 text-sm leading-relaxed focus-visible:border-white/80 focus-visible:ring-white/30"
                      placeholder={t('edit.placeholder')}
                    />
                  </TabsContent>

                  <TabsContent value="preview" className="mt-0">
                    <div className="min-h-[220px] rounded-md border border-border/80 bg-background/60 p-4">
                      <MarkdownContent
                        text={draftContent}
                        emptyText={t('edit.previewEmpty')}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="min-h-[120px]">
                  <MarkdownContent
                    text={item.content ?? ''}
                    emptyText={t('content.empty')}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {item.hasFile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  {t('sections.attachments')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FilePreview
                  itemId={item.id}
                  fileName={item.fileName}
                  mimeType={item.mimeType}
                  allFiles={item.allFiles}
                />
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Details */}
          {item.analysis && (item.analysis.summary || entityEntries.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  {t('sections.analysis')}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                {item.analysis.summary && (
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('analysis.summary')}</span>
                    <p className="text-sm text-foreground leading-relaxed bg-muted/30 p-3 rounded-md">
                      <LinkifiedText
                        text={item.analysis.summary}
                        linkClassName="text-primary hover:opacity-80"
                      />
                    </p>
                  </div>
                )}

                {entityEntries.length > 0 && (
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('analysis.entities')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {entityEntries.flatMap(([type, values]) =>
                        values.map((val, k) => (
                          <Badge key={`${type}-${k}`} variant="secondary" className="font-normal">
                            {val}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar (Right, 4 cols) */}
        <div className="md:col-span-4 flex flex-col gap-6">

          {/* Properties Card (Source, Metadata, ID, Task Info) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                {t('sections.properties') || 'Properties'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">

              {/* 1. Basic Info (Source & Classification) */}
              <div className="grid grid-cols-2 gap-4">
                {/* Source (Moved from Header) */}
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">{t('metadata.source')}</span>
                  <div><Badge variant="outline">{item.source}</Badge></div>
                </div>
                {/* Status */}
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">{t('metadata.status')}</span>
                  <div><Badge variant={getStatusBadgeVariant(item.status)}>{statusLabelMap[item.status]}</Badge></div>
                </div>
              </div>

              {categoryLabel && (
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">{t('metadata.category')}</span>
                  {isEditing ? (
                    <select
                      value={draftCategory}
                      onChange={(event) => setDraftCategory(event.target.value)}
                      className="h-9 rounded-md border border-white/45 bg-background/70 px-3 text-sm outline-none transition-colors focus-visible:border-white/80 focus-visible:ring-2 focus-visible:ring-white/20"
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <Badge
                        variant="outline"
                        className="border text-[11px] uppercase tracking-wide"
                        style={categoryBadgeStyle}
                      >
                        {categoryLabel}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* AI Confidence */}
              {item.analysis && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('analysis.confidence')}</span>
                    <span className="font-medium text-muted-foreground">{(item.analysis.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${item.analysis.confidence * 100}%` }} />
                  </div>
                </div>
              )}

              <Separator />

              {/* 2. Distribution Results */}
              <div className="grid gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Share2 className="h-3 w-3" />
                  {t('sections.distribution')}
                </div>
                {distributionEntries.length > 0 ? (
                  <div className="bg-muted/30 rounded-md p-3 space-y-2">
                    {distributionEntries.map((entry) => (
                      <div key={entry.key} className="flex items-center gap-2.5 text-xs">
                        {entry.isSuccess ? (
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500" />
                        ) : (
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                        )}
                        <span className="flex-1 truncate text-muted-foreground">{entry.target}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-1">No distribution.</p>
                )}
              </div>

              <Separator />

              {/* 3. Detailed Metadata (ID, Time, etc) */}
              <div className="grid gap-4 text-xs">
                <div className="grid gap-2">
                  <span className="text-muted-foreground">{t('metadata.contentType')}</span>
                  <div className="flex flex-wrap gap-2">
                    {contentTypeTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[11px] px-2 py-0.5">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('metadata.createdAt')}</span>
                    <span className="font-medium">{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('metadata.updatedAt')}</span>
                    <span className="font-medium">{formatRelativeTime(item.updatedAtLocal ?? item.updatedAt, time)}</span>
                  </div>
                </div>

                <Separator />

                {/* ID (Moved from Header - Full Display) */}
                <div className="grid gap-1">
                  <span className="text-muted-foreground">{t('metadata.id')}</span>
                  <code className="bg-muted rounded px-2 py-1 font-mono text-[10px] break-all select-all">
                    {item.id}
                  </code>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
