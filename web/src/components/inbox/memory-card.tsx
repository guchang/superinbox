'use client'

import { useTranslations } from 'next-intl'
import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Item, ItemStatus, ContentType } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FilePreview } from '@/components/file-preview'
import { RoutingStatus } from '@/components/inbox/routing-status'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { getApiBaseUrl } from '@/lib/api/base-url'
import { inboxApi } from '@/lib/api/inbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { motion } from 'framer-motion'
import {
  Eye,
  Trash2,
  Loader2,
  Clock,
  RefreshCw,
  CheckCircle2,
  Pencil,
  Sparkles,
  Send,
  MoreHorizontal,
  Copy,
  Check,
  Play,
  Download,
  FileText,
} from 'lucide-react'

// 获取意图配置（颜色等）
const getIntentConfig = (category: string, isDark = false) => {
  const map: Record<string, { color: string; bgColor: string; accent: string; icon: typeof CheckCircle2 }> = {
    todo: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', accent: 'bg-blue-400', icon: CheckCircle2 },
    idea: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', accent: 'bg-yellow-400', icon: CheckCircle2 },
    expense: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', accent: 'bg-orange-400', icon: CheckCircle2 },
    note: { color: 'text-slate-500', bgColor: 'bg-slate-500/10', accent: isDark ? 'bg-white/40' : 'bg-black/40', icon: CheckCircle2 },
    bookmark: { color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', accent: 'bg-indigo-500', icon: CheckCircle2 },
    schedule: { color: 'text-purple-500', bgColor: 'bg-purple-500/10', accent: 'bg-purple-400', icon: CheckCircle2 },
    audio: { color: 'text-rose-500', bgColor: 'bg-rose-500/10', accent: 'bg-rose-500', icon: CheckCircle2 },
    image: { color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', accent: 'bg-emerald-400', icon: CheckCircle2 },
    file: { color: 'text-amber-500', bgColor: 'bg-amber-500/10', accent: 'bg-amber-500', icon: CheckCircle2 },
  }
  return map[category] || { color: 'text-slate-500', bgColor: 'bg-slate-500/10', accent: isDark ? 'bg-white/40' : 'bg-black/40', icon: CheckCircle2 }
}

interface MemoryCardProps {
  item: Item
  categoryLabelMap: Map<string, string>
  onDelete: (id: string) => void
  onRetry: (id: string) => void
  onEdit?: (item: Item) => void
  onReclassify?: (id: string) => void
  onRedistribute?: (id: string) => void
  onViewDetail?: (item: Item) => void
  deletingId: string | null
  retryingId: string | null
  animationVariant?: 'elastic' | 'fade'
}

function MemoryCardComponent({
  item,
  categoryLabelMap,
  onDelete,
  onRetry,
  onEdit,
  onReclassify,
  onRedistribute,
  onViewDetail,
  deletingId,
  retryingId,
  animationVariant = 'fade',
}: MemoryCardProps) {
  const t = useTranslations('inbox')
  const common = useTranslations('common')
  const time = useTranslations('time')
  const filePreview = useTranslations('filePreview')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Hover 菜单状态
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [hasImageRetried, setHasImageRetried] = useState(false)
  const [copied, setCopied] = useState(false)

  const config = useMemo(() => getIntentConfig(item.analysis?.category ?? 'unknown', isDark), [item.analysis?.category, isDark])
  const isAnalyzing = item.status === ItemStatus.PROCESSING
  const isFailed = item.status === ItemStatus.FAILED
  const hasMultipleFiles = Boolean(item.allFiles && item.allFiles.length > 1)
  const lowerMimeType = item.mimeType?.toLowerCase() ?? ''
  const isImage = lowerMimeType.startsWith('image/') || item.contentType === ContentType.IMAGE
  const isAudio = lowerMimeType.startsWith('audio/') || item.contentType === ContentType.AUDIO
  const waveformHeights = useMemo(
    () => Array.from({ length: 15 }, () => Math.floor(Math.random() * 70) + 20),
    [item.id]
  )

  // 长按处理（移动端）
  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setIsMenuOpen(true)
    }, 600)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (imageObjectUrl) {
        URL.revokeObjectURL(imageObjectUrl)
      }
    }
  }, [imageObjectUrl])

  const handleImageError = useCallback(() => {
    if (hasImageRetried) return
    setHasImageRetried(true)
    setIsImageLoading(true)

    const token = typeof window !== 'undefined'
      ? localStorage.getItem('superinbox_auth_token')
      : null

    const fileUrl = `${getApiBaseUrl()}/inbox/${item.id}/file`

    fetch(fileUrl, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load image')
        return res.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        setImageObjectUrl(url)
      })
      .catch(() => {
        setIsImageLoading(false)
      })
      .finally(() => {
        setIsImageLoading(false)
      })
  }, [hasImageRetried, item.id])

  const formatFileSize = (fileSize?: number) => {
    if (typeof fileSize !== 'number') return ''
    const kb = fileSize / 1024
    if (kb >= 1024) {
      return `${(kb / 1024).toFixed(1)}MB`
    }
    return `${kb.toFixed(1)}KB`
  }

  const handleDownload = useCallback(() => {
    inboxApi.downloadFile(item.id, item.fileName).catch(() => undefined)
  }, [item.id, item.fileName])

  const handleCopyContent = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.content)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = item.content
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch (error) {
      setCopied(false)
    }
  }, [item.content])

  const getBadgeContent = () => {
    if (isAnalyzing) return { label: t('badge.analyzing'), variant: 'outline' as const }
    if (isFailed) return { label: t('badge.failed'), variant: 'destructive' as const }
    return {
      label: categoryLabelMap.get(item.analysis?.category ?? '') || (item.analysis?.category?.toUpperCase() ?? 'UNKNOWN'),
      variant: 'default' as const
    }
  }

  const badge = getBadgeContent()

  const animationConfig =
    animationVariant === 'elastic'
      ? {
          initial: { opacity: 0, y: 20, scale: 0.96 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { type: 'spring' as const, stiffness: 420, damping: 30 },
        }
      : {
          initial: false,
          animate: { opacity: 1 },
          transition: { duration: 0 },
        }

  return (
    <motion.div
      layout
      initial={animationConfig.initial}
      animate={animationConfig.animate}
      transition={animationConfig.transition}
      exit={{ opacity: 0, scale: 0.95 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "group rounded-[24px] p-5 relative transition-all break-inside-avoid mb-4 overflow-hidden min-h-[180px]",
        // 浅色模式: 纯白 + 极淡边框 + 阴影
        "bg-white border border-black/[0.04] shadow-sm hover:shadow-xl",
        // 深色模式: 更接近 inbox-new 的边框/对比
        "dark:bg-white/[0.02] dark:border-white/[0.06] dark:hover:border-white/20",
        isAnalyzing && "animate-pulse bg-accent/30"
      )}
    >
      {/* 背景装饰 - 12个浮动粒子效果 */}
      {isAnalyzing && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                x: [Math.random() * 400, Math.random() * 400],
                y: [Math.random() * 200, Math.random() * 200],
                opacity: [0, 0.3, 0]
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              className={cn("absolute w-1 h-1 rounded-full blur-[1px]", config.accent)}
            />
          ))}
        </div>
      )}

      <div
        className={cn(
          "absolute top-4 right-4 z-20 flex items-center gap-1 rounded-full border px-1.5 py-1 backdrop-blur-md transition-opacity",
          "bg-white border-black/10 text-slate-600 dark:bg-[#272729] dark:border-white/10 dark:text-white/70",
          isMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        )}
      >
        {!isMenuOpen && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                handleCopyContent()
              }}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors",
                isDark ? "hover:bg-white/10" : "hover:bg-black/5"
              )}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>复制文字</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onViewDetail?.(item)
              }}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors",
                isDark ? "hover:bg-white/10" : "hover:bg-black/5"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{t('actions.viewDetails')}</span>
            </button>
          </>
        )}
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="更多操作"
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center transition-colors",
                isDark ? "hover:bg-white/10" : "hover:bg-black/5"
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40 border border-black/10 bg-white text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-[#272729] dark:text-white/70"
          >
            <DropdownMenuItem
              onClick={() => handleCopyContent()}
              className="cursor-pointer gap-2 text-[11px] font-semibold text-slate-700 focus:bg-black/5 dark:text-white/70 dark:focus:bg-white/10"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>复制文字</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onViewDetail?.(item)}
              className="cursor-pointer gap-2 text-[11px] font-semibold text-slate-700 focus:bg-black/5 dark:text-white/70 dark:focus:bg-white/10"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{t('actions.viewDetails')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onEdit?.(item)}
              className="cursor-pointer gap-2 text-[11px] font-semibold text-slate-700 focus:bg-black/5 dark:text-white/70 dark:focus:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>{t('actions.edit')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onReclassify?.(item.id)}
              className="cursor-pointer gap-2 text-[11px] font-semibold text-slate-700 focus:bg-black/5 dark:text-white/70 dark:focus:bg-white/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t('actions.reclassify')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onRedistribute?.(item.id)}
              className="cursor-pointer gap-2 text-[11px] font-semibold text-slate-700 focus:bg-black/5 dark:text-white/70 dark:focus:bg-white/10"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{t('actions.redistribute')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(item.id)}
              className="cursor-pointer gap-2 text-[11px] font-semibold text-rose-500 focus:bg-black/5 focus:text-rose-500 dark:focus:bg-white/10"
              disabled={deletingId === item.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{common('delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative z-10 flex flex-col">
        {/* 顶部：标签和时间 */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Badge
              variant={badge.variant}
              className={cn(
                "h-5 text-[10px] font-black uppercase tracking-widest gap-1",
                !isAnalyzing && !isFailed && config.color,
                !isAnalyzing && !isFailed && config.bgColor
              )}
            >
              {isAnalyzing && <Loader2 className="h-3 w-3 animate-spin" />}
              {badge.label}
            </Badge>

            {isFailed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onRetry(item.id)
                }}
                disabled={retryingId === item.id}
                className="h-5 px-2 text-xs"
              >
                {retryingId === item.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] font-bold opacity-30 uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            <span>{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)} · {item.source?.toUpperCase()}</span>
          </div>
        </div>

        {/* 内容 */}
        <div className="mb-4">
          <h3 className={cn(
            "text-lg font-bold leading-tight transition-colors",
            isAnalyzing ? 'text-muted-foreground italic' : (isDark ? 'text-white/95' : 'text-black/95'),
            item.contentType === ContentType.URL ? 'break-all' : 'break-words',
            "line-clamp-3"
          )}>
            {item.content}
          </h3>

          {/* 文件预览 */}
          {item.hasFile && (
            <div className="mt-4">
              {hasMultipleFiles ? (
                <FilePreview
                  itemId={item.id}
                  fileName={item.fileName}
                  mimeType={item.mimeType}
                  allFiles={item.allFiles}
                />
              ) : isImage ? (
                <div
                  className={cn(
                    "w-full aspect-video rounded-2xl overflow-hidden relative border shadow-sm",
                    isDark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/5"
                  )}
                >
                  <img
                    src={imageObjectUrl || `${getApiBaseUrl()}/inbox/${item.id}/file`}
                    alt={item.fileName || filePreview('imageAltFallback')}
                    onError={handleImageError}
                    className="h-full w-full object-cover"
                  />
                  {isImageLoading && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <span className="text-xs font-semibold text-white/80">{filePreview('loading')}</span>
                    </div>
                  )}
                </div>
              ) : isAudio ? (
                <div
                  className={cn(
                    "w-full p-3 rounded-xl flex items-center gap-3 border",
                    isDark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/5"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    isDark ? "bg-white/10 text-white/60" : "bg-black/10 text-black/60"
                  )}>
                    <Play className="h-4 w-4" fill="currentColor" />
                  </div>
                  <div className="flex-1 flex items-end gap-0.5 h-6">
                    {waveformHeights.map((height, index) => (
                      <div
                        key={`${item.id}-wave-${index}`}
                        className={cn(
                          "flex-1 rounded-full",
                          isDark ? "bg-white/20" : "bg-black/20"
                        )}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "w-full p-3 rounded-xl flex items-center justify-between border",
                    isDark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/5"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-500/10 text-amber-600"
                      )}
                    >
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate opacity-80">
                        {item.fileName || filePreview('fileFallback')}
                      </div>
                      <div className="text-[9px] font-bold opacity-30 uppercase">
                        {[formatFileSize(item.fileSize), item.mimeType?.split('/')[1]?.toUpperCase() || 'FILE']
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDownload()
                    }}
                    aria-label={filePreview('download')}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      isDark ? "text-white/40 hover:bg-white/10" : "text-black/40 hover:bg-black/5"
                    )}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 匹配的路由规则 */}
          {item.distributedRuleNames && item.distributedRuleNames.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium">Rules: </span>
              <span>{item.distributedRuleNames.join(', ')}</span>
            </div>
          )}
        </div>

        {/* 底部：路由状态和操作 */}
        <div className={cn("flex items-center pt-4 border-t", isDark ? "border-white/[0.03]" : "border-black/[0.03]")}>
          <div className="flex-1 min-w-0">
            <RoutingStatus
              itemId={item.id}
              initialDistributedTargets={item.distributedTargets}
              initialRuleNames={item.distributedRuleNames}
              routingStatus={item.routingStatus}
              disabled={false}
              showAnimation={true}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// 使用 React.memo 避免不必要的重渲染
export const MemoryCard = memo(MemoryCardComponent)
