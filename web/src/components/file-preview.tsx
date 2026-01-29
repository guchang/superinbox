"use client"

import React, { useState } from "react"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Download, Expand, File, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { inboxApi } from "@/lib/api/inbox"
import { getApiBaseUrl } from "@/lib/api/base-url"

// VisuallyHidden component for accessibility
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  }}>{children}</span>
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
}

export function FilePreview({ itemId, fileName, mimeType, allFiles }: FilePreviewProps) {
  const t = useTranslations('filePreview')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [isLoadingImage, setIsLoadingImage] = useState(false)

  const apiBaseUrl = getApiBaseUrl()
  const fileUrl = `${apiBaseUrl}/inbox/${itemId}/file`

  const handleDownload = async () => {
    try {
      await inboxApi.downloadFile(itemId, fileName)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  // If we have multiple files, show horizontal scrolling layout
  if (allFiles && allFiles.length > 1) {
    const imageFiles = allFiles.filter(file => file.mimeType.startsWith('image/'))
    const otherFiles = allFiles.filter(file => !file.mimeType.startsWith('image/'))

    return (
      <div className="space-y-4">
        {/* Image files - horizontal scroll */}
        {imageFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t('sections.images', { count: imageFiles.length })}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {allFiles.map((file, originalIndex) => {
                if (!file.mimeType.startsWith('image/')) return null
                const imageUrl = `${apiBaseUrl}/inbox/${itemId}/file/${originalIndex}`

                return (
                  <div key={originalIndex} className="relative group flex-shrink-0 w-32 h-24">
                    <img
                      src={imageUrl}
                      alt={file.fileName}
                      className="w-full h-full object-cover border"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        const token = typeof window !== 'undefined'
                          ? localStorage.getItem('superinbox_auth_token')
                          : null

                        fetch(imageUrl, {
                          headers: {
                            'Authorization': token ? `Bearer ${token}` : '',
                          },
                        })
                          .then(res => res.blob())
                          .then(blob => {
                            const url = URL.createObjectURL(blob)
                            img.src = url
                          })
                          .catch(err => console.error('Failed to load image:', err))
                      }}
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
                            <DialogTitle>{t('dialog.imageTitle', { name: file.fileName })}</DialogTitle>
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
                                onClick={() => {
                                  const downloadUrl = `${apiBaseUrl}/inbox/${itemId}/file/${originalIndex}/download`
                                  const token = typeof window !== 'undefined'
                                    ? localStorage.getItem('superinbox_auth_token')
                                    : null

                                  fetch(downloadUrl, {
                                    headers: {
                                      'Authorization': token ? `Bearer ${token}` : '',
                                    },
                                  })
                                    .then(res => res.blob())
                                    .then(blob => {
                                      const url = URL.createObjectURL(blob)
                                      const link = document.createElement('a')
                                      link.href = url
                                      link.download = file.fileName
                                      document.body.appendChild(link)
                                      link.click()
                                      document.body.removeChild(link)
                                      URL.revokeObjectURL(url)
                                    })
                                }}
                              >
                                <Download className="h-5 w-5" />
                              </Button>
                            </div>

                            <img
                              src={imageUrl}
                              alt={file.fileName}
                              className="w-auto h-auto max-w-full max-h-[85vh] object-contain shadow-2xl transition-all duration-300 ease-out select-none"
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const downloadUrl = `${apiBaseUrl}/inbox/${itemId}/file/${originalIndex}/download`
                          const token = typeof window !== 'undefined'
                            ? localStorage.getItem('superinbox_auth_token')
                            : null

                          fetch(downloadUrl, {
                            headers: {
                              'Authorization': token ? `Bearer ${token}` : '',
                            },
                          })
                            .then(res => {
                              if (!res.ok) throw new Error('Download failed')
                              return res.blob()
                            })
                            .then(blob => {
                              const url = URL.createObjectURL(blob)
                              const link = document.createElement('a')
                              link.href = url
                              link.download = file.fileName
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                              URL.revokeObjectURL(url)
                            })
                            .catch(err => console.error('Download failed:', err))
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              }).filter(Boolean)}
            </div>
          </div>
        )}

        {/* Other files - horizontal scroll */}
        {otherFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t('sections.files', { count: otherFiles.length })}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {allFiles.map((file, originalIndex) => {
                if (file.mimeType.startsWith('image/')) return null

                return (
                  <div key={originalIndex} className="flex-shrink-0 flex items-center gap-3 p-3 bg-muted rounded-lg border min-w-[220px] hover:bg-muted/80 transition-colors cursor-pointer group">
                    <div className="w-10 h-10 flex items-center justify-center bg-background rounded-lg shadow-sm group-hover:scale-105 transition-transform">
                      <File className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground truncate" title={file.fileName}>
                        {file.fileName}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {(file.fileSize / 1024).toFixed(1)}KB
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const downloadUrl = `${apiBaseUrl}/v1/inbox/${itemId}/file/${originalIndex}/download`
                        const token = typeof window !== 'undefined'
                          ? localStorage.getItem('superinbox_auth_token')
                          : null

                        fetch(downloadUrl, {
                          headers: {
                            'Authorization': token ? `Bearer ${token}` : '',
                          },
                        })
                          .then(res => {
                            if (!res.ok) throw new Error('Download failed')
                            return res.blob()
                          })
                          .then(blob => {
                            const url = URL.createObjectURL(blob)
                            const link = document.createElement('a')
                            link.href = url
                            link.download = file.fileName
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                            URL.revokeObjectURL(url)
                          })
                          .catch(err => console.error('Download failed:', err))
                      }}
                      className="h-8 w-8 p-0 flex-shrink-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                )
              }).filter(Boolean)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Single file or fallback to original logic
  const isImage = mimeType?.startsWith("image/")

  if (isImage) {
    return (
      <div className="relative group w-32 h-24">
        <img
          src={fileUrl}
          alt={fileName || t('imageAltFallback')}
          className="w-full h-full object-cover border"
          onError={(e) => {
            const img = e.target as HTMLImageElement
            setIsLoadingImage(true)
            const token = typeof window !== 'undefined'
              ? localStorage.getItem('superinbox_auth_token')
              : null

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
                setImageDataUrl(url)
                img.src = url
              })
              .catch(err => {
                console.error('Failed to load image:', err)
                setIsLoadingImage(false)
              })
              .finally(() => {
                setIsLoadingImage(false)
              })
          }}
        />
        {isLoadingImage && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="text-white text-sm">{t('loading')}</div>
          </div>
        )}
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
                  {t('dialog.imageTitle', { name: fileName || t('uploadedImage') })}
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
                    {fileName || t('uploadedImage')}
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

                <img
                  src={imageDataUrl || fileUrl}
                  alt={fileName}
                  className="w-auto h-auto max-w-full max-h-[85vh] object-contain shadow-2xl transition-all duration-300 ease-out select-none"
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

  // Non-image file fallback
  return (
    <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border hover:bg-muted/80 transition-colors">
      <div className="w-10 h-10 flex items-center justify-center bg-background rounded-lg shadow-sm">
        <File className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{fileName || t('fileFallback')}</div>
      </div>
      <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
        <Download className="h-4 w-4" />
        {t('download')}
      </Button>
    </div>
  )
}
