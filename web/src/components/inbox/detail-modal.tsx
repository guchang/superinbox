'use client'

import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Sparkles,
  Send,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Maximize2,
  ChevronDown,
  Clock,
  FileEdit,
  Code2,
} from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Item, ItemStatus } from '@/types'
import { FilePreview } from '@/components/file-preview'
import { Link } from '@/i18n/navigation'
import { MarkdownRichEditor } from '@/components/inbox/markdown-rich-editor'
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
  onReclassify?: (id: string) => void
  onRedistribute?: (id: string) => void
  reclassifying?: boolean
  redistributing?: boolean
  categoryOptions?: Array<{ key: string; name: string }>
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

// 自动保存延迟（毫秒）
const AUTOSAVE_DELAY = 2800

export function DetailModal({
  item,
  isOpen,
  onClose,
  onReclassify,
  onRedistribute,
  reclassifying,
  redistributing,
  categoryOptions,
  onSaveEdit,
}: DetailModalProps) {
  const detailT = useTranslations('inboxDetail')
  const inboxT = useTranslations('inbox')
  const time = useTranslations('time')

  const [draftContent, setDraftContent] = useState('')
  const [draftCategory, setDraftCategory] = useState('unknown')
  const [editorMode, setEditorMode] = useState<'rich' | 'markdown'>('rich')
  const [showMetadata, setShowMetadata] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isRoutingProcessing = item?.routingStatus === 'processing'

  const itemId = item?.id ?? null
  const itemContent = item?.content ?? ''
  const itemCategory = item?.analysis?.category ?? 'unknown'

  // 重置状态
  useEffect(() => {
    if (!itemId) return
    setDraftContent(itemContent)
    setDraftCategory(itemCategory)
    setEditorMode('rich')
    setHasUnsavedChanges(false)
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

  const isAnalyzing = item?.status === ItemStatus.PROCESSING

  // 自动保存函数
  const performSave = useCallback(async () => {
    if (!onSaveEdit || !hasUnsavedChanges) return

    setIsSaving(true)
    try {
      await onSaveEdit({
        content: draftContent,
        category: draftCategory,
      })
      setHasUnsavedChanges(false)
    } finally {
      setIsSaving(false)
    }
  }, [onSaveEdit, draftContent, draftCategory, hasUnsavedChanges])

  // 调度保存（内容变化时）
  useEffect(() => {
    if (!hasUnsavedChanges || !onSaveEdit) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      performSave()
    }, AUTOSAVE_DELAY)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [draftContent, draftCategory, hasUnsavedChanges, performSave, onSaveEdit])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      // 关闭前确保保存
      if (hasUnsavedChanges && onSaveEdit) {
        onSaveEdit({
          content: draftContent,
          category: draftCategory,
        })
      }
      onClose()
    }
  }, [onClose, hasUnsavedChanges, draftContent, draftCategory, onSaveEdit])

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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</span>
            </div>

            {/* 分类选择器 - 始终可见 */}
            <select
              value={draftCategory}
              onChange={(e) => {
                setDraftCategory(e.target.value)
                setHasUnsavedChanges(true)
              }}
              className="h-7 rounded-md border-0 bg-transparent px-2 text-xs font-medium focus-visible:ring-0"
              disabled={isAnalyzing}
            >
              {normalizedCategoryOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border border-border/70 bg-muted/40 p-0.5">
              <Button
                type="button"
                variant={editorMode === 'rich' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 gap-1.5 px-2 text-[11px]"
                onClick={() => setEditorMode('rich')}
              >
                <FileEdit className="h-3.5 w-3.5" />
                {detailT('edit.mode.rich')}
              </Button>
              <Button
                type="button"
                variant={editorMode === 'markdown' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 gap-1.5 px-2 text-[11px]"
                onClick={() => setEditorMode('markdown')}
              >
                <Code2 className="h-3.5 w-3.5" />
                {detailT('edit.mode.markdown')}
              </Button>
            </div>

            {/* 保存状态指示器 */}
            {isSaving && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{detailT('edit.saving')}</span>
              </div>
            )}

            {/* 未保存指示器 */}
            {hasUnsavedChanges && !isSaving && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{detailT('edit.unsaved')}</span>
              </div>
            )}

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
            {/* Main Content - 始终可编辑 */}
            <div className="space-y-4">
              <MarkdownRichEditor
                value={draftContent}
                mode={editorMode}
                onChange={(nextMarkdown) => {
                  setDraftContent(nextMarkdown)
                  setHasUnsavedChanges(true)
                }}
                onBlur={() => {
                  // 失焦时立即保存
                  if (hasUnsavedChanges && saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current)
                    void performSave()
                  }
                }}
                className="min-h-[400px]"
                placeholder={detailT('edit.richPlaceholder')}
              />

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
            </div>

            {/* Expandable Metadata */}
            <div className="pt-2">
              <button
                onClick={() => setShowMetadata((prev) => !prev)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{showMetadata ? detailT('metadata.hideMore') : detailT('metadata.showMore')}</span>
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
          </div>
        </div>

        {/* Footer Actions */}
        <Separator />

        <div className="flex items-center justify-end px-6 py-3">
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
            <DropdownMenuContent align="end">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
