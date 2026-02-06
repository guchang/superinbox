"use client"

import React, { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface GalleryImage {
  id: string | number
  src: string
  alt: string
  onError?: () => void
  onDownload?: () => void
  downloadLabel?: string
}

interface ImageGalleryProps {
  images: GalleryImage[]
  layout?: "grid" | "card" | "thumb"
  maxDisplayCount?: number
  className?: string
  onOpenChange?: (open: boolean) => void
}

const HIDDEN_TITLE_STYLE = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
} as const

function getImageTileClass(displayCount: number, index: number) {
  if (displayCount === 1) {
    return "col-span-2 md:col-span-4 aspect-[16/9]"
  }
  if (displayCount === 2) {
    return "col-span-1 md:col-span-2 aspect-[4/3]"
  }
  if (displayCount === 3) {
    if (index === 0) return "col-span-2 md:col-span-2 aspect-[16/9]"
    return "col-span-1 md:col-span-2 aspect-[4/3]"
  }
  if (displayCount === 4) {
    return "col-span-1 md:col-span-2 aspect-[4/3]"
  }
  if (displayCount >= 5) {
    if (index === 0) return "col-span-2 md:col-span-2 aspect-[16/9]"
    return "col-span-1 md:col-span-1 aspect-[4/3]"
  }
  return "col-span-1 md:col-span-1 aspect-[4/3]"
}

