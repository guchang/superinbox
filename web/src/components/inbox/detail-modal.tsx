'use client'

import { useEffect, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import {
  Sparkles,
  Send,
  Pencil,
  Clock,
  CheckCircle2,
  Loader2,
  FileText,
  Paperclip,
  Settings2,
  Share2,
  Maximize2,
} from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ContentType, Item, ItemStatus } from '@/types'
import { FilePreview } from '@/components/file-preview'
import { useRoutingProgress } from '@/hooks/use-routing-progress'
import { LinkifiedText } from '@/components/shared/linkified-text'
import { Link } from '@/i18n/navigation'
import { getCategoryBadgeStyle } from '@/lib/category-appearance'

interface DetailModalProps {
  item: Item | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (item: Item) => void
  onReclassify?: (id: string) => void
  onRedistribute?: (id: string) => void
  reclassifying?: boolean
  redistributing?: boolean
  categoryMetaMap?: Map<string, { name: string; icon?: string; color?: string }>
  isEditing?: boolean
  isSavingEdit?: boolean
  categoryOptions?: Array<{ key: string; name: string }>
  onEditingChange?: (editing: boolean) => void
  onSaveEdit?: (payload: { content: string; category: string }) => void | Promise<void>
}

type DistributionEntry = {
  key: string
  target: string
  isSuccess: boolean
}

const getDistributionTargetLabel = (target: unknown, index: number) => {
  if (typeof target === 'string') return target

  if (target && typeof target === 'object') {
    const record = target as Record<string, unknown>
    const candidates = [
      record.name,
      record.targetName,
      record.ruleName,
      record.targetId,
      record.adapter,
      record.id,
      record.type,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate
      }
    }

    try {
      return JSON.stringify(target)
    } catch {
      return `Target ${index + 1}`
    }
  }

  return `Target ${index + 1}`
}

function RoutingProgressDots() {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-[2px] bg-current opacity-40"
          style={{ animation: `routing-dot-pulse 1.2s ease-in-out ${index * 0.08}s infinite` }}
        />
      ))}
    </div>
  )
}

const getStatusBadgeVariant = (status: ItemStatus): 'secondary' | 'outline' | 'default' | 'destructive' => {
  const variants: Record<ItemStatus, 'secondary' | 'outline' | 'default' | 'destructive'> = {
    [ItemStatus.PENDING]: 'secondary',
    [ItemStatus.PROCESSING]: 'outline',
    [ItemStatus.COMPLETED]: 'default',
    [ItemStatus.FAILED]: 'destructive',
  }

  return variants[status] || 'outline'
}

