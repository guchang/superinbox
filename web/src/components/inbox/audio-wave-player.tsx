"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { useTheme } from "next-themes"
import { Pause, Play } from "lucide-react"

import { cn } from "@/lib/utils"

interface AudioWavePlayerProps {
  src: string
  onError?: () => void
  className?: string
  waveformKey?: string
  ignoreCardClick?: boolean
}

export function AudioWavePlayer({
  src,
  onError,
  className,
  waveformKey,
  ignoreCardClick = false,
}: AudioWavePlayerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [barCount, setBarCount] = useState(42)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveformContainerRef = useRef<HTMLDivElement | null>(null)
  const waveformTimerRef = useRef<number | null>(null)

  const waveformHeights = useMemo(
    () => Array.from({ length: barCount }, () => Math.floor(Math.random() * 40) + 30),
    [barCount]
  )
  const [animatedHeights, setAnimatedHeights] = useState<number[]>(waveformHeights)

  useEffect(() => {
    return () => {
      if (waveformTimerRef.current) {
        window.clearInterval(waveformTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const element = waveformContainerRef.current
    if (!element || typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width = entry.contentRect.width
      const barWidth = 2
      const gap = 4
      const count = Math.floor((width + gap) / (barWidth + gap))
      const clamped = Math.min(64, Math.max(12, count))
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

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.pause()
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [src])

  const handleTogglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      try {
        await audio.play()
      } catch (error) {
        console.error("Audio play failed:", error)
      }
    } else {
      audio.pause()
    }
  }, [])

  const handleSeek = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return

    const { left, width } = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((event.clientX - left) / width, 0), 1)
    const nextTime = ratio * duration

    audioRef.current.currentTime = nextTime
    setCurrentTime(nextTime)
  }, [duration])

  const progress = duration > 0 ? currentTime / duration : 0
  const activeBars = Math.round(progress * waveformHeights.length)
  const displayHeights = isPlaying ? animatedHeights : waveformHeights

  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "--:--"
    const minutes = Math.floor(value / 60)
    const seconds = Math.floor(value % 60)
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }

  const currentTimeLabel = formatTime(currentTime)
  const durationLabel = formatTime(duration)

  return (
    <div
      data-card-ignore-click={ignoreCardClick ? true : undefined}
      className={cn(
        "w-full min-w-0 max-w-full overflow-hidden p-3 rounded-xl flex items-center gap-3 border",
        isDark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/5",
        className
      )}
    >
      <button
        type="button"
        onClick={handleTogglePlay}
        aria-label={isPlaying ? "暂停播放" : "播放音频"}
        className={cn(
          "w-8 h-8 min-w-8 min-h-8 p-0 aspect-square shrink-0 rounded-full flex items-center justify-center transition",
          isDark ? "bg-white/10 text-white" : "bg-black/10 text-black"
        )}
      >
        {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
      </button>

      <div
        ref={waveformContainerRef}
        data-card-ignore-click={ignoreCardClick ? true : undefined}
        className="flex-1 min-w-0 flex items-end gap-1 h-6 cursor-pointer overflow-hidden"
        onClick={handleSeek}
        role="presentation"
      >
        {displayHeights.map((height, index) => (
          <div
            key={`${waveformKey || src}-wave-${index}`}
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
        src={src}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0)
          setCurrentTime(event.currentTarget.currentTime || 0)
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={onError}
        className="hidden"
      />
    </div>
  )
}
