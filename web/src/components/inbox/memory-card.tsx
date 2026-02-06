'use client'

import { useTranslations } from 'next-intl'
import { memo, useMemo, useState, useRef, useEffect, useCallback, type MouseEvent } from 'react'
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
  MoreVertical,
  Copy,
  Check,
  Play,
  Pause,
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
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [hasImageRetried, setHasImageRetried] = useState(false)
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [hasVideoRetried, setHasVideoRetried] = useState(false)
  const [isVideoActivated, setIsVideoActivated] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const [hasAudioRetried, setHasAudioRetried] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const waveformContainerRef = useRef<HTMLDivElement | null>(null)
  const [barCount, setBarCount] = useState(42)

  const config = useMemo(() => getIntentConfig(item.analysis?.category ?? 'unknown', isDark), [item.analysis?.category, isDark])
  const isAnalyzing = item.status === ItemStatus.PROCESSING
  const isFailed = item.status === ItemStatus.FAILED
  const hasMultipleFiles = Boolean(item.allFiles && item.allFiles.length > 1)
  const lowerMimeType = item.mimeType?.toLowerCase() ?? ''
  const isImage = lowerMimeType.startsWith('image/') || item.contentType === ContentType.IMAGE
  const isAudio = lowerMimeType.startsWith('audio/') || item.contentType === ContentType.AUDIO
  const isVideo = lowerMimeType.startsWith('video/') || item.contentType === ContentType.VIDEO
  const waveformHeights = useMemo(
    () => Array.from({ length: barCount }, () => Math.floor(Math.random() * 40) + 30),
    [barCount, item.id]
  )
  const [animatedHeights, setAnimatedHeights] = useState<number[]>(waveformHeights)
  const waveformTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (imageObjectUrl) {
        URL.revokeObjectURL(imageObjectUrl)
      }
      if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl)
      }
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl)
      }
      if (waveformTimerRef.current) {
        window.clearInterval(waveformTimerRef.current)
      }
    }
  }, [imageObjectUrl, audioBlobUrl, videoObjectUrl])

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

  useEffect(() => {
    const element = waveformContainerRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width = entry.contentRect.width
      const barWidth = 2
      const gap = 4
      const count = Math.floor((width + gap) / (barWidth + gap))
      const clamped = Math.min(64, Math.max(18, count))
      setBarCount(clamped)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setAnimatedHeights(waveformHeights)
  }, [waveformHeights])

  useEffect(() => {
    if (!isPlaying) {
      if (waveformTimerRef.current) {
        window.clearInterval(waveformTimerRef.current)
        waveformTimerRef.current = null
      }
      setAnimatedHeights(waveformHeights)
      return
    }

    waveformTimerRef.current = window.setInterval(() => {
      setAnimatedHeights(
        waveformHeights.map((height) => {
          const jitter = Math.round((Math.random() - 0.5) * 14)
          return Math.min(90, Math.max(24, height + jitter))
        })
      )
    }, 140)

    return () => {
      if (waveformTimerRef.current) {
        window.clearInterval(waveformTimerRef.current)
        waveformTimerRef.current = null
      }
    }
  }, [isPlaying, waveformHeights])

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

  const handleTogglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch (error) {
        console.error('Audio play failed:', error)
      }
    } else {
      audio.pause()
    }
  }, [])

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


  const handleSeek = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const { left, width } = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((event.clientX - left) / width, 0), 1)
    const nextTime = ratio * duration
    audioRef.current.currentTime = nextTime
    setCurrentTime(nextTime)
  }, [duration])

  const audioSource = audioBlobUrl || `${getApiBaseUrl()}/inbox/${item.id}/file`
  const progress = duration > 0 ? currentTime / duration : 0
  const activeBars = Math.round(progress * waveformHeights.length)
  const displayHeights = isPlaying ? animatedHeights : waveformHeights
  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '--:--'
    const minutes = Math.floor(value / 60)
    const seconds = Math.floor(value % 60)
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  const currentTimeLabel = formatTime(currentTime)
  const durationLabel = formatTime(duration)

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

      <div className="relative z-10 flex flex-col">
        {/* 顶部：标签和操作区 */}
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
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    aria-label={isPlaying ? '暂停播放' : '播放音频'}
                    className={cn(
                      "w-8 h-8 min-w-8 min-h-8 p-0 aspect-square shrink-0 rounded-full flex items-center justify-center transition",
                      isDark ? "bg-white/10 text-white" : "bg-black/10 text-black"
                    )}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
                  </button>
                  <div
                    ref={waveformContainerRef}
                    className="flex-1 flex items-end gap-1 h-6 cursor-pointer overflow-hidden"
                    onClick={handleSeek}
                    role="presentation"
                  >
                    {displayHeights.map((height, index) => (
                      <div
                        key={`${item.id}-wave-${index}`}
                        className={cn(
                          "w-[2px] rounded-full transition-colors",
                          index < activeBars
                            ? (isDark ? "bg-white/70" : "bg-black/70")
                            : (isDark ? "bg-white/20" : "bg-black/20")
                        )}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <div
                    className={cn(
                      "shrink-0 text-[10px] font-bold tabular-nums whitespace-nowrap tracking-wider",
                      isDark ? "text-white/40" : "text-black/40"
                    )}
                  >
                    <span className="sm:hidden">{durationLabel}</span>
                    <span className="hidden sm:inline">{currentTimeLabel} / {durationLabel}</span>
                  </div>
                  <audio
                    ref={audioRef}
                    preload="metadata"
                    src={audioSource}
                    onLoadedMetadata={(event) => {
                      setDuration(event.currentTarget.duration || 0)
                      setCurrentTime(event.currentTarget.currentTime || 0)
                    }}
                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onError={handleAudioError}
                    className="hidden"
                  />
                </div>
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
              showAnimation={false}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// 使用 React.memo 避免不必要的重渲染
export const MemoryCard = memo(MemoryCardComponent)