export function DetailModal({
  item,
  isOpen,
  onClose,
  onEdit,
  onReclassify,
  onRedistribute,
  reclassifying,
  redistributing,
  categoryMetaMap,
  isEditing,
  isSavingEdit,
  categoryOptions,
  onEditingChange,
  onSaveEdit,
}: DetailModalProps) {
  const detailT = useTranslations('inboxDetail')
  const inboxT = useTranslations('inbox')
  const time = useTranslations('time')

  const [draftContent, setDraftContent] = useState('')
  const [draftCategory, setDraftCategory] = useState('unknown')

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const isRoutingProcessing = item?.routingStatus === 'processing'
  const routingProgress = useRoutingProgress(
    isOpen && isRoutingProcessing ? item?.id ?? null : null,
    { disabled: !(isOpen && isRoutingProcessing && item?.id) }
  )

  const itemId = item?.id ?? null
  const itemContent = item?.content ?? ''
  const itemCategory = item?.analysis?.category ?? 'unknown'

  useEffect(() => {
    if (!itemId) return
    setDraftContent(itemContent)
    setDraftCategory(itemCategory)
  }, [itemId, itemContent, itemCategory])

  const normalizedCategoryOptions = useMemo(() => {
    const fallback = [
      { key: 'todo', name: detailT('categories.todo') },
      { key: 'idea', name: detailT('categories.idea') },
      { key: 'expense', name: detailT('categories.expense') },
      { key: 'note', name: detailT('categories.note') },
      { key: 'bookmark', name: detailT('categories.bookmark') },
      { key: 'schedule', name: detailT('categories.schedule') },
      { key: 'unknown', name: detailT('categories.unknown') },
    ]

    const baseOptions = categoryOptions && categoryOptions.length > 0 ? categoryOptions : fallback
    const optionMap = new Map<string, string>()

    baseOptions.forEach((option) => {
      const key = String(option.key ?? '').trim()
      const name = String(option.name ?? '').trim()
      if (!key) return
      optionMap.set(key, name || key)
    })

    if (!optionMap.has('unknown')) {
      optionMap.set('unknown', detailT('categories.unknown'))
    }

    if (!optionMap.has(itemCategory)) {
      optionMap.set(itemCategory, itemCategory)
    }

    return Array.from(optionMap.entries()).map(([key, name]) => ({ key, name }))
  }, [categoryOptions, detailT, itemCategory])

  const selectedCategoryKey = isEditing ? draftCategory : itemCategory

  const categoryLabel =
    normalizedCategoryOptions.find((option) => option.key === selectedCategoryKey)?.name ||
    categoryMetaMap?.get(selectedCategoryKey)?.name ||
    ({
      todo: detailT('categories.todo'),
      idea: detailT('categories.idea'),
      expense: detailT('categories.expense'),
      note: detailT('categories.note'),
      bookmark: detailT('categories.bookmark'),
      schedule: detailT('categories.schedule'),
      unknown: detailT('categories.unknown'),
    }[selectedCategoryKey] || selectedCategoryKey)

  const categoryBadgeStyle = getCategoryBadgeStyle(
    selectedCategoryKey,
    categoryMetaMap?.get(selectedCategoryKey)?.color,
    isDark ? 'dark' : 'light'
  )

  const isAnalyzing = item?.status === ItemStatus.PROCESSING
  const liveRoutingTarget = String(routingProgress.matchedTargetName || '').trim()
  const liveRoutingTitle = liveRoutingTarget
    ? `${categoryLabel} → ${liveRoutingTarget}`
    : categoryLabel

  const contentText = itemContent.trim()
  const hasContentText = contentText.length > 0

  const statusLabelMap: Record<ItemStatus, string> = {
    [ItemStatus.PENDING]: detailT('status.pending'),
    [ItemStatus.PROCESSING]: detailT('status.processing'),
    [ItemStatus.COMPLETED]: detailT('status.completed'),
    [ItemStatus.FAILED]: detailT('status.failed'),
  }

  const contentTypeTags = useMemo(() => {
    if (!item) return []

    const tags = new Set<string>()
    const content = item.content?.trim() ?? ''

    if (item.contentType === ContentType.URL) {
      tags.add(detailT('contentType.url'))
    } else if (content) {
      tags.add(detailT('contentType.text'))
    }

    const fileSources = item.allFiles && item.allFiles.length > 0
      ? item.allFiles
      : item.mimeType
        ? [{ mimeType: item.mimeType }]
        : []

    for (const file of fileSources) {
      const mimeType = file?.mimeType?.toLowerCase() ?? ''
      if (mimeType.startsWith('image/')) {
        tags.add(detailT('contentType.image'))
      } else if (mimeType.startsWith('audio/')) {
        tags.add(detailT('contentType.audio'))
      } else if (mimeType.startsWith('video/')) {
        tags.add(detailT('contentType.video'))
      } else {
        tags.add(detailT('contentType.file'))
      }
    }

    if (tags.size === 0) {
      if (item.contentType === ContentType.IMAGE) {
        tags.add(detailT('contentType.image'))
      } else if (item.contentType === ContentType.AUDIO) {
        tags.add(detailT('contentType.audio'))
      } else if (item.contentType === ContentType.VIDEO) {
        tags.add(detailT('contentType.video'))
      } else if (item.contentType === ContentType.FILE) {
        tags.add(detailT('contentType.file'))
      } else if (item.contentType === ContentType.TEXT) {
        tags.add(detailT('contentType.text'))
      }
    }

    return Array.from(tags)
  }, [item, detailT])

  const entityEntries = useMemo(() => {
    const groups = (item?.analysis?.entities || []).reduce<Record<string, string[]>>(
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

    return Object.entries(groups)
  }, [item?.analysis?.entities])

  const distributionEntries = useMemo<DistributionEntry[]>(() => {
    const results = item?.distributionResults

    if (results) {
      if (Array.isArray(results)) {
        return results.map((result: any, index: number) => {
          const target = getDistributionTargetLabel(result, index)
          const status = result?.status || (result?.success ? 'success' : 'failed')
          const isSuccess = status === 'success' || status === 'completed'
          return { key: `${target}-${index}`, target, isSuccess }
        })
      }

      return Object.entries(results).map(([target, result], index) => {
        const status = (result as any)?.status || ((result as any)?.success ? 'success' : 'failed')
        const isSuccess = status === 'success' || status === 'completed'
        return { key: `${target}-${index}`, target, isSuccess }
      })
    }

    const targets = item?.distributedTargets ?? []

    return targets.map((target, index) => ({
      key: `target-${index}`,
      target: getDistributionTargetLabel(target, index),
      isSuccess: true,
    }))
  }, [item?.distributionResults, item?.distributedTargets])

  const canEditInModal = Boolean(onEditingChange && onSaveEdit)

  const handleStartEdit = useCallback(() => {
    if (!item) return

    if (canEditInModal) {
      onEditingChange?.(true)
      return
    }

    onEdit?.(item)
  }, [canEditInModal, onEditingChange, onEdit, item])

  const handleCancelEdit = useCallback(() => {
    setDraftContent(itemContent)
    setDraftCategory(itemCategory)
    onEditingChange?.(false)
  }, [itemContent, itemCategory, onEditingChange])

  const handleSaveEdit = useCallback(async () => {
    if (!onSaveEdit) return

    await onSaveEdit({
      content: draftContent,
      category: draftCategory,
    })
  }, [onSaveEdit, draftContent, draftCategory])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      onClose()
    }
  }, [onClose])

  if (!item) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'max-w-6xl max-h-[92vh] overflow-hidden p-0 gap-0',
          '[&>button:last-child]:h-9 [&>button:last-child]:w-9 [&>button:last-child]:rounded-full',
          '[&>button:last-child]:right-4 [&>button:last-child]:top-4 [&>button:last-child]:opacity-75'
        )}
      >
        <DialogTitle className="sr-only">{detailT('title')}</DialogTitle>
        <DialogDescription className="sr-only">{detailT('subtitle', { id: item.id })}</DialogDescription>

        <div className="relative px-4 pt-3.5 pb-2 sm:px-6">
          <p className="truncate pr-20 text-base font-semibold text-foreground">{detailT('title')}</p>
          <p className="truncate pr-20 text-xs text-muted-foreground">{item.id}</p>

          <Button
            asChild
            variant="ghost"
            size="icon"
            className="absolute right-14 top-3.5 h-9 w-9 rounded-full"
            aria-label={detailT('actions.openInPage')}
          >
            <Link href={`/inbox/${item.id}`} onClick={onClose}>
              <Maximize2 className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="max-h-[calc(92vh-7.25rem)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid gap-6 md:grid-cols-12 lg:gap-8">
            <div className="md:col-span-8 flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {detailT('sections.content')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <Textarea
                      value={draftContent}
                      onChange={(event) => setDraftContent(event.target.value)}
                      className="min-h-[140px] border border-white/45 bg-background/70 text-sm leading-relaxed focus-visible:border-white/80 focus-visible:ring-white/30"
                      placeholder={detailT('edit.placeholder')}
                    />
                  ) : (
                    <div className={cn(
                      'text-sm leading-relaxed min-h-[120px]',
                      item.contentType === ContentType.URL ? 'font-mono break-all text-blue-600' : 'whitespace-pre-wrap break-words'
                    )}>
                      {hasContentText ? (
                        <LinkifiedText
                          text={contentText}
                          linkClassName="text-current hover:opacity-80"
                        />
                      ) : (
                        <span className="text-muted-foreground italic">{detailT('content.empty')}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {item.hasFile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      {detailT('sections.attachments')}
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

              {(item.analysis?.summary || entityEntries.length > 0 || isAnalyzing) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      {detailT('sections.analysis')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6">
                    {isAnalyzing ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">{detailT('analysis.analyzing')}</span>
                      </div>
                    ) : (
                      <>
                        {item.analysis?.summary && (
                          <div className="grid gap-2">
                            <span className="text-sm font-medium text-muted-foreground">{detailT('analysis.summary')}</span>
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
                            <span className="text-sm font-medium text-muted-foreground">{detailT('analysis.entities')}</span>
                            <div className="flex flex-wrap gap-1.5">
                              {entityEntries.flatMap(([type, values]) =>
                                values.map((val, index) => (
                                  <Badge key={`${type}-${index}`} variant="secondary" className="font-normal">
                                    {val}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="md:col-span-4 flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    {detailT('sections.properties')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <span className="text-xs text-muted-foreground">{detailT('metadata.source')}</span>
                      <div><Badge variant="outline">{item.source}</Badge></div>
                    </div>
                    <div className="grid gap-1.5">
                      <span className="text-xs text-muted-foreground">{detailT('metadata.status')}</span>
                      <div><Badge variant={getStatusBadgeVariant(item.status)}>{statusLabelMap[item.status]}</Badge></div>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">{detailT('metadata.category')}</span>
                    {isEditing ? (
                      <select
                        value={draftCategory}
                        onChange={(event) => setDraftCategory(event.target.value)}
                        className="h-9 rounded-md border border-white/45 bg-background/70 px-3 text-sm outline-none transition-colors focus-visible:border-white/80 focus-visible:ring-2 focus-visible:ring-white/20"
                      >
                        {normalizedCategoryOptions.map((option) => (
                          <option key={option.key} value={option.key}>{option.name}</option>
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

                  {typeof item.analysis?.confidence === 'number' && (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{detailT('analysis.confidence')}</span>
                        <span className="font-medium text-muted-foreground">{(item.analysis.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, item.analysis.confidence * 100))}%` }} />
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Share2 className="h-3 w-3" />
                      {detailT('sections.distribution')}
                    </div>

                    {isRoutingProcessing && (
                      <div className="rounded-md bg-muted/30 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                          <span className="truncate">{categoryLabel}</span>
                          <RoutingProgressDots />
                          <span className="truncate" title={liveRoutingTitle}>
                            {liveRoutingTarget || inboxT('routingStatus.processing')}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground break-words">
                          {routingProgress.message || inboxT('routingStatus.processing')}
                        </p>
                      </div>
                    )}

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

                  <div className="grid gap-4 text-xs">
                    <div className="grid gap-2">
                      <span className="text-muted-foreground">{detailT('metadata.contentType')}</span>
                      <div className="flex flex-wrap gap-2">
                        {contentTypeTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[11px] px-2 py-0.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{detailT('metadata.createdAt')}</span>
                        <span className="font-medium text-right">{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{detailT('metadata.updatedAt')}</span>
                        <span className="font-medium text-right">{formatRelativeTime(item.updatedAtLocal ?? item.updatedAt, time)}</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-1">
                      <span className="text-muted-foreground">{detailT('metadata.id')}</span>
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

        <div className="px-4 pb-3 pt-2 sm:px-6">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {isEditing ? (
              <>
                <Button
                  onClick={handleCancelEdit}
                  variant="outline"
                  className="h-9 rounded-lg"
                  disabled={Boolean(isSavingEdit)}
                >
                  {detailT('actions.cancelEdit')}
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  className="h-9 rounded-lg"
                  disabled={Boolean(isSavingEdit)}
                >
                  {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {detailT('actions.saveEdit')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleStartEdit}
                  disabled={isAnalyzing}
                  variant="outline"
                  className="h-9 rounded-lg border-white/80 bg-white text-slate-900 hover:bg-white/90 hover:text-slate-950 dark:border-white/90 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                >
                  <Pencil className="h-4 w-4" />
                  {detailT('actions.editContent')}
                </Button>

                {onReclassify && (
                  <Button
                    onClick={() => onReclassify(item.id)}
                    disabled={isAnalyzing || reclassifying}
                    variant="outline"
                    className="h-9 rounded-lg"
                  >
                    {reclassifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {detailT('actions.reclassify')}
                  </Button>
                )}

                <Button
                  onClick={() => onRedistribute?.(item.id)}
                  disabled={isAnalyzing || redistributing}
                  variant="outline"
                  className="h-9 rounded-lg border-white/80 bg-white text-slate-900 hover:bg-white/90 hover:text-slate-950 dark:border-white/90 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                >
                  {redistributing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {detailT('actions.redistribute')}
                </Button>
              </>
            )}
          </div>
        </div>

        <style jsx>{`
          @keyframes routing-dot-pulse {
            0% { opacity: 0.2; transform: scale(0.82); }
            50% { opacity: 0.75; transform: scale(1); }
            100% { opacity: 0.2; transform: scale(0.82); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}
