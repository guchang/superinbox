'use client'

import { useEffect, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import {
  Sparkles,
  Send,
  Pencil,
  Loader2,
  MoreHorizontal,
  Maximize2,
  Copy,
  Check,
  ChevronDown,
  Clock,
} from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Item, ItemStatus } from '@/types'
import { FilePreview } from '@/components/file-preview'
import { MarkdownContent } from '@/components/shared/markdown-content'
import { Link } from '@/i18n/navigation'
import { getCategoryBadgeStyle } from '@/lib/category-appearance'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

type DistributionEntryStatus = 'success' | 'failed' | 'processing' | 'pending'

type DistributionEntry = {
  key: string
  target: string
  status: DistributionEntryStatus
  timestamp?: string
  error?: string
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

const normalizeDistributionStatus = (status: unknown, success: unknown): DistributionEntryStatus => {
  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase()
    if (normalized === 'success' || normalized === 'completed') return 'success'
    if (normalized === 'failed' || normalized === 'error') return 'failed'
    if (normalized === 'processing' || normalized === 'running' || normalized === 'in_progress') return 'processing'
    if (normalized === 'pending' || normalized === 'queued' || normalized === 'waiting') return 'pending'
  }

  if (typeof success === 'boolean') {
    return success ? 'success' : 'failed'
  }

  return 'pending'
}

const normalizeDistributionError = (error: unknown): string | undefined => {
  if (!error) return undefined
  if (typeof error === 'string') {
    const normalized = error.trim()
    return normalized ? normalized : undefined
  }

  if (error instanceof Error) {
    const normalized = error.message.trim()
    return normalized ? normalized : undefined
  }

  try {
    const normalized = JSON.stringify(error)
    return normalized === '{}' ? undefined : normalized
  } catch {
    return undefined
  }
}

const buildDistributionEntries = (item: Item | null, isRoutingProcessing: boolean): DistributionEntry[] => {
  if (!item) return []

  const entries: DistributionEntry[] = []

  const pushEntry = ({
    target,
    index,
    status,
    success,
    timestamp,
    error,
    key,
  }: {
    target: unknown
    index: number
    status?: unknown
    success?: unknown
    timestamp?: unknown
    error?: unknown
    key?: string
  }) => {
    const targetLabel = getDistributionTargetLabel(target, index)
    entries.push({
      key: key ?? `${targetLabel}-${index}`,
      target: targetLabel,
      status: normalizeDistributionStatus(status, success),
      timestamp: typeof timestamp === 'string' ? timestamp : undefined,
      error: normalizeDistributionError(error),
    })
  }

  const results = item.distributionResults
  if (Array.isArray(results)) {
    results.forEach((result, index) => {
      if (result && typeof result === 'object') {
        const record = result as Record<string, unknown>
        pushEntry({
          target: record.ruleName ?? record.targetId ?? record.targetName ?? record.adapter ?? result,
          index,
          status: record.status,
          success: record.success,
          timestamp: record.timestamp ?? record.updatedAt ?? record.createdAt,
          error: record.error ?? record.message,
          key: typeof record.id === 'string' ? record.id : undefined,
        })
        return
      }

      pushEntry({
        target: result,
        index,
        status: undefined,
        success: undefined,
      })
    })
  } else if (results && typeof results === 'object') {
    Object.entries(results).forEach(([target, result], index) => {
      if (result && typeof result === 'object') {
        const record = result as Record<string, unknown>
        pushEntry({
          target,
          index,
          status: record.status,
          success: record.success,
          timestamp: record.timestamp ?? record.updatedAt ?? record.createdAt,
          error: record.error ?? record.message,
          key: target,
        })
        return
      }

      pushEntry({
        target,
        index,
        status: undefined,
        success: result,
        key: target,
      })
    })
  }

  if (entries.length === 0) {
    const fallbackTargets =
      isRoutingProcessing && (item.routingPreviewTargets?.length ?? 0) > 0
        ? item.routingPreviewTargets ?? []
        : item.distributedTargets ?? []

    fallbackTargets.forEach((target, index) => {
      pushEntry({
        target,
        index,
        status: isRoutingProcessing ? 'processing' : item.routingStatus === 'failed' ? 'failed' : 'success',
        key: `fallback-${index}`,
      })
    })
  }

  return entries
}

