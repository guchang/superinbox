'use client'

import { useEffect, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import {
  Sparkles,
  Send,
  Pencil,
  CheckCircle2,
  Loader2,
  FileText,
  Paperclip,
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
import { ContentType, Item, ItemStatus } from '@/types'
import { FilePreview } from '@/components/file-preview'
import { useRoutingProgress } from '@/hooks/use-routing-progress'
import { MarkdownContent } from '@/components/shared/markdown-content'
import { Link } from '@/i18n/navigation'
import { getCategoryBadgeStyle } from '@/lib/category-appearance'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  const common = useTranslations('common')

  const [draftContent, setDraftContent] = useState('')
  const [draftCategory, setDraftCategory] = useState('unknown')
  const [showMetadata, setShowMetadata] = useState(false)
  const [copiedContent, setCopiedContent] = useState(false)

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

  useEffect(() => {
    setCopiedContent(false)
  }, [itemId, isOpen])

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

  const contentText = itemContent.trim()

  const statusLabelMap: Record<ItemStatus, string> = {
    [ItemStatus.PENDING]: detailT('status.pending'),
    [ItemStatus.PROCESSING]: detailT('status.processing'),
    [ItemStatus.COMPLETED]: detailT('status.completed'),
    [ItemStatus.FAILED]: detailT('status.failed'),
  }

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
          'max-w-3xl max-h-[92vh] overflow-hidden p-0 gap-0',
          '[&>button:last-child]:top-4 [&>button:last-child]:right-4'
        )}
      >
        <DialogTitle className="sr-only">{detailT('title')}</DialogTitle>
        <DialogDescription className="sr-only">{detailT('subtitle', { id: item.id })}</DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={detailT('actions.openInPage')}
            >
              <Link href={`/inbox/${item.id}`} onClick={onClose}>
                <Maximize2 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="max-h-[calc(92vh-10rem)] overflow-y-auto px-6">
          <div className="space-y-6 py-4">
            {/* Main Content */}
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <Textarea
                    value={draftContent}
                    onChange={(event) => setDraftContent(event.target.value)}
                    className="min-h-[200px] resize-none border-0 bg-transparent p-0 text-base leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder={detailT('edit.placeholder')}
                    autoFocus
                  />

                  {/* Category Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{detailT('metadata.category')}</span>
                    <select
                      value={draftCategory}
                      onChange={(event) => setDraftCategory(event.target.value)}
                      className="h-7 rounded-md border-0 bg-transparent px-2 text-xs font-medium focus-visible:ring-0"
                    >
                      {normalizedCategoryOptions.map((option) => (
                        <option key={option.key} value={option.key}>{option.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Content Display */}
                  <div className="min-h-[120px] text-base leading-relaxed">
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

                  {/* Metadata Footer */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                    {/* Category Badge */}
                    <Badge
                      variant="outline"
                      className="border text-[11px] uppercase tracking-wide"
                      style={categoryBadgeStyle}
                    >
                      {categoryLabel}
                    </Badge>

                    {/* Status */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{detailT('status.processing')}</span>
                        </>
                      ) : (
                        <span>{statusLabelMap[item.status]}</span>
                      )}
                    </div>

                    {/* Source */}
                    <span className="text-xs text-muted-foreground">{item.source}</span>

                    {/* Copy Button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyRawContent}
                      disabled={!itemContent}
                      className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copiedContent ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Expandable Metadata */}
            {!isEditing && (
              <div className="pt-2">
                <button
                  onClick={() => setShowMetadata(!showMetadata)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{showMetadata ? '隐藏' : '显示'}详细信息</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showMetadata && 'rotate-180')} />
                </button>

                {showMetadata && (
                  <div className="mt-4 space-y-4 text-xs text-muted-foreground">
                    {/* Analysis Summary */}
                    {item.analysis?.summary && (
                      <div className="space-y-2">
                        <span className="font-medium">{detailT('analysis.summary')}</span>
                        <p className="leading-relaxed">{item.analysis.summary}</p>
                      </div>
                    )}

                    {/* Distribution Info */}
                    {(isRoutingProcessing || item.distributedTargets || item.distributionResults) && (
                      <div className="space-y-2">
                        <span className="font-medium">{detailT('sections.distribution')}</span>
                        {isRoutingProcessing && (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-primary">{inboxT('routingStatus.processing')}</span>
                          </div>
                        )}
                        {item.distributedTargets && item.distributedTargets.length > 0 && (
                          <div className="space-y-1">
                            {item.distributedTargets.map((target, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                <span>{getDistributionTargetLabel(target, index)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ID */}
                    <div className="font-mono text-[10px] select-all break-all">
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isAnalyzing}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {onReclassify && (
                      <DropdownMenuItem
                        onClick={() => onReclassify(item.id)}
                        disabled={isAnalyzing || reclassifying}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {detailT('actions.reclassify')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => onRedistribute?.(item.id)}
                      disabled={isAnalyzing || redistributing}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {detailT('actions.redistribute')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
