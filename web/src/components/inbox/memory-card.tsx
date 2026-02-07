'use client'

import { useTranslations } from 'next-intl'
import { memo, useState, useRef, useEffect, useCallback, type MouseEvent } from 'react'
import { useTheme } from 'next-themes'
import { Item, ItemStatus, ContentType } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FilePreview } from '@/components/file-preview'
import { AudioWavePlayer } from '@/components/inbox/audio-wave-player'
import { RoutingStatus } from '@/components/inbox/routing-status'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { getApiBaseUrl } from '@/lib/api/base-url'
import {
  getCategoryBadgeStyle,
  getCategoryDisplayColor,
} from '@/lib/category-appearance'
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
  Pencil,
  Sparkles,
  Send,
  MoreVertical,
  Copy,
  Check,
  Play,
  Download,
  FileText,
} from 'lucide-react'

const FALLBACK_ACCENT_BY_CATEGORY: Record<string, string> = {
  todo: '#3b82f6',
  idea: '#eab308',
  expense: '#f97316',
  note: '#64748b',
  bookmark: '#6366f1',
  schedule: '#8b5cf6',
  audio: '#f43f5e',
  image: '#10b981',
  file: '#f59e0b',
}

interface MemoryCardProps {
  item: Item
  categoryLabelMap: Map<string, string>
  categoryMetaMap?: Map<string, { name: string; icon?: string; color?: string }>
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
  categoryMetaMap,
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
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [hasVideoRetried, setHasVideoRetried] = useState(false)
  const [isVideoActivated, setIsVideoActivated] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const [hasAudioRetried, setHasAudioRetried] = useState(false)
  const [copied, setCopied] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const categoryKey = item.analysis?.category ?? 'unknown'
  const categoryMeta = categoryMetaMap?.get(categoryKey)
  const themeMode = isDark ? 'dark' : 'light'
  const categoryColor = getCategoryDisplayColor(categoryKey, categoryMeta?.color, themeMode)
  const badgeStyle = getCategoryBadgeStyle(categoryKey, categoryMeta?.color, themeMode)
  const fallbackAccentColor =
    FALLBACK_ACCENT_BY_CATEGORY[categoryKey] || (resolvedTheme === 'dark' ? '#94a3b8' : '#64748b')
  const accentColor = categoryColor || fallbackAccentColor
  const isAnalyzing = item.status === ItemStatus.PROCESSING
  const isFailed = item.status === ItemStatus.FAILED
  const hasMultipleFiles = Boolean(item.allFiles && item.allFiles.length > 1)
  const lowerMimeType = item.mimeType?.toLowerCase() ?? ''
  const isImage = lowerMimeType.startsWith('image/') || item.contentType === ContentType.IMAGE
  const isAudio = lowerMimeType.startsWith('audio/') || item.contentType === ContentType.AUDIO
  const isVideo = lowerMimeType.startsWith('video/') || item.contentType === ContentType.VIDEO