const getItemStatusToneClass = (status: ItemStatus) => {
  if (status === ItemStatus.FAILED) {
    return 'border-rose-300/80 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200'
  }

  if (status === ItemStatus.COMPLETED) {
    return 'border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200'
  }

  if (status === ItemStatus.MANUAL) {
    return 'border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200'
  }

  if (status === ItemStatus.PROCESSING) {
    return 'border-blue-300/80 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200'
  }

  return 'border-zinc-300/80 bg-zinc-50 text-zinc-700 dark:border-zinc-500/40 dark:bg-zinc-500/10 dark:text-zinc-200'
}

const getDistributionStatusToneClass = (status: DistributionEntryStatus) => {
  if (status === 'failed') {
    return 'border-rose-300/80 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200'
  }

  if (status === 'success') {
    return 'border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200'
  }

  if (status === 'processing') {
    return 'border-blue-300/80 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200'
  }

  return 'border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200'
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
  const [showMetadata, setShowMetadata] = useState(false)
  const [copiedContent, setCopiedContent] = useState(false)
  const [isCategorySaving, setIsCategorySaving] = useState(false)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const isRoutingProcessing = item?.routingStatus === 'processing'
  const routingStatus = item?.routingStatus

  const itemId = item?.id ?? null
  const itemContent = item?.content ?? ''
  const itemCategory = item?.analysis?.category ?? 'unknown'

  useEffect(() => {
    if (!itemId) return
    setDraftContent(itemContent)
    setDraftCategory(itemCategory)
  }, [itemId, itemContent, itemCategory])

  useEffect(() => {
    setCopiedContent(false)
  }, [itemId, isOpen])

  const unclassifiedLabel = detailT('metadata.unclassified')

  const normalizedCategoryOptions = useMemo(() => {
    const fallback = [
      { key: 'todo', name: detailT('categories.todo') },
      { key: 'idea', name: detailT('categories.idea') },
      { key: 'expense', name: detailT('categories.expense') },
      { key: 'note', name: detailT('categories.note') },
      { key: 'bookmark', name: detailT('categories.bookmark') },
      { key: 'schedule', name: detailT('categories.schedule') },
      { key: 'unknown', name: unclassifiedLabel },
    ]

    const baseOptions = categoryOptions && categoryOptions.length > 0 ? categoryOptions : fallback
    const optionMap = new Map<string, string>()

    baseOptions.forEach((option) => {
      const key = String(option.key ?? '').trim()
      const name = String(option.name ?? '').trim()
      if (!key) return
      optionMap.set(key, name || (key === 'unknown' ? unclassifiedLabel : key))
    })

    if (!optionMap.has('unknown')) {
      optionMap.set('unknown', unclassifiedLabel)
    }

    if (!optionMap.has(itemCategory)) {
      optionMap.set(itemCategory, itemCategory === 'unknown' ? unclassifiedLabel : itemCategory)
    }

    return Array.from(optionMap.entries()).map(([key, name]) => ({ key, name }))
  }, [categoryOptions, detailT, itemCategory, unclassifiedLabel])

  const selectedCategoryKey = draftCategory || itemCategory

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
      unknown: unclassifiedLabel,
    }[selectedCategoryKey] || selectedCategoryKey)

  const categoryBadgeStyle = getCategoryBadgeStyle(
    selectedCategoryKey,
    categoryMetaMap?.get(selectedCategoryKey)?.color,
    isDark ? 'dark' : 'light'
  )

  const isAnalyzing = item?.status === ItemStatus.PROCESSING

  const contentText = itemContent.trim()

  const statusLabelMap: Record<ItemStatus, string> = {
    [ItemStatus.PENDING]: detailT('status.pending'),
    [ItemStatus.PROCESSING]: detailT('status.processing'),
    [ItemStatus.COMPLETED]: detailT('status.completed'),
    [ItemStatus.MANUAL]: detailT('status.manual'),
    [ItemStatus.FAILED]: detailT('status.failed'),
  }

  const canEditInModal = Boolean(onEditingChange && onSaveEdit)
  const canEditCategory = Boolean(onSaveEdit)

  const distributionEntries = useMemo(() => buildDistributionEntries(item, isRoutingProcessing), [item, isRoutingProcessing])

  const distributionStats = useMemo(() => {
    return distributionEntries.reduce((stats, entry) => {
      stats.total += 1
      stats[entry.status] += 1
      return stats
    }, { success: 0, failed: 0, processing: 0, pending: 0, total: 0 })
  }, [distributionEntries])

  const distributionSummary = useMemo(() => {
    if (distributionStats.total === 0) {
      if (routingStatus === 'skipped') return detailT('distribution.skipped')
      if (routingStatus === 'failed') return detailT('distribution.failure')
      if (isRoutingProcessing || routingStatus === 'processing') return detailT('distribution.processing')
      return detailT('distribution.pending')
    }

    const segments: string[] = []
    if (distributionStats.success > 0) {
      segments.push(detailT('distribution.breakdown.success', { count: distributionStats.success }))
    }
    if (distributionStats.failed > 0) {
      segments.push(detailT('distribution.breakdown.failed', { count: distributionStats.failed }))
    }
    if (distributionStats.processing > 0) {
      segments.push(detailT('distribution.breakdown.processing', { count: distributionStats.processing }))
    }
    if (distributionStats.pending > 0) {
      segments.push(detailT('distribution.breakdown.pending', { count: distributionStats.pending }))
    }

    return segments.join(' / ')
  }, [detailT, distributionStats, isRoutingProcessing, routingStatus])

  const formatDistributionTimestamp = useCallback((value?: string) => {
    if (!value) return detailT('distribution.none')
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return formatRelativeTime(value, time)
  }, [detailT, time])

  const mapDistributionStatusLabel = useCallback((status: DistributionEntryStatus) => {
    if (status === 'success') return detailT('distribution.success')
    if (status === 'failed') return detailT('distribution.failure')
    if (status === 'processing') return detailT('distribution.processing')
    return detailT('distribution.pending')
  }, [detailT])

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

  const handleCategoryChange = useCallback(async (nextCategory: string) => {
    setDraftCategory(nextCategory)
    if (isEditing || !onSaveEdit || !itemId || nextCategory === itemCategory) return

    setIsCategorySaving(true)
    try {
      await onSaveEdit({
        content: itemContent,
        category: nextCategory,
      })
    } catch {
      setDraftCategory(itemCategory)
    } finally {
      setIsCategorySaving(false)
    }
  }, [isEditing, itemCategory, itemContent, itemId, onSaveEdit])

  const handleCopyRawContent = useCallback(async () => {
    if (!itemContent) return

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(itemContent)
      }

      setCopiedContent(true)
      window.setTimeout(() => setCopiedContent(false), 1500)
    } catch (error) {
      setCopiedContent(false)
      console.error('Failed to copy content:', error)
    }
  }, [itemContent])

  if (!item) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'w-[min(95vw,1380px)] max-w-none max-h-[88vh] overflow-hidden p-0 gap-0 flex flex-col sm:rounded-[24px]',
          '[&>button:last-child]:top-4 [&>button:last-child]:right-3 sm:[&>button:last-child]:right-4'
        )}
      >
        <DialogTitle className="sr-only">{detailT('title')}</DialogTitle>
        <DialogDescription className="sr-only">{detailT('subtitle', { id: item.id })}</DialogDescription>

        {/* Header */}
        <div className="border-b px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 sm:gap-x-4">
            {/* 左侧：分类选择器 + 时间 + 来源 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground/80 hidden sm:inline whitespace-nowrap">
                  {detailT('metadata.category')}
                </span>
                <Select
                  value={selectedCategoryKey}
                  onValueChange={(nextCategory) => {
                    void handleCategoryChange(nextCategory)
                  }}
                  disabled={Boolean(isSavingEdit) || isCategorySaving}
                >
                  <SelectTrigger className="h-7 px-2.5 py-1 min-w-[120px] sm:min-w-[140px] border border-border bg-background/80 backdrop-blur-sm hover:bg-accent/50 focus:ring-1 focus:ring-ring/50 focus:ring-offset-0 transition-colors">
                    <SelectValue className="text-xs" />
                  </SelectTrigger>
                  <SelectContent>
                    {normalizedCategoryOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key} className="text-xs">
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {item.createdAt && (
                  <>
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</span>
                  </>
                )}
                {item.source && (
                  <>
                    <span className="w-1 h-1 shrink-0 rounded-full bg-border" />
                    <span className="truncate hidden sm:inline">{item.source}</span>
                  </>
                )}
              </div>
            </div>

            {/* 中间：空白区域，推开左右两侧 */}
            <div />

            {/* 右侧：放大按钮（在关闭按钮左侧） */}
            <div className="flex items-center justify-end pr-10 sm:pr-11">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent/50"
                aria-label={detailT('actions.openInPage')}
              >
                <Link href={`/inbox/${item.id}`} onClick={onClose}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="space-y-5">
            {/* Main Content */}
            <div className="space-y-3">
              {isEditing ? (
                <Textarea
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                  className="min-h-[220px] resize-none border border-border bg-background/40 p-4 text-base leading-relaxed focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={detailT('edit.placeholder')}
                  autoFocus
                />
              ) : (
                <>
                  {/* Content Display */}
                  <div className="text-base leading-relaxed">
                    <MarkdownContent
                      text={contentText}
                      emptyText={detailT('content.empty')}
                    />
                  </div>

                  {/* File Preview */}
                  {item.hasFile && (
                    <div className="pt-2">
                      <FilePreview
                        itemId={item.id}
                        fileName={item.fileName}
                        mimeType={item.mimeType}
                        allFiles={item.allFiles}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Distribution Info */}
            {!isEditing && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Send className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{detailT('sections.distribution')}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{distributionSummary}</span>
                </div>

                {isRoutingProcessing && (
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{inboxT('routingStatus.processing')}</span>
                  </div>
                )}

                {distributionEntries.length > 0 ? (
                  <div className="space-y-2">
                    {distributionEntries.map((entry) => (
                      <div
                        key={entry.key}
                        className="grid gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{entry.target}</p>
                          {entry.error ? (
                            <p className="mt-0.5 truncate text-xs text-rose-600/90 dark:text-rose-300/90">{entry.error}</p>
                          ) : null}
                        </div>

                        <Badge
                          variant="outline"
                          className={cn('h-6 w-fit px-2 text-[11px] font-medium', getDistributionStatusToneClass(entry.status))}
                        >
                          {mapDistributionStatusLabel(entry.status)}
                        </Badge>

                        <span className="text-[11px] text-muted-foreground">
                          {formatDistributionTimestamp(entry.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{detailT('distribution.empty')}</p>
                )}
              </div>
            )}

            {/* Expandable Metadata */}
            {!isEditing && (
              <div>
                <button
                  onClick={() => setShowMetadata(!showMetadata)}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>{showMetadata ? detailT('details.hide') : detailT('details.show')}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showMetadata && 'rotate-180')} />
                </button>

                {showMetadata && (
                  <div className="mt-4 space-y-4 rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                    {/* Analysis Summary */}
                    {item.analysis?.summary && (
                      <div className="space-y-2">
                        <span className="font-medium text-foreground/80">{detailT('analysis.summary')}</span>
                        <p className="leading-relaxed">{item.analysis.summary}</p>
                      </div>
                    )}

                    {item.distributedRuleNames && item.distributedRuleNames.length > 0 && (
                      <div className="space-y-1">
                        <span className="font-medium text-foreground/80">{detailT('sections.rules')}</span>
                        <p className="break-words leading-relaxed">{item.distributedRuleNames.join(' / ')}</p>
                      </div>
                    )}

                    {/* ID */}
                    <div className="font-mono text-[10px] break-all select-all">
                      ID: {item.id}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <Separator />

        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  onClick={handleCancelEdit}
                  variant="ghost"
                  size="sm"
                  disabled={Boolean(isSavingEdit)}
                  className="h-8 text-xs"
                >
                  {detailT('actions.cancelEdit')}
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  size="sm"
                  disabled={Boolean(isSavingEdit)}
                  className="h-8 text-xs"
                >
                  {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {detailT('actions.saveEdit')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleStartEdit}
                  disabled={isAnalyzing}
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {detailT('actions.editContent')}
                </Button>

                <Button
                  onClick={() => onRedistribute?.(item.id)}
                  disabled={isAnalyzing || redistributing}
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  {redistributing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {detailT('actions.redistribute')}
                </Button>
              </>
            )}
          </div>

          {!isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent/50"
                  disabled={isAnalyzing}
                  aria-label={inboxT('actions.more')}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    void handleCopyRawContent()
                  }}
                  disabled={!itemContent}
                >
                  {copiedContent ? <Check className="h-3.5 w-3.5 mr-2" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
                  {detailT('actions.copyRaw')}
                </DropdownMenuItem>

                {onReclassify && (
                  <DropdownMenuItem
                    onClick={() => onReclassify(item.id)}
                    disabled={isAnalyzing || reclassifying}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-2" />
                    {detailT('actions.reclassify')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