export function ImageGallery({
  images,
  layout = "grid",
  maxDisplayCount = 8,
  className,
  onOpenChange,
}: ImageGalleryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dragOffsetX, setDragOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    active: boolean
    pointerId: number | null
    startX: number
    startY: number
    mode: "idle" | "pending" | "horizontal" | "vertical"
    deltaX: number
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    mode: "idle",
    deltaX: 0,
  })
  const wheelStateRef = useRef<{
    phase: "idle" | "tracking" | "consumed"
    direction: -1 | 0 | 1
    accum: number
    lastEventTs: number
    lastAbsX: number
  }>({
    phase: "idle",
    direction: 0,
    accum: 0,
    lastEventTs: 0,
    lastAbsX: 0,
  })

  useEffect(() => {
    if (images.length === 0) {
      setIsOpen(false)
      setActiveIndex(0)
      return
    }

    const maxIndex = images.length - 1
    if (activeIndex > maxIndex) {
      setActiveIndex(maxIndex)
    }
  }, [images.length, activeIndex])

  useEffect(() => {
    setDragOffsetX(0)
    setIsDragging(false)
    dragStateRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      mode: "idle",
      deltaX: 0,
    }
  }, [isOpen, activeIndex, images.length])

  useEffect(() => {
    wheelStateRef.current = {
      phase: "idle",
      direction: 0,
      accum: 0,
      lastEventTs: 0,
      lastAbsX: 0,
    }
  }, [isOpen, images.length])

  if (images.length === 0) return null

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, images.length - 1))
  const activeImage = images[safeActiveIndex]
  const canGoPrev = safeActiveIndex > 0
  const canGoNext = safeActiveIndex < images.length - 1

  const openAt = (index: number) => {
    const next = Math.min(Math.max(index, 0), images.length - 1)
    setActiveIndex(next)
    setIsOpen(true)
    onOpenChange?.(true)
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const goToPrevImage = () => {
    setActiveIndex((prev) => Math.max(0, prev - 1))
  }

  const goToNextImage = () => {
    setActiveIndex((prev) => Math.min(images.length - 1, prev + 1))
  }

  const handleDownloadCurrent = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    activeImage.onDownload?.()
  }

  const handleKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat) return

    if (event.key === "ArrowLeft") {
      event.preventDefault()
      event.stopPropagation()
      goToPrevImage()
      return
    }

    if (event.key === "ArrowRight") {
      event.preventDefault()
      event.stopPropagation()
      goToNextImage()
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (images.length <= 1) return
    if (event.pointerType === "mouse" && event.button !== 0) return

    const interactiveElement = (event.target as HTMLElement).closest("button, a, input, textarea, select")
    if (interactiveElement) return

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: "pending",
      deltaX: 0,
    }
    setDragOffsetX(0)
    setIsDragging(false)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState.active || dragState.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    dragState.deltaX = deltaX

    if (dragState.mode === "pending") {
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      if (absX < 6 && absY < 6) {
        return
      }

      if (absX > absY * 1.2) {
        dragState.mode = "horizontal"
        setIsDragging(true)
      } else {
        dragState.mode = "vertical"
        dragState.active = false
        setDragOffsetX(0)
        setIsDragging(false)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        return
      }
    }

    if (dragState.mode !== "horizontal") return

    event.preventDefault()
    event.stopPropagation()

    const draggingToPrev = deltaX > 0
    const draggingToNext = deltaX < 0
    const edgeResistance = (draggingToPrev && !canGoPrev) || (draggingToNext && !canGoNext) ? 0.35 : 1
    setDragOffsetX(deltaX * edgeResistance)
  }

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState.active || dragState.pointerId !== event.pointerId) return

    const isHorizontalDrag = dragState.mode === "horizontal"
    const totalDeltaX = dragState.deltaX
    const viewportWidth = viewportRef.current?.clientWidth ?? 0
    const switchThreshold = Math.min(140, Math.max(56, viewportWidth * 0.18))

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    dragStateRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      mode: "idle",
      deltaX: 0,
    }

    if (isHorizontalDrag) {
      event.preventDefault()
      event.stopPropagation()

      if (totalDeltaX <= -switchThreshold && canGoNext) {
        goToNextImage()
      } else if (totalDeltaX >= switchThreshold && canGoPrev) {
        goToPrevImage()
      }
    }

    setDragOffsetX(0)
    setIsDragging(false)
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (images.length <= 1) return

    const viewportHeight = viewportRef.current?.clientHeight
      ?? (typeof window !== "undefined" ? window.innerHeight : 800)
    const deltaUnit = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? viewportHeight
        : 1

    const deltaX = event.deltaX * deltaUnit
    const deltaY = event.deltaY * deltaUnit
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absX < 1.5 && absY < 1.5) return
    if (absX <= absY * 1.15) return

    event.preventDefault()
    event.stopPropagation()

    const direction: -1 | 1 = deltaX > 0 ? 1 : -1
    const wheelState = wheelStateRef.current
    const now = performance.now()
    const hasGap = now - wheelState.lastEventTs > 140
    const hasSpike = absX >= 14 && absX > wheelState.lastAbsX * 1.3
    const directionChanged = wheelState.direction !== 0 && direction !== wheelState.direction

    if (hasGap || wheelState.phase === "idle") {
      wheelState.phase = "tracking"
      wheelState.direction = direction
      wheelState.accum = deltaX
    } else if (wheelState.phase === "consumed") {
      if (hasSpike || directionChanged) {
        wheelState.phase = "tracking"
        wheelState.direction = direction
        wheelState.accum = deltaX
      } else {
        wheelState.lastEventTs = now
        wheelState.lastAbsX = absX
        return
      }
    } else if (directionChanged) {
      wheelState.phase = "tracking"
      wheelState.direction = direction
      wheelState.accum = deltaX
    } else {
      wheelState.accum += deltaX
    }

    wheelState.lastEventTs = now
    wheelState.lastAbsX = absX

    const viewportWidth = viewportRef.current?.clientWidth ?? 0
    const switchThreshold = Math.min(96, Math.max(36, viewportWidth * 0.06))
    if (Math.abs(wheelState.accum) < switchThreshold) return

    let didNavigate = false
    if (wheelState.direction > 0 && canGoNext) {
      goToNextImage()
      didNavigate = true
    } else if (wheelState.direction < 0 && canGoPrev) {
      goToPrevImage()
      didNavigate = true
    }

    wheelState.accum = 0
    wheelState.phase = "consumed"

    if (!didNavigate) {
      wheelState.lastAbsX = 0
    }
  }

  const indicatorIndexes = images.length <= 8
    ? images.map((_, index) => index)
    : (() => {
        const start = Math.min(Math.max(safeActiveIndex - 3, 0), images.length - 8)
        return Array.from({ length: 8 }, (_, offset) => start + offset)
      })()

  const renderDialog = () => (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        data-card-ignore-click
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={handleKeyDownCapture}
        className="w-[min(96vw,1720px)] max-w-none h-[88vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden"
        overlayClassName="bg-black/80 backdrop-blur-sm"
      >
        <DialogTitle style={HIDDEN_TITLE_STYLE}>{activeImage.alt}</DialogTitle>

        <div className="relative w-full h-full overflow-hidden rounded-[24px] bg-zinc-900/80" data-card-ignore-click>
          <div className="absolute inset-0 overflow-hidden">
            <img
              key={`bg-${activeImage.id}`}
              src={activeImage.src}
              alt=""
              aria-hidden="true"
              onError={activeImage.onError}
              className="absolute inset-0 h-full w-full object-cover scale-110 blur-3xl opacity-55"
            />
            <div className="absolute inset-0 bg-black/45" />
          </div>

          <div
            ref={viewportRef}
            className={cn(
              "relative z-10 flex h-full w-full items-center justify-center px-4 md:px-12",
              isDragging ? "cursor-grabbing" : "cursor-grab",
              !isDragging && "transition-transform duration-300 ease-out"
            )}
            style={{
              transform: `translate3d(${dragOffsetX}px, 0, 0)`,
              touchAction: "pan-y",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onLostPointerCapture={finishDrag}
            onWheel={handleWheel}
          >
            <img
              key={`main-${activeImage.id}`}
              src={activeImage.src}
              alt={activeImage.alt}
              onError={activeImage.onError}
              className="h-full w-auto max-w-full object-contain select-none"
              draggable={false}
            />
          </div>

          <div
            className="absolute z-30 flex items-center gap-2"
            style={{
              right: "max(1rem, env(safe-area-inset-right))",
              top: "max(1rem, env(safe-area-inset-top))",
            }}
          >
            <div className="inline-flex h-9 sm:h-10 items-center justify-center rounded-full px-3 text-xs font-semibold leading-none bg-black/45 text-white/85">
              {safeActiveIndex + 1}/{images.length}
            </div>

            {activeImage.onDownload && (
              <button
                type="button"
                data-card-ignore-click
                aria-label={activeImage.downloadLabel || "下载图片"}
                onClick={handleDownloadCurrent}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-all duration-200 bg-black/45 text-white hover:bg-black/65 hover:scale-[1.03] active:scale-95"
              >
                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}

            <DialogClose asChild>
              <button
                type="button"
                data-card-ignore-click
                aria-label="关闭预览"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-all duration-200 bg-black/45 text-white hover:bg-black/65 hover:scale-[1.03] active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogClose>
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                data-card-ignore-click
                onClick={goToPrevImage}
                disabled={!canGoPrev}
                aria-label="上一张"
                className={cn(
                  "absolute left-2 md:left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center transition-colors",
                  canGoPrev ? "bg-black/45 text-white hover:bg-black/65" : "bg-white/8 text-white/35 cursor-not-allowed"
                )}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                data-card-ignore-click
                onClick={goToNextImage}
                disabled={!canGoNext}
                aria-label="下一张"
                className={cn(
                  "absolute right-2 md:right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center transition-colors",
                  canGoNext ? "bg-black/45 text-white hover:bg-black/65" : "bg-white/8 text-white/35 cursor-not-allowed"
                )}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {images.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
              {indicatorIndexes.map((index) => (
                <button
                  key={`indicator-${images[index]?.id ?? index}`}
                  type="button"
                  data-card-ignore-click
                  aria-label={`查看第 ${index + 1} 张`}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    safeActiveIndex === index ? "w-5 bg-white/90" : "w-2.5 bg-white/35 hover:bg-white/55"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  const isGrid = layout === "grid" || images.length > 1

  if (isGrid) {
    const displayImages = images.slice(0, maxDisplayCount)
    const hiddenImageCount = Math.max(0, images.length - displayImages.length)

    return (
      <>
        <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3", className)}>
          {displayImages.map((image, displayIndex) => {
            const isOverflowTile = hiddenImageCount > 0 && displayIndex === displayImages.length - 1
            return (
              <button
                key={image.id}
                type="button"
                data-card-ignore-click
                className={cn(
                  "relative group overflow-hidden rounded-xl border border-border/70 bg-muted/20",
                  "shadow-sm transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  getImageTileClass(displayImages.length, displayIndex)
                )}
                onClick={() => openAt(displayIndex)}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  onError={image.onError}
                />
                {isOverflowTile && (
                  <div className="absolute inset-0 z-10 pointer-events-none bg-black/55 flex items-center justify-center">
                    <div className="rounded-full px-3 py-1 text-sm font-semibold text-white bg-black/35 border border-white/15 backdrop-blur-sm">
                      +{hiddenImageCount}
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {renderDialog()}
      </>
    )
  }

  const triggerClassName = layout === "card"
    ? "w-full aspect-video rounded-2xl overflow-hidden relative border shadow-sm cursor-zoom-in bg-muted/30"
    : "relative group w-32 h-24 overflow-hidden rounded-xl border border-border/70 bg-muted/20 shadow-sm cursor-zoom-in"

  return (
    <>
      <button
        type="button"
        data-card-ignore-click
        aria-label={images[0].alt}
        className={cn(triggerClassName, className)}
        onClick={() => openAt(0)}
      >
        <img
          src={images[0].src}
          alt={images[0].alt}
          onError={images[0].onError}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </button>
      {renderDialog()}
    </>
  )
}
