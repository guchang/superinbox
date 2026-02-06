'use client'

import { useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Send, Pencil, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ContentType, Item, ItemStatus } from '@/types'
import { formatRelativeTime } from '@/lib/utils'
import { FilePreview } from '@/components/file-preview'

interface DetailModalProps {
  item: Item | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (item: Item) => void
  onReclassify?: (id: string) => void
  onRedistribute?: (id: string) => void
  reclassifying?: boolean
  redistributing?: boolean
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

const isLikelyUrl = (value: string) => /^https?:\/\/\S+/i.test(value)

const isUrlEntity = (type: string, value: string) => {
  return /url|link/i.test(type) || isLikelyUrl(value)
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
}: DetailModalProps) {
  const detailT = useTranslations('inboxDetail')
  const time = useTranslations('time')

  // ESC 关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (!item) return null

  const categoryKey = item.analysis?.category ?? 'unknown'
  const categoryLabel = {
    todo: detailT('categories.todo'),
    idea: detailT('categories.idea'),
    expense: detailT('categories.expense'),
    note: detailT('categories.note'),
    bookmark: detailT('categories.bookmark'),
    schedule: detailT('categories.schedule'),
    unknown: detailT('categories.unknown'),
  }[categoryKey] || categoryKey
  const isAnalyzing = item.status === ItemStatus.PROCESSING
  const isFailed = item.status === ItemStatus.FAILED
  const contentText = item.content?.trim() ?? ''
  const hasContentText = contentText.length > 0
  const entityBadges = (item.analysis?.entities || [])
    .filter((entity) => entity?.type && entity?.value)
    .map((entity) => ({
      type: entity.type.trim(),
      value: entity.value.trim(),
    }))
    .filter((entity) => {
      if (!entity.type || !entity.value) return false
      if (entity.type.toLowerCase() === 'customfields') return false
      if (entity.value === '{}' || entity.value === '[]') return false
      return true
    })
    .map((entity) => ({
      ...entity,
      isUrl: isUrlEntity(entity.type, entity.value),
    }))

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        >
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* 模态框 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-[32px]",
              isDark ? 'bg-[#12121a] text-white border border-white/10' : 'bg-white text-black border border-black/5',
              "shadow-2xl"
            )}
            onClick={e => e.stopPropagation()}
          >
            {/* 顶部操作栏 */}
            <div className="flex h-16 items-center justify-end border-b border-black/[0.03] px-3 dark:border-white/[0.06] sm:px-4">
              <button
                onClick={onClose}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center sm:h-10 sm:w-10",
                  "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10",
                  "transition-colors"
                )}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="overflow-y-auto max-h-[calc(85vh-4rem)]">
              <div className="px-5 py-5 sm:px-6 sm:py-6 space-y-4 sm:space-y-5">
                {(isFailed || hasContentText) && (
                  <div className="space-y-3">
                    {isFailed && (
                      <Badge variant="destructive" className="h-6 text-[10px]">
                        {detailT('status.failed')}
                      </Badge>
                    )}

                    {hasContentText && (
                      <h2 className={cn(
                        item.contentType === ContentType.URL
                          ? 'text-lg font-semibold leading-relaxed break-all'
                          : 'text-2xl font-bold leading-relaxed break-words',
                        isAnalyzing ? 'text-muted-foreground italic' : 'text-foreground'
                      )}>
                        {contentText}
                      </h2>
                    )}
                  </div>
                )}

                {item.hasFile && (
                  <section className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.03] p-5 sm:p-6">
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">
                      {detailT('sections.attachments')}
                    </div>
                    <FilePreview
                      itemId={item.id}
                      fileName={item.fileName}
                      mimeType={item.mimeType}
                      allFiles={item.allFiles}
                    />
                  </section>
                )}

                <section className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.03] p-5 sm:p-6">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">
                    {detailT('sections.aiAnalysis')}
                  </div>

                  <div className="mb-5 grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-30">
                        {detailT('metadata.source')}
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-wide opacity-75 truncate">
                        {item.source?.toUpperCase() || '-'}
                      </div>
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-30">
                        {detailT('metadata.createdAt')}
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs font-semibold opacity-75 whitespace-nowrap sm:justify-end">
                        <Clock className="h-3 w-3" />
                        <span>{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</span>
                      </div>
                    </div>
                  </div>

                  {isAnalyzing ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">{detailT('analysis.analyzing')}</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20">{detailT('analysis.category')}:</span>
                        <span className="text-sm font-medium">{categoryLabel}</span>
                      </div>

                      {entityBadges.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground w-20 shrink-0">{detailT('analysis.entities')}:</span>
                          <div className="flex flex-wrap gap-1.5 max-w-full">
                            {entityBadges.map((entity, index) => (
                              entity.isUrl ? (
                                <a
                                  key={`${entity.type}-${entity.value}-${index}`}
                                  href={entity.value}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex max-w-full items-start rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:underline dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300"
                                >
                                  <span className="mr-1 shrink-0 opacity-70">{entity.type}:</span>
                                  <span className="break-all">{entity.value}</span>
                                </a>
                              ) : (
                                <Badge
                                  key={`${entity.type}-${entity.value}-${index}`}
                                  variant="secondary"
                                  className="max-w-full text-[10px] whitespace-normal break-all"
                                >
                                  {entity.type}: {entity.value}
                                </Badge>
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      {item.analysis?.summary && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground w-20 shrink-0">{detailT('analysis.summary')}:</span>
                          <span className="text-sm">{item.analysis.summary}</span>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {item.distributedTargets && item.distributedTargets.length > 0 && (
                  <section className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.03] p-5 sm:p-6">
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">
                      {detailT('sections.distributionTargets')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.distributedTargets.map((target, index) => (
                        <Badge key={index} variant="outline" className="h-6 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                          {getDistributionTargetLabel(target, index)}
                        </Badge>
                      ))}
                    </div>
                    {item.distributedRuleNames && item.distributedRuleNames.length > 0 && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        <span className="font-medium">{detailT('sections.rules')}: </span>
                        {item.distributedRuleNames.join(', ')}
                      </div>
                    )}
                  </section>
                )}
              </div>

              <div className="border-t border-black/[0.03] px-5 py-4 dark:border-white/[0.06] sm:px-6">
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => onEdit?.(item)}
                    disabled={isAnalyzing}
                    variant="outline"
                    className="h-10 px-4 rounded-xl"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {detailT('actions.editContent')}
                  </Button>

                  <Button
                    onClick={() => onReclassify?.(item.id)}
                    disabled={isAnalyzing || reclassifying}
                    variant="outline"
                    className="h-10 px-4 rounded-xl"
                  >
                    {reclassifying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {detailT('actions.reclassify')}
                  </Button>

                  <Button
                    onClick={() => onRedistribute?.(item.id)}
                    disabled={isAnalyzing || redistributing}
                    variant="outline"
                    className="h-10 px-4 rounded-xl"
                  >
                    {redistributing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {detailT('actions.redistribute')}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
