'use client'

import { useTranslations } from 'next-intl'
import { memo, useState, useRef, useEffect, useCallback, type MouseEvent } from 'react'
import { useTheme } from 'next-themes'
import { Item, ItemStatus, ContentType } from '@/types'
import { Button } from '@/components/ui/button'
import { FilePreview } from '@/components/file-preview'
import { AudioWavePlayer } from '@/components/inbox/audio-wave-player'
import { LinkifiedText } from '@/components/shared/linkified-text'
import { MCPConnectorLogo } from '@/components/mcp-connectors/mcp-connector-logo'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { getApiBaseUrl } from '@/lib/api/base-url'
import {
  getCategoryDisplayColor,
  getCategoryIconComponent,
} from '@/lib/category-appearance'
import { inboxApi } from '@/lib/api/inbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { motion } from 'framer-motion'
import {
  Trash2,
  Loader2,
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

function extractDestinationFromRuleName(ruleName: string): string {
  const segments = ruleName
    .split(/(?:->|→|⇒|➡|⟶|⮕)/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length < 2) return ''
  return segments[segments.length - 1] || ''
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isLikelyOpaqueTargetId(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (UUID_PATTERN.test(trimmed)) return true

  const compactIdPattern = /^[A-Za-z0-9_-]{24,}$/
  return compactIdPattern.test(trimmed) && !trimmed.includes('.')
}

type ConnectorMeta = {
  name: string
  serverType?: string
  logoColor?: string
}

type DestinationEntry = {
  label: string
  serverType?: string
  logoColor?: string
}

function resolveDestinationEntry(
  targetId: string,
  connectorMetaMap?: Map<string, ConnectorMeta>
): DestinationEntry | null {
  const rawTargetId = targetId.trim()
  if (!rawTargetId) return null

  const mappedMeta = connectorMetaMap?.get(rawTargetId)
  const mappedName = mappedMeta?.name?.trim()
  if (mappedName) {
    return {
      label: mappedName,
      serverType: mappedMeta?.serverType,
      logoColor: mappedMeta?.logoColor,
    }
  }

  if (isLikelyOpaqueTargetId(rawTargetId)) {
    return null
  }

  return { label: rawTargetId }
}

function resolveDestinationFromTarget(
  target: unknown,
  connectorMetaMap?: Map<string, ConnectorMeta>
): DestinationEntry | null {
  if (typeof target === 'string') {
    return resolveDestinationEntry(target, connectorMetaMap)
  }

  if (!target || typeof target !== 'object') {
    return null
  }

  const record = target as Record<string, unknown>
  const targetServerType = String(
    record.serverType ?? record.targetServerType ?? record.type ?? ''
  ).trim()
  const targetLogoColor = String(
    record.logoColor ?? record.targetLogoColor ?? ''
  ).trim()

  const idCandidates = [
    record.id,
    record.targetId,
    record.adapterId,
    record.target,
    record.destination,
  ]

  for (const candidate of idCandidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue
    const mapped = resolveDestinationEntry(candidate, connectorMetaMap)
    if (mapped) {
      return {
        ...mapped,
        serverType: mapped.serverType || targetServerType || undefined,
        logoColor: mapped.logoColor || targetLogoColor || undefined,
      }
    }
  }

  const nameCandidates = [
    record.name,
    record.targetName,
    record.destinationName,
    record.connectorName,
    record.adapterName,
  ]

  for (const candidate of nameCandidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue
    return {
      label: candidate.trim(),
      serverType: targetServerType || undefined,
      logoColor: targetLogoColor || undefined,
    }
  }

  return null
}

function RoutingPulseBlocks({ accentColor }: { accentColor: string }) {
  return (
    <div className="ml-1 flex items-center gap-0.5">
      {Array.from({ length: 8 }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0.1, scale: 0.8 }}
          animate={{
            opacity: [0.1, 0.6, 0.1],
            scale: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: index * 0.1,
            ease: 'easeInOut',
          }}
          className="h-1 w-1 rounded-[1px] md:h-1.5 md:w-1.5 md:rounded-[2px]"
          style={{ backgroundColor: accentColor }}
        />
      ))}
    </div>
  )
}