  useEffect(() => {
    return () => {
      if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl)
      }
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl)
      }
    }
  }, [audioBlobUrl, videoObjectUrl])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(min-width: 640px)')
    const update = () => setIsDesktop(media.matches)
    update()
    if (media.addEventListener) {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }
    media.addListener(update)
    return () => media.removeListener(update)
  }, [])

  useEffect(() => {
    setIsVideoActivated(false)
  }, [item.id])


  const fetchVideoBlob = useCallback(async () => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('superinbox_auth_token')
      : null

    const fileUrl = `${getApiBaseUrl()}/inbox/${item.id}/file`
    const response = await fetch(fileUrl, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    })
    if (!response.ok) throw new Error('Failed to load video')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    setVideoObjectUrl(url)
    return url
  }, [item.id])

  const handleVideoError = useCallback(() => {
    if (hasVideoRetried) return
    setHasVideoRetried(true)
    setIsVideoLoading(true)

    fetchVideoBlob()
      .catch(() => undefined)
      .finally(() => {
        setIsVideoLoading(false)
      })
  }, [hasVideoRetried, fetchVideoBlob])

  useEffect(() => {
    if (!isMenuOpen) return
    if (!videoRef.current) return
    if (videoRef.current.paused) return
    videoRef.current.pause()
  }, [isMenuOpen])

  useEffect(() => {
    if (isDesktop || !isVideo) return
    if (videoObjectUrl || isVideoLoading) return
    setIsVideoLoading(true)
    fetchVideoBlob()
      .catch(() => undefined)
      .finally(() => {
        setIsVideoLoading(false)
      })
  }, [isDesktop, isVideo, videoObjectUrl, isVideoLoading, fetchVideoBlob])

  const handleAudioError = useCallback(() => {
    if (hasAudioRetried) return
    setHasAudioRetried(true)

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
        if (!res.ok) throw new Error('Failed to load audio')
        return res.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        setAudioBlobUrl(url)
      })
      .catch(() => undefined)
  }, [hasAudioRetried, item.id])

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


  const handleVideoClick = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isDesktop) {
      if (!video.paused) return
      video.play().catch(() => undefined)
      return
    }
    if (!isVideoActivated) {
      setIsVideoActivated(true)
      video.play().catch(() => undefined)
      return
    }
    if (video.paused) {
      video.play().catch(() => undefined)
      return
    }
    video.pause()
  }, [isDesktop, isVideoActivated])


  const audioSource = audioBlobUrl || `${getApiBaseUrl()}/inbox/${item.id}/file`
  const handleCardClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!onViewDetail) return
    if (isMenuOpen) return
    const selectedText = typeof window !== 'undefined'
      ? window.getSelection()?.toString().trim()
      : ''
    if (selectedText) return

    const target = event.target
    if (target instanceof Element) {
      const interactiveSelector = 'button, a, input, textarea, select, [role="button"], [role="menuitem"], video, audio, [data-card-ignore-click]'
      if (target.closest(interactiveSelector)) return
    }

    onViewDetail(item)
  }, [onViewDetail, isMenuOpen, item])

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
      label:
        categoryMeta?.name ||
        categoryLabelMap.get(item.analysis?.category ?? '') ||
        (item.analysis?.category?.toUpperCase() ?? 'UNKNOWN'),
      variant: 'outline' as const
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
      onClick={handleCardClick}
      className={cn(
        "group rounded-[24px] p-5 relative flex transition-all break-inside-avoid mb-4 overflow-hidden min-h-[180px]",
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
              className="absolute w-1 h-1 rounded-full blur-[1px]"
              style={{ backgroundColor: accentColor }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 flex w-full flex-1 flex-col">
        {/* 顶部：标签和操作区 */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Badge
              variant={badge.variant}
              className="h-6 border px-2.5 text-xs font-bold uppercase tracking-wide gap-1"
              style={!isAnalyzing && !isFailed ? badgeStyle : undefined}
            >
              {isAnalyzing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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

          {/* 右侧：时间 + 来源 + 更多按钮 */}
          <div className="flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            <span>{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</span>
            <span className="opacity-50">·</span>
            <span>{item.source?.toUpperCase()}</span>

            {/* 更多操作按钮 */}
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "ml-1 h-6 w-6 rounded flex items-center justify-center transition-all duration-200",
                    "hover:bg-black/5 dark:hover:bg-white/10",
                    "opacity-80 hover:opacity-100"
                  )}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="z-50 w-36 border border-black/10 bg-white text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-[#272729] dark:text-white/70"
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
                  <span>{t('actions.copy')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onViewDetail?.(item)}
                  className="cursor-pointer gap-2 text-[11px] font-semibold text-slate-700 focus:bg-black/5 dark:text-white/70 dark:focus:bg-white/10"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{t('actions.viewDetails')}</span>
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem
                    onClick={() => onEdit(item)}
                    className="cursor-pointer gap-2 text-[11px] font-semibold text-slate-700 focus:bg-black/5 dark:text-white/70 dark:focus:bg-white/10"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>{t('actions.edit')}</span>
                  </DropdownMenuItem>
                )}
                {onReclassify && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onReclassify(item.id)}
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
                  </>
                )}
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
        </div>

        {/* 内容 */}
        <div className="mb-4 flex-1">
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
              {hasMultipleFiles || isImage ? (
                <FilePreview
                  itemId={item.id}
                  fileName={item.fileName}
                  mimeType={item.mimeType || (isImage ? 'image/*' : item.mimeType)}
                  allFiles={item.allFiles}
                  imageLayout="card"
                />
              ) : isAudio ? (
                <AudioWavePlayer
                  src={audioSource}
                  waveformKey={`${item.id}-single-audio`}
                  onError={handleAudioError}
                  ignoreCardClick
                />
              ) : isVideo ? (
                <div
                  className={cn(
                    "w-full aspect-video rounded-2xl overflow-hidden relative border shadow-sm group",
                    isDark ? "bg-black/40 border-white/10" : "bg-black/5 border-black/5"
                  )}
                >
                  <video
                    ref={videoRef}
                    controls={isDesktop ? !isMenuOpen : (isVideoActivated && !isMenuOpen)}
                    preload="metadata"
                    playsInline
                    muted
                    src={videoObjectUrl || `${getApiBaseUrl()}/inbox/${item.id}/file`}
                    onError={handleVideoError}
                    onClick={handleVideoClick}
                    className={cn(
                      "h-full w-full object-contain",
                      isMenuOpen && "pointer-events-none"
                    )}
                  />
                  {!isDesktop && !isVideoActivated && (
                    <button
                      type="button"
                      onClick={handleVideoClick}
                      aria-label="播放视频"
                      className={cn(
                        "absolute inset-0 flex items-center justify-center",
                        isMenuOpen ? "pointer-events-none" : "pointer-events-auto"
                      )}
                    >
                      <span
                        className={cn(
                          "h-12 w-12 rounded-full flex items-center justify-center shadow-lg border",
                          isDark ? "bg-white/10 border-white/20 text-white" : "bg-white/85 border-black/10 text-black"
                        )}
                      >
                        <Play className="h-5 w-5" fill="currentColor" />
                      </span>
                    </button>
                  )}
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
        </div>

        {/* 底部：路由状态和操作 */}
        <div className={cn("flex items-center pt-4 border-t", isDark ? "border-white/[0.03]" : "border-black/[0.03]")}>
          <div className="flex-1 min-w-0">
            <RoutingStatus
              itemId={item.id}
              initialDistributedTargets={item.distributedTargets}
              initialRuleNames={item.distributedRuleNames}
              routingStatus={item.routingStatus}
              disabled={true}
              showAnimation={true}
              processingAccentColor={accentColor}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// 使用 React.memo 避免不必要的重渲染
export const MemoryCard = memo(MemoryCardComponent)
