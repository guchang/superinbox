"use client"

import Image from "next/image"
import React, { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download, Expand, File, FileAudio2, Play, X } from "lucide-react"
import {
  Dialog,
  DialogDescription,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { ImageGallery } from "@/components/inbox/image-gallery"
import { AudioWavePlayer } from "@/components/inbox/audio-wave-player"
import { inboxApi } from "@/lib/api/inbox"
import { getApiBaseUrl } from "@/lib/api/base-url"
import { cn } from "@/lib/utils"

const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: 0,
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      borderWidth: 0,
    }}
  >
    {children}
  </span>
)

interface FilePreviewProps {
  itemId: string
  fileName?: string
  mimeType?: string
  allFiles?: Array<{
    fileName: string
    mimeType: string
    fileSize: number
    filePath: string
  }>
  imageLayout?: "thumb" | "card"
  variant?: "default" | "detailTypeAware"
}

export function FilePreview({
  itemId,
  fileName,
  mimeType,
  allFiles,
  imageLayout = "thumb",
  variant = "default",
}: FilePreviewProps) {
  const t = useTranslations("filePreview")
  const [mediaObjectUrls, setMediaObjectUrls] = useState<Record<string, string>>({})
  const mediaObjectUrlsRef = useRef<Record<string, string>>({})
  const mediaLoadAttempts = useRef<Set<string>>(new Set())
  const [detailVideoPreviewIndex, setDetailVideoPreviewIndex] = useState<number | null>(null)
  const [detailAudioPreviewIndex, setDetailAudioPreviewIndex] = useState<number | null>(null)

  const apiBaseUrl = getApiBaseUrl()
  const fileUrl = `${apiBaseUrl}/inbox/${itemId}/file`

  useEffect(() => {
    const objectUrlRef = mediaObjectUrlsRef
    return () => {
      Object.values(objectUrlRef.current).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const getAuthToken = () => {
    return typeof window !== "undefined"
      ? localStorage.getItem("superinbox_auth_token")
      : null
  }

  const handleDownload = async () => {
    try {
      await inboxApi.downloadFile(itemId, fileName)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  const downloadFileByIndex = async (originalIndex: number, name: string) => {
    const downloadUrl = `${apiBaseUrl}/inbox/${itemId}/file/${originalIndex}/download`
    const token = getAuthToken()

    try {
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      })

      if (!response.ok) {
        let detail = response.statusText
        try {
          const payload = await response.json() as {
            message?: string
            error?: { message?: string } | string
          }
          if (typeof payload.error === "string") {
            detail = payload.error
          } else if (payload.error?.message) {
            detail = payload.error.message
          } else if (payload.message) {
            detail = payload.message
          }
        } catch {
          // ignore parse errors and keep status text
        }

        throw new Error(`Download failed (${response.status}): ${detail}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  const handleMediaError = async (key: string, url: string) => {
    if (mediaObjectUrlsRef.current[key] || mediaLoadAttempts.current.has(key)) return
    mediaLoadAttempts.current.add(key)

    const token = getAuthToken()

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      })
      if (!response.ok) throw new Error("Failed to load media")
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      mediaObjectUrlsRef.current[key] = objectUrl
      setMediaObjectUrls((prev) => ({ ...prev, [key]: objectUrl }))
    } catch (error) {
      console.error("Failed to load media:", error)
    }
  }

  const renderAudioPlayer = (mediaSrc: string, mediaKey: string, mediaUrl: string) => (
    <AudioWavePlayer
      src={mediaSrc}
      waveformKey={`${itemId}-${mediaKey}`}
      onError={() => handleMediaError(mediaKey, mediaUrl)}
      className="w-full min-w-0"
    />
  )

  const normalizedFiles = allFiles ?? []
  const hasMultipleFiles = normalizedFiles.length > 1
  const indexedFiles = normalizedFiles.map((file, originalIndex) => ({ file, originalIndex }))

  const imageEntries = indexedFiles.filter(({ file }) => file.mimeType?.toLowerCase().startsWith("image/"))
  const audioEntries = indexedFiles.filter(({ file }) => file.mimeType?.toLowerCase().startsWith("audio/"))
  const videoEntries = indexedFiles.filter(({ file }) => file.mimeType?.toLowerCase().startsWith("video/"))
  const otherEntries = indexedFiles.filter(({ file }) => {
    const lowerMimeType = file.mimeType?.toLowerCase() ?? ""
    return !lowerMimeType.startsWith("image/")
      && !lowerMimeType.startsWith("audio/")
      && !lowerMimeType.startsWith("video/")
  })

  if (variant === "detailTypeAware") {
    type DetailPreviewEntry = {
      id: string
      fileName: string
      mimeType: string
      fileSize: number
      mediaUrl: string
      mediaKey: string
      onDownload: () => Promise<void>
    }

    const detailEntries: DetailPreviewEntry[] = indexedFiles.length > 0
      ? indexedFiles.map(({ file, originalIndex }) => ({
          id: `indexed-${originalIndex}`,
          fileName: file.fileName,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          mediaUrl: `${apiBaseUrl}/inbox/${itemId}/file/${originalIndex}`,
          mediaKey: `detail-${originalIndex}`,
          onDownload: () => downloadFileByIndex(originalIndex, file.fileName),
        }))
      : (fileName || mimeType)
          ? [{
              id: "single-file",
              fileName: fileName || t("fileFallback"),
              mimeType: mimeType || "application/octet-stream",
              fileSize: 0,
              mediaUrl: fileUrl,
              mediaKey: "detail-single",
              onDownload: handleDownload,
            }]
          : []

    const detailImageEntries = detailEntries.filter((entry) => entry.mimeType.toLowerCase().startsWith("image/"))
    const detailVideoEntries = detailEntries.filter((entry) => entry.mimeType.toLowerCase().startsWith("video/"))
    const detailAudioEntries = detailEntries.filter((entry) => entry.mimeType.toLowerCase().startsWith("audio/"))
    const detailFileEntries = detailEntries.filter((entry) => {
      const lowerMimeType = entry.mimeType.toLowerCase()
      return !lowerMimeType.startsWith("image/")
        && !lowerMimeType.startsWith("video/")
        && !lowerMimeType.startsWith("audio/")
    })
    const detailGalleryImages = detailImageEntries.map((entry) => ({
      id: entry.id,
      src: mediaObjectUrls[entry.mediaKey] || entry.mediaUrl,
      alt: entry.fileName,
      onError: () => void handleMediaError(entry.mediaKey, entry.mediaUrl),
      onDownload: () => void entry.onDownload(),
      downloadLabel: `${t("download")} ${entry.fileName}`,
    }))

    const videoPreviewIndex = detailVideoPreviewIndex ?? 0
    const videoPreviewEntry = detailVideoEntries[videoPreviewIndex] ?? null
    const audioPreviewEntry = detailAudioPreviewIndex == null
      ? null
      : detailAudioEntries[detailAudioPreviewIndex] ?? null

    const mediaTileGroupClass = "flex justify-start gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:grid md:content-start md:justify-start md:grid-cols-[repeat(auto-fill,minmax(96px,96px))] md:gap-2 md:overflow-visible md:pb-0"
    const mediaTileClass = "relative h-[96px] w-[96px] min-h-[96px] min-w-[96px] max-h-[96px] max-w-[96px] shrink-0 overflow-hidden rounded-xl border border-border bg-card"

    if (detailEntries.length === 0) {
      return null
    }

    return (
      <div className="space-y-4 w-full max-w-full min-w-0">
        {detailImageEntries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("sections.images", { count: detailImageEntries.length })}
            </div>
            <ImageGallery
              images={detailGalleryImages}
              renderTrigger={(openAt) => (
                <div className={mediaTileGroupClass}>
                  {detailImageEntries.map((entry, index) => {
                    const mediaSrc = mediaObjectUrls[entry.mediaKey] || entry.mediaUrl
                    return (
                      <div
                        key={entry.id}
                        role="button"
                        tabIndex={0}
                        data-card-ignore-click
                        aria-label={entry.fileName}
                        className={cn(mediaTileClass, "cursor-zoom-in")}
                        onClick={() => openAt(index)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            openAt(index)
                          }
                        }}
                      >
                        <Image
                          src={mediaSrc}
                          alt={entry.fileName}
                          fill
                          sizes="96px"
                          unoptimized
                          className="h-full w-full object-cover"
                          onError={() => void handleMediaError(entry.mediaKey, entry.mediaUrl)}
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6 rounded-md bg-black/55 text-white hover:bg-black/70"
                          onClick={(event) => {
                            event.stopPropagation()
                            void entry.onDownload()
                          }}
                          aria-label={`${t("download")} ${entry.fileName}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            />
          </div>
        )}

        {detailVideoEntries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("sections.video", { count: detailVideoEntries.length })}
            </div>
            <div className={mediaTileGroupClass}>
              {detailVideoEntries.map((entry, index) => {
                const mediaSrc = mediaObjectUrls[entry.mediaKey] || entry.mediaUrl
                return (
                  <button
                    key={entry.id}
                    type="button"
                    data-card-ignore-click
                    aria-label={entry.fileName}
                    className={cn(mediaTileClass, "group cursor-zoom-in")}
                    onClick={() => setDetailVideoPreviewIndex(index)}
                  >
                    <video
                      preload="metadata"
                      playsInline
                      muted
                      src={mediaSrc}
                      className="h-full w-full object-cover"
                      onError={() => void handleMediaError(entry.mediaKey, entry.mediaUrl)}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white">
                        <Play className="h-3.5 w-3.5" fill="currentColor" />
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-1 top-1 h-6 w-6 rounded-md bg-black/55 text-white hover:bg-black/70"
                      onClick={(event) => {
                        event.stopPropagation()
                        void entry.onDownload()
                      }}
                      aria-label={`${t("download")} ${entry.fileName}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {detailAudioEntries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("sections.audio", { count: detailAudioEntries.length })}
            </div>
            <div className="space-y-2">
              {detailAudioEntries.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  data-card-ignore-click
                  onClick={() => setDetailAudioPreviewIndex(index)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileAudio2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{entry.fileName}</p>
                    <p className="text-xs text-muted-foreground">{t("sections.audio", { count: 1 })}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(event) => {
                      event.stopPropagation()
                      void entry.onDownload()
                    }}
                    aria-label={`${t("download")} ${entry.fileName}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </button>
              ))}
            </div>
          </div>
        )}

        {detailFileEntries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("sections.files", { count: detailFileEntries.length })}
            </div>
            <div className="space-y-2">
              {detailFileEntries.map((entry) => {
                const extension = entry.fileName.includes(".")
                  ? entry.fileName.split(".").pop()?.toUpperCase()
                  : ""

                return (
                  <div
                    key={entry.id}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <File className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{entry.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {extension || t("fileFallback")}
                        {entry.fileSize > 0 ? ` · ${(entry.fileSize / 1024).toFixed(1)}KB` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => void entry.onDownload()}
                      aria-label={`${t("download")} ${entry.fileName}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <Dialog open={detailVideoPreviewIndex != null} onOpenChange={(open) => !open && setDetailVideoPreviewIndex(null)}>
          <DialogContent className="max-w-[92vw] border-none bg-transparent p-0 shadow-none">
            <VisuallyHidden>
              <DialogTitle>{videoPreviewEntry?.fileName || t("uploadedImage")}</DialogTitle>
              <DialogDescription>{t("sections.video", { count: detailVideoEntries.length })}</DialogDescription>
            </VisuallyHidden>
            {videoPreviewEntry ? (
              <div className="relative flex min-h-[70vh] items-center justify-center">
                <div className="fixed inset-0 -z-10 bg-black/80 backdrop-blur-md" />
                <DialogClose className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white hover:bg-white/20">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </DialogClose>

                {detailVideoEntries.length > 1 && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-white/20"
                    onClick={() => setDetailVideoPreviewIndex((prev) => {
                      if (prev == null) return 0
                      return prev <= 0 ? detailVideoEntries.length - 1 : prev - 1
                    })}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}

                {detailVideoEntries.length > 1 && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-white/20"
                    onClick={() => setDetailVideoPreviewIndex((prev) => {
                      if (prev == null) return 0
                      return prev >= detailVideoEntries.length - 1 ? 0 : prev + 1
                    })}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}

                <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
                  <div className="max-w-[50vw] truncate rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs font-medium text-white">
                    {videoPreviewEntry.fileName}
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-black/45 text-white hover:bg-white/20"
                    onClick={() => void videoPreviewEntry.onDownload()}
                    aria-label={`${t("download")} ${videoPreviewEntry.fileName}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>

                <video
                  controls
                  preload="metadata"
                  playsInline
                  src={mediaObjectUrls[videoPreviewEntry.mediaKey] || videoPreviewEntry.mediaUrl}
                  onError={() => void handleMediaError(videoPreviewEntry.mediaKey, videoPreviewEntry.mediaUrl)}
                  className="max-h-[82vh] max-w-[92vw] object-contain"
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={detailAudioPreviewIndex != null} onOpenChange={(open) => !open && setDetailAudioPreviewIndex(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogTitle>{audioPreviewEntry?.fileName || t("fileFallback")}</DialogTitle>
            <DialogDescription>{t("sections.audio", { count: 1 })}</DialogDescription>
            {audioPreviewEntry ? (
              <div className="space-y-4">
                {renderAudioPlayer(
                  mediaObjectUrls[audioPreviewEntry.mediaKey] || audioPreviewEntry.mediaUrl,
                  audioPreviewEntry.mediaKey,
                  audioPreviewEntry.mediaUrl
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void audioPreviewEntry.onDownload()}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {t("download")}
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (hasMultipleFiles) {
    const galleryImages = imageEntries.map(({ file, originalIndex }) => {
      const imageUrl = `${apiBaseUrl}/inbox/${itemId}/file/${originalIndex}`
      const imageKey = `image-${originalIndex}`
      return {
        id: `image-${originalIndex}`,
        src: mediaObjectUrls[imageKey] || imageUrl,
        alt: file.fileName,
        onError: () => handleMediaError(imageKey, imageUrl),
        onDownload: () => downloadFileByIndex(originalIndex, file.fileName),
        downloadLabel: `${t("download")} ${file.fileName}`,
      }
    })

    return (
      <div className="space-y-4 w-full max-w-full min-w-0">
        {galleryImages.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("sections.images", { count: galleryImages.length })}
            </div>
            <ImageGallery images={galleryImages} layout="grid" />
          </div>
        )}

        {audioEntries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("sections.audio", { count: audioEntries.length })}
            </div>
            <div className="flex flex-col gap-3 w-full min-w-0">
              {audioEntries.map(({ originalIndex }) => {
                const mediaKey = `audio-${originalIndex}`
                const mediaUrl = `${apiBaseUrl}/inbox/${itemId}/file/${originalIndex}`
                const mediaSrc = mediaObjectUrls[mediaKey] || mediaUrl

                return (
                  <div key={originalIndex} className="w-full min-w-0">
                    {renderAudioPlayer(mediaSrc, mediaKey, mediaUrl)}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {videoEntries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("sections.video", { count: videoEntries.length })}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {videoEntries.map(({ file, originalIndex }) => {
                const mediaKey = `video-${originalIndex}`
                const mediaUrl = `${apiBaseUrl}/inbox/${itemId}/file/${originalIndex}`
                const mediaSrc = mediaObjectUrls[mediaKey] || mediaUrl

                return (
                  <div key={originalIndex} className="relative group flex-shrink-0 w-32 h-24">
                    <video
                      preload="metadata"
                      playsInline
                      muted
                      src={mediaSrc}
                      onError={() => handleMediaError(mediaKey, mediaUrl)}
                      className="w-full h-full object-cover border"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
                            <Expand className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-none">
                          <VisuallyHidden>
                            <DialogTitle>{t("dialog.videoTitle", { name: file.fileName })}</DialogTitle>
                          </VisuallyHidden>
                          <div className="relative group/modal flex flex-col items-center justify-center w-full h-full min-h-[50vh]">
                            <div className="fixed inset-0 bg-black/80 backdrop-blur-md -z-10" />
                            <DialogClose className="absolute top-4 right-4 z-30 h-10 w-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all">
                              <X className="h-5 w-5" />
                              <span className="sr-only">Close</span>
                            </DialogClose>

                            <div className="absolute top-4 left-4 flex items-center gap-2 z-20 opacity-0 group-hover/modal:opacity-100 transition-opacity">
                              <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-xs font-medium truncate max-w-[300px] shadow-lg">
                                {file.fileName}
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 shadow-lg"
                                onClick={() => downloadFileByIndex(originalIndex, file.fileName)}
                              >
                                <Download className="h-5 w-5" />
                              </Button>
                            </div>

                            <video
                              controls
                              preload="metadata"
                              playsInline
                              src={mediaSrc}
                              onError={() => handleMediaError(mediaKey, mediaUrl)}
                              className="w-auto h-auto max-w-full max-h-[85vh] object-contain shadow-2xl transition-all duration-300 ease-out"
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => downloadFileByIndex(originalIndex, file.fileName)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {otherEntries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("sections.files", { count: otherEntries.length })}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {otherEntries.map(({ file, originalIndex }) => (
                <div key={originalIndex} className="flex-shrink-0 w-[280px] sm:w-[320px] max-w-[78vw] flex items-center gap-3 p-3 bg-muted rounded-lg border hover:bg-muted/80 transition-colors cursor-pointer group">
                  <div className="w-10 h-10 flex items-center justify-center bg-background rounded-lg shadow-sm group-hover:scale-105 transition-transform">
                    <File className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-foreground truncate max-w-[170px] sm:max-w-[210px]" title={file.fileName}>
                      {file.fileName}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {(file.fileSize / 1024).toFixed(1)}KB
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadFileByIndex(originalIndex, file.fileName)}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const lowerMimeType = mimeType?.toLowerCase() ?? ""
  const isImage = lowerMimeType.startsWith("image/")
  const isAudio = lowerMimeType.startsWith("audio/")
  const isVideo = lowerMimeType.startsWith("video/")

  if (isImage) {
    const mediaKey = "single-image"
    const imageSrc = mediaObjectUrls[mediaKey] || fileUrl

    return (
      <ImageGallery
        images={[
          {
            id: mediaKey,
            src: imageSrc,
            alt: fileName || t("imageAltFallback"),
            onError: () => handleMediaError(mediaKey, fileUrl),
            onDownload: handleDownload,
            downloadLabel: t("download"),
          },
        ]}
        layout={imageLayout === "card" ? "card" : "thumb"}
      />
    )
  }

  if (isVideo) {
    const mediaKey = "single-video"
    const mediaSrc = mediaObjectUrls[mediaKey] || fileUrl

    return (
      <div className="relative group w-32 h-24">
        <video
          preload="metadata"
          playsInline
          muted
          src={mediaSrc}
          onError={() => handleMediaError(mediaKey, fileUrl)}
          className="w-full h-full object-cover border"
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
                <Expand className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-none">
              <VisuallyHidden>
                <DialogTitle>
                  {t("dialog.videoTitle", { name: fileName || t("fileFallback") })}
                </DialogTitle>
              </VisuallyHidden>
              <div className="relative group/modal flex flex-col items-center justify-center w-full h-full min-h-[50vh]">
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md -z-10" />
                <DialogClose className="absolute top-4 right-4 z-30 h-10 w-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </DialogClose>

                <div className="absolute top-4 left-4 flex items-center gap-2 z-20 opacity-0 group-hover/modal:opacity-100 transition-opacity">
                  <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-xs font-medium truncate max-w-[300px] shadow-lg">
                    {fileName || t("fileFallback")}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 w-9 p-0 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 shadow-lg"
                    onClick={handleDownload}
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                </div>

                <video
                  controls
                  preload="metadata"
                  playsInline
                  src={mediaSrc}
                  onError={() => handleMediaError(mediaKey, fileUrl)}
                  className="w-auto h-auto max-w-full max-h-[85vh] object-contain shadow-2xl transition-all duration-300 ease-out"
                />
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            className="h-8 w-8 p-0"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (isAudio) {
    const mediaKey = "single-media"
    const mediaSrc = mediaObjectUrls[mediaKey] || fileUrl

    return renderAudioPlayer(mediaSrc, mediaKey, fileUrl)
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border hover:bg-muted/80 transition-colors">
      <div className="w-10 h-10 flex items-center justify-center bg-background rounded-lg shadow-sm">
        <File className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{fileName || t("fileFallback")}</div>
      </div>
      <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
        <Download className="h-4 w-4" />
        {t("download")}
      </Button>
    </div>
  )
}
