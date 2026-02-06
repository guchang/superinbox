"use client"

import React, { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Download, Expand, File, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { ImageGallery } from "@/components/inbox/image-gallery"
import { AudioWavePlayer } from "@/components/inbox/audio-wave-player"
import { inboxApi } from "@/lib/api/inbox"
import { getApiBaseUrl } from "@/lib/api/base-url"

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
}

export function FilePreview({
  itemId,
  fileName,
  mimeType,
  allFiles,
  imageLayout = "thumb",
}: FilePreviewProps) {
  const t = useTranslations("filePreview")
  const [mediaObjectUrls, setMediaObjectUrls] = useState<Record<string, string>>({})
  const mediaObjectUrlsRef = useRef<Record<string, string>>({})
  const mediaLoadAttempts = useRef<Set<string>>(new Set())

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
