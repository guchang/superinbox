'use client'

import { useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Send, Pencil, Clock, FileText, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Item, ItemStatus } from '@/types'
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

// 获取意图配置
const getIntentConfig = (category: string) => {
  const map: Record<string, { color: string; bgColor: string; label: string }> = {
    todo: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Todo' },
    idea: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Idea' },
    expense: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Expense' },
    note: { color: 'text-slate-500', bgColor: 'bg-slate-500/10', label: 'Note' },
    bookmark: { color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', label: 'Bookmark' },
    schedule: { color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Schedule' },
  }
  return map[category] || { color: 'text-slate-500', bgColor: 'bg-slate-500/10', label: category }
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
  const t = useTranslations('inbox')
  const common = useTranslations('common')
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

  if (!item) return null

  const config = getIntentConfig(item.analysis?.category ?? 'unknown')
  const isAnalyzing = item.status === ItemStatus.PROCESSING
  const isFailed = item.status === ItemStatus.FAILED

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

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
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className={cn(
                "absolute top-4 right-4 z-10",
                "w-10 h-10 rounded-full flex items-center justify-center",
                "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10",
                "transition-colors"
              )}
            >
              <X className="h-5 w-5" />
            </button>

            {/* 内容区域 */}
            <div className="overflow-y-auto max-h-[85vh]">
              {/* 头部信息 */}
              <div className="p-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <Badge
                    className={cn(
                      "h-6 text-[10px] font-black uppercase tracking-widest",
                      config.color,
                      config.bgColor
                    )}
                  >
                    {isAnalyzing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {config.label}
                  </Badge>

                  {isFailed && (
                    <Badge variant="destructive" className="h-6 text-[10px]">
                      {t('badge.failed')}
                    </Badge>
                  )}

                  <div className="flex items-center gap-1 text-[10px] font-bold opacity-40 uppercase tracking-wider ml-auto">
                    <Clock className="h-3 w-3" />
                    <span>{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</span>
                  </div>
                </div>

                {/* 来源 */}
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-2">
                  {item.source?.toUpperCase()}
                </div>

                {/* 主内容 */}
                <h2 className={cn(
                  "text-2xl font-bold leading-relaxed",
                  isAnalyzing ? 'text-muted-foreground italic' : 'text-foreground'
                )}>
                  {item.content}
                </h2>
              </div>

              {/* 文件预览 */}
              {item.hasFile && (
                <div className="px-6 pb-4">
                  <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.03]">
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">
                      {t('sections.attachments')}
                    </div>
                    <FilePreview
                      itemId={item.id}
                      fileName={item.fileName}
                      mimeType={item.mimeType}
                      allFiles={item.allFiles}
                    />
                  </div>
                </div>
              )}

              {/* AI 分析结果 */}
              <div className="px-6 pb-4">
                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.03]">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">
                    {t('sections.aiAnalysis')}
                  </div>

                  {isAnalyzing ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">{t('analysis.analyzing')}</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* 分类 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20">{t('analysis.category')}:</span>
                        <span className="text-sm font-medium">{config.label}</span>
                      </div>

                      {/* 实体 */}
                      {item.analysis?.entities && Object.keys(item.analysis.entities).length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground w-20 shrink-0">{t('analysis.entities')}:</span>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(item.analysis.entities).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="text-[10px]">
                                {key}: {String(value)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 摘要 */}
                      {item.analysis?.summary && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground w-20 shrink-0">{t('analysis.summary')}:</span>
                          <span className="text-sm">{item.analysis.summary}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 路由目的地 */}
              {item.distributedTargets && item.distributedTargets.length > 0 && (
                <div className="px-6 pb-4">
                  <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.03]">
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">
                      {t('sections.distributionTargets')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.distributedTargets.map((target, index) => (
                        <Badge key={index} variant="outline" className="h-6 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                          {target}
                        </Badge>
                      ))}
                    </div>
                    {item.distributedRuleNames && item.distributedRuleNames.length > 0 && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        <span className="font-medium">{t('sections.rules')}: </span>
                        {item.distributedRuleNames.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="p-6 pt-2">
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => onEdit?.(item)}
                    disabled={isAnalyzing}
                    variant="outline"
                    className="h-10 px-4 rounded-xl"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('actions.editContent')}
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
                    {t('actions.reclassify')}
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
                    {t('actions.redistribute')}
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