interface MemoryCardProps {
  item: Item
  categoryLabelMap: Map<string, string>
  categoryMetaMap?: Map<string, { name: string; icon?: string; color?: string }>
  connectorMetaMap?: Map<string, ConnectorMeta>
  onDelete: (id: string) => void
  onRetry: (id: string) => void
  onEdit?: (item: Item) => void
  onReclassify?: (id: string) => void
  onRedistribute?: (id: string) => void
  onViewDetail?: (item: Item) => void
  onHeightChange?: (id: string, height: number) => void
  deletingId: string | null
  retryingId: string | null
  animationVariant?: 'elastic' | 'fade'
}

function MemoryCardComponent({
  item,
  categoryLabelMap,
  categoryMetaMap,
  connectorMetaMap,
  onDelete,
  onRetry,
  onEdit,
  onReclassify,
  onRedistribute,
  onViewDetail,
  onHeightChange,
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
  const cardRef = useRef<HTMLDivElement | null>(null)

  const categoryKey = item.analysis?.category ?? 'unknown'
  const categoryMeta = categoryMetaMap?.get(categoryKey)
  const themeMode = isDark ? 'dark' : 'light'
  const categoryColor = getCategoryDisplayColor(categoryKey, categoryMeta?.color, themeMode)
  const fallbackAccentColor =
    FALLBACK_ACCENT_BY_CATEGORY[categoryKey] || (resolvedTheme === 'dark' ? '#94a3b8' : '#64748b')
  const accentColor = categoryColor || fallbackAccentColor
  const isAnalyzing = item.status === ItemStatus.PROCESSING
  const isFailed = item.status === ItemStatus.FAILED
  const categoryDisplayLabel =
    categoryMeta?.name ||
    categoryLabelMap.get(item.analysis?.category ?? '') ||
    (item.analysis?.category?.toUpperCase() ?? 'UNKNOWN')
  const CategoryIcon = getCategoryIconComponent(categoryMeta?.icon, categoryKey)
  const hasMultipleFiles = Boolean(item.allFiles && item.allFiles.length > 1)
  const lowerMimeType = item.mimeType?.toLowerCase() ?? ''
  const isImage = lowerMimeType.startsWith('image/') || item.contentType === ContentType.IMAGE
  const isAudio = lowerMimeType.startsWith('audio/') || item.contentType === ContentType.AUDIO
  const isVideo = lowerMimeType.startsWith('video/') || item.contentType === ContentType.VIDEO

  const rawRoutingStatus = item.routingStatus
  const routingStatusValue = rawRoutingStatus === 'failed' ? 'error' : rawRoutingStatus

  const normalizedRuleNames = (item.distributedRuleNames ?? [])
    .map((name) => String(name ?? '').trim())
    .filter(Boolean)

  const rawTargets = routingStatusValue === 'processing' && (item.routingPreviewTargets?.length ?? 0) > 0
    ? item.routingPreviewTargets ?? []
    : item.distributedTargets ?? []

  const destinationEntriesFromTargets = rawTargets
    .map((target) => resolveDestinationFromTarget(target, connectorMetaMap))
    .filter((entry): entry is DestinationEntry => Boolean(entry))
  const destinationEntriesFromRuleNames = normalizedRuleNames
    .map(extractDestinationFromRuleName)
    .filter(Boolean)
    .map((label) => ({ label }))

  const destinationCandidates = destinationEntriesFromTargets.length > 0
    ? destinationEntriesFromTargets
    : destinationEntriesFromRuleNames

  const destinationEntries: DestinationEntry[] = Array.from(
    destinationCandidates.reduce((map, entry) => {
      if (!map.has(entry.label)) {
        map.set(entry.label, entry)
      }
      return map
    }, new Map<string, DestinationEntry>()).values()
  )

  const destinationNames = destinationEntries.map((entry) => entry.label)
  const destinationSummary = destinationNames.length > 1
    ? `${destinationNames[0]} +${destinationNames.length - 1}`
    : (destinationNames[0] ?? '')

  const primaryDestination = destinationEntries[0]

  const isRoutingProcessing = routingStatusValue === 'processing'
  const showDestination = Boolean(destinationSummary) && (
    routingStatusValue === 'completed' ||
    routingStatusValue === 'error' ||
    routingStatusValue === 'processing'
  )
  const showProcessingDestination = isRoutingProcessing && Boolean(destinationSummary)
  const routingStateText =
    routingStatusValue === 'processing'
      ? t('routingStatus.processing')
      : routingStatusValue === 'pending'
        ? t('routingStatus.pending')
        : routingStatusValue === 'error'
          ? t('routingStatus.failed')
          : null
  const showRoutingStateText = Boolean(routingStateText) && !showProcessingDestination
  const routingStateToneClass =
    routingStatusValue === 'error'
      ? 'text-rose-600/85 dark:text-rose-300/85'
      : 'text-muted-foreground'
  const routingStateStyle =
    routingStatusValue === 'processing' || routingStatusValue === 'pending'
      ? { color: accentColor }
      : undefined
  const metaDividerToneClass = isDark ? 'text-white/25' : 'text-slate-300'
  const relativeTimeLabel = formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)

  useEffect(() => {
    if (!onHeightChange) return

    const element = cardRef.current
    if (!element) return

    const reportHeight = (height: number) => {
      if (!Number.isFinite(height) || height <= 0) return
      onHeightChange(item.id, height)
    }

    reportHeight(element.getBoundingClientRect().height)

    if (typeof ResizeObserver === 'undefined') {
      const raf = window.requestAnimationFrame(() => {
        reportHeight(element.getBoundingClientRect().height)
      })
      return () => window.cancelAnimationFrame(raf)
    }

    const observer = new ResizeObserver((entries) => {
      const nextHeight = entries[0]?.contentRect.height
      if (typeof nextHeight === 'number') {
        reportHeight(nextHeight)
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [item.id, onHeightChange])

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

    const rawTarget = event.target
    const targetElement = rawTarget instanceof Element
      ? rawTarget
      : rawTarget instanceof Node
        ? rawTarget.parentElement
        : null

    if (targetElement) {
      const interactiveSelector = 'button, a, input, textarea, select, [role="button"], [role="menuitem"], video, audio, [data-card-ignore-click]'
      if (targetElement.closest(interactiveSelector)) return
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
      ref={cardRef}
      layout
      initial={animationConfig.initial}
      animate={animationConfig.animate}
      transition={animationConfig.transition}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={handleCardClick}
      className={cn(
        "group relative mb-4 flex min-h-[132px] break-inside-avoid overflow-hidden rounded-2xl border p-3.5 transition-shadow duration-200 md:mb-2.5 md:min-h-[140px]",
        "border-border bg-card shadow-sm hover:shadow-md",
        "dark:border-border dark:bg-background/70 dark:hover:border-border",
        isAnalyzing && "ring-1"
      )}
    >
      {isAnalyzing && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute left-[58%] top-[108%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.4px]"
            style={{ borderColor: `color-mix(in srgb, ${accentColor} 48%, transparent)` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 3.15, opacity: [0, 0.34, 0] }}
            transition={{ duration: 2.0, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute left-[58%] top-[108%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.2px]"
            style={{ borderColor: `color-mix(in srgb, ${accentColor} 42%, transparent)` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 3.15, opacity: [0, 0.28, 0] }}
            transition={{ duration: 2.0, repeat: Infinity, ease: 'easeOut', delay: 0.22 }}
          />
          <motion.div
            className="absolute left-[58%] top-[108%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ borderColor: `color-mix(in srgb, ${accentColor} 38%, transparent)` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 3.15, opacity: [0, 0.22, 0] }}
            transition={{ duration: 2.0, repeat: Infinity, ease: 'easeOut', delay: 0.44 }}
          />
          <motion.div
            className="absolute left-[58%] top-[108%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ borderColor: `color-mix(in srgb, ${accentColor} 35%, transparent)` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 3.15, opacity: [0, 0.16, 0] }}
            transition={{ duration: 2.0, repeat: Infinity, ease: 'easeOut', delay: 0.66 }}
          />
        </div>
      )}

      <div className="relative z-10 flex w-full flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex flex-1 items-center gap-1.5 text-[12px]">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" style={{ color: accentColor }}>
              <CategoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span
              className="-ml-[3px] shrink-0 font-semibold"
              style={{ color: accentColor }}
              title={categoryDisplayLabel}
            >
              {categoryDisplayLabel}
            </span>

            {showDestination && (
              <>
                {!showProcessingDestination && (
                  <span className={cn('text-[11px] font-medium', metaDividerToneClass)}>→</span>
                )}
                {showProcessingDestination && <RoutingPulseBlocks accentColor={accentColor} />}
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center opacity-[0.85]">
                  <MCPConnectorLogo
                    serverType={primaryDestination?.serverType}
                    name={primaryDestination?.label}
                    logoColor={primaryDestination?.logoColor || accentColor}
                    size="sm"
                    className="h-4 w-4 rounded-[4px] text-[9px]"
                  />
                </span>
                <span
                  className="-ml-[3px] min-w-0 truncate text-[12px] font-semibold"
                  style={{ color: accentColor }}
                  title={destinationNames.join(', ')}
                >
                  {destinationSummary}
                </span>
              </>
            )}

            {showRoutingStateText && (
              <>
                {!isRoutingProcessing && (
                  <span className={cn('text-[11px] font-medium', metaDividerToneClass)}>·</span>
                )}
                {isRoutingProcessing && !showDestination && <RoutingPulseBlocks accentColor={accentColor} />}
                <span
                  className={cn('truncate text-[12px] font-medium', routingStateToneClass)}
                  style={routingStateStyle}
                >
                  {routingStateText}
                </span>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <span className={cn('text-[10px] font-medium uppercase tracking-[0.08em]', isDark ? 'text-white/42' : 'text-slate-400')}>
              {relativeTimeLabel}
            </span>

            {isFailed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onRetry(item.id)
                }}
                disabled={retryingId === item.id}
                className="h-7 w-7 rounded-full text-rose-500/80 hover:text-rose-500"
              >
                {retryingId === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            )}

            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
                    isDark
                      ? 'text-white/42 hover:text-white/72 focus-visible:ring-white/30'
                      : 'text-slate-400 hover:text-slate-600 focus-visible:ring-slate-300/80'
                  )}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="z-50 w-36 border border-border bg-popover text-[11px] font-semibold text-popover-foreground"
              >
                <DropdownMenuItem
                  onClick={() => handleCopyContent()}
                  className="cursor-pointer gap-2 text-[11px] font-semibold focus:bg-accent"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{t('actions.copy')}</span>
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem
                    onClick={() => onEdit(item)}
                    className="cursor-pointer gap-2 text-[11px] font-semibold focus:bg-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>{t('actions.editContent')}</span>
                  </DropdownMenuItem>
                )}
                {onReclassify && (
                  <DropdownMenuItem
                    onClick={() => onReclassify(item.id)}
                    className="cursor-pointer gap-2 text-[11px] font-semibold focus:bg-accent"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{t('actions.reclassify')}</span>
                  </DropdownMenuItem>
                )}
                {onRedistribute && (
                  <DropdownMenuItem
                    onClick={() => onRedistribute(item.id)}
                    className="cursor-pointer gap-2 text-[11px] font-semibold focus:bg-accent"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{t('actions.redistribute')}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onDelete(item.id)}
                  className="cursor-pointer gap-2 text-[11px] font-semibold text-destructive focus:bg-accent focus:text-destructive"
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
        <div className="mb-3 flex-1">
          <h3 className={cn(
            "text-[16px] font-semibold leading-[1.58] sm:text-[17px]",
            isAnalyzing ? 'text-muted-foreground italic' : 'text-foreground',
            item.contentType === ContentType.URL ? 'break-all' : 'break-words',
            'whitespace-pre-wrap',
            "line-clamp-3"
          )}>
            <LinkifiedText
              text={item.content}
              linkClassName={cn(
                'text-current hover:opacity-80',
                item.contentType === ContentType.URL && 'font-semibold'
              )}
            />
          </h3>

          {/* 文件预览 */}
          {item.hasFile && (
            <div className="mt-3">
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
                    "bg-muted/30 border-border dark:bg-background/70 dark:border-border"
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
                          "bg-background/85 border-border text-foreground"
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
                    "bg-muted/30 border-border"
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
                      "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>


      </div>
    </motion.div>
  )
}

// 使用 React.memo 避免不必要的重渲染
export const MemoryCard = memo(MemoryCardComponent)
