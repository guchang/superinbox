"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import { ContentType, ItemStatus } from '@/types'
import { ArrowLeft, RefreshCw, Sparkles, Trash2, Loader2, Share2, FileText, AlertCircle, Paperclip, Settings2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { FilePreview } from '@/components/file-preview'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { LinkifiedText } from '@/components/shared/linkified-text'
import { DetailMarkdownEditor } from '@/components/inbox/detail-markdown-editor'

function normalizeDraftContent(value: string) {
  return value.replace(/\r\n/g, '\n')
}

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
  const [draftContent, setDraftContent] = useState('')
  const [draftCategory, setDraftCategory] = useState('unknown')
  const [savedSnapshot, setSavedSnapshot] = useState<{ content: string; category: string } | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const queuedSnapshotRef = useRef<{ content: string; category: string } | null>(null)
  const isPersistingRef = useRef(false)
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
    const snapshot = {
      content: normalizeDraftContent(currentItemContent),
      category: currentItemCategory,
    }
    setDraftContent(snapshot.content)
    setDraftCategory(snapshot.category)
    setSavedSnapshot(snapshot)
    setAutoSaveStatus('idle')
    queuedSnapshotRef.current = null
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
      queryClient.setQueryData(['inbox', id], (previous: any) => {
        if (!previous || typeof previous !== 'object') return previous

        return {
          ...previous,
          data: {
            ...previous.data,
            ...updatedItem,
            content: normalizeDraftContent(updatedItem.content ?? previous.data?.content ?? ''),
            analysis: {
              ...previous.data?.analysis,
              ...updatedItem.analysis,
            },
          },
        }
      })
    },
  })

  const canEditItem = item != null && item.status !== ItemStatus.PROCESSING
  const hasUnsavedChanges = savedSnapshot != null
    && (
      normalizeDraftContent(draftContent) !== savedSnapshot.content
      || draftCategory !== savedSnapshot.category
    )

  const persistSnapshot = useCallback(
    async (snapshot: { content: string; category: string }) => {
      if (!canEditItem) return

      if (isPersistingRef.current) {
        queuedSnapshotRef.current = snapshot
        return
      }

      isPersistingRef.current = true
      setAutoSaveStatus('saving')
      let nextSnapshot: { content: string; category: string } | null = null

      try {
        const updatedItem = await updateMutation.mutateAsync(snapshot)
        const syncedSnapshot = {
          content: normalizeDraftContent(updatedItem.content ?? snapshot.content),
          category: updatedItem.analysis?.category ?? snapshot.category,
        }

        setSavedSnapshot(syncedSnapshot)
        setAutoSaveStatus('saved')

        const queuedSnapshot = queuedSnapshotRef.current
        queuedSnapshotRef.current = null

        if (
          queuedSnapshot
          && (
            queuedSnapshot.content !== syncedSnapshot.content
            || queuedSnapshot.category !== syncedSnapshot.category
          )
        ) {
          nextSnapshot = queuedSnapshot
        }
      } catch (error) {
        queuedSnapshotRef.current = null
        setAutoSaveStatus('error')
      } finally {
        isPersistingRef.current = false
      }

      if (nextSnapshot) {
        void persistSnapshot(nextSnapshot)
      }
    },
    [canEditItem, updateMutation]
  )

  useEffect(() => {
    if (!canEditItem || !savedSnapshot || !hasUnsavedChanges) return

    const snapshot = {
      content: normalizeDraftContent(draftContent),
      category: draftCategory,
    }

    const timer = window.setTimeout(() => {
      void persistSnapshot(snapshot)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [canEditItem, savedSnapshot, hasUnsavedChanges, draftContent, draftCategory, persistSnapshot])

  const autoSaveLabel = useMemo(() => {
    if (!canEditItem) return t('edit.autoSave.disabled')
    if (autoSaveStatus === 'saving') return t('edit.autoSave.saving')
    if (autoSaveStatus === 'error') return t('edit.autoSave.error')
    if (hasUnsavedChanges) return t('edit.autoSave.pending')
    if (autoSaveStatus === 'saved') return t('edit.autoSave.saved')
    return ''
  }, [autoSaveStatus, canEditItem, hasUnsavedChanges, t])

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
      {/* Header Area */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        {/* 页面标题（现在顶部 header 有面包屑了，这里可以简化） */}
        <div />

        {/* Global Page Actions */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-muted-foreground mr-1">
            {autoSaveLabel}
          </span>

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
            <CardContent className="grid gap-2">
              <div className="sm:hidden text-xs text-muted-foreground">
                {autoSaveLabel}
              </div>
              <DetailMarkdownEditor
                value={draftContent}
                onChange={setDraftContent}
                placeholder={t('edit.placeholder')}
                disabled={!canEditItem}
              />
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

              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">{t('metadata.category')}</span>
                <select
                  value={draftCategory}
                  onChange={(event) => setDraftCategory(event.target.value)}
                  className="h-9 rounded-md border border-white/45 bg-background/70 px-3 text-sm outline-none transition-colors focus-visible:border-white/80 focus-visible:ring-2 focus-visible:ring-white/20"
                  disabled={!canEditItem}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>

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
