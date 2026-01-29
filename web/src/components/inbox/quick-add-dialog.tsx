"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Plus, Upload, X, File } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { inboxApi } from "@/lib/api/inbox"
import { ContentType } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { getApiErrorMessage, type ApiError } from '@/lib/i18n/api-errors'

interface QuickAddDialogProps {
  trigger?: React.ReactNode
}

interface FilePreview {
  file: File
  preview: string
  error?: string
}

// Maximum file size: 20MB
const MAX_FILE_SIZE = 20 * 1024 * 1024

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function QuickAddDialog({ trigger }: QuickAddDialogProps) {
  const t = useTranslations('quickAdd')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [files, setFiles] = useState<FilePreview[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Validate file size
  const validateFileSize = useCallback((file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: t('toast.fileTooLarge.title'),
        description: t('toast.fileTooLarge.description', {
          name: file.name,
          size: formatFileSize(file.size),
          max: formatFileSize(MAX_FILE_SIZE),
        }),
        variant: "destructive",
      })
      return false
    }
    return true
  }, [toast])

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 只在没有聚焦到输入框、文本域等元素时触发
      const target = e.target as HTMLElement
      const isInputElement = target.tagName === 'INPUT' || 
                            target.tagName === 'TEXTAREA' || 
                            target.contentEditable === 'true' ||
                            target.role === 'textbox'
      
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && !isInputElement && !open) {
        e.preventDefault()
        setOpen(true)
      }
      
      // Cmd+Enter 或 Ctrl+Enter 提交表单
      if (open && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if ((content.trim() || files.length > 0) && !isUploading) {
          handleSubmit()
        }
      }
      
      // Escape 关闭对话框
      if (open && e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }

    const handlePaste = async (e: ClipboardEvent) => {
      // 只在对话框打开时处理粘贴事件
      if (!open) return

      const items = e.clipboardData?.items
      if (!items) return

      const newPreviews: FilePreview[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // 处理图片
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file && validateFileSize(file)) {
            const preview = URL.createObjectURL(file)
            newPreviews.push({ file, preview })
          }
        }
        // 处理文件
        else if (item.kind === 'file') {
          e.preventDefault()
          const file = item.getAsFile()
          if (file && validateFileSize(file)) {
            newPreviews.push({ file, preview: "" })
          }
        }
      }

      if (newPreviews.length > 0) {
        setFiles((prev) => [...prev, ...newPreviews])
        toast({
          title: t('toast.filesAdded.title'),
          description: t('toast.filesAdded.description', { count: newPreviews.length }),
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('paste', handlePaste)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('paste', handlePaste)
    }
  }, [open, content, files, isUploading, toast, validateFileSize])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const newPreviews: FilePreview[] = []

    selectedFiles.forEach((file) => {
      if (!validateFileSize(file)) {
        return // Skip files that exceed size limit
      }

      if (file.type.startsWith("image/")) {
        const preview = URL.createObjectURL(file)
        newPreviews.push({ file, preview })
      } else {
        newPreviews.push({ file, preview: "" })
      }
    })

    if (newPreviews.length > 0) {
      setFiles((prev) => [...prev, ...newPreviews])
      // Show warning if some files were rejected
      if (newPreviews.length < selectedFiles.length) {
        toast({
          title: t('toast.partialFiles.title'),
          description: t('toast.partialFiles.description', {
            added: newPreviews.length,
            total: selectedFiles.length,
          }),
          variant: "destructive",
        })
      }
    }

    // Reset input so same files can be selected again if needed
    e.target.value = ''
  }, [toast, validateFileSize])

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev]
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    const newPreviews: FilePreview[] = []

    droppedFiles.forEach((file) => {
      if (!validateFileSize(file)) {
        return // Skip files that exceed size limit
      }

      if (file.type.startsWith("image/")) {
        const preview = URL.createObjectURL(file)
        newPreviews.push({ file, preview })
      } else {
        newPreviews.push({ file, preview: "" })
      }
    })

    if (newPreviews.length > 0) {
      setFiles((prev) => [...prev, ...newPreviews])
      // Show warning if some files were rejected
      if (newPreviews.length < droppedFiles.length) {
        toast({
          title: t('toast.partialFiles.title'),
          description: t('toast.partialFiles.description', {
            added: newPreviews.length,
            total: droppedFiles.length,
          }),
          variant: "destructive",
        })
      }
    }
  }, [toast, validateFileSize])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleSubmit = async () => {
    if (!content.trim() && files.length === 0) {
      toast({
        title: t('toast.empty.title'),
        description: t('toast.empty.description'),
        variant: "destructive",
      })
      return
    }

    // Validate all files before submitting
    const oversizedFiles = files.filter(fp => fp.file.size > MAX_FILE_SIZE)
    if (oversizedFiles.length > 0) {
      toast({
        title: t('toast.fileTooLarge.title'),
        description: t('toast.fileTooLarge.simpleDescription', {
          name: oversizedFiles[0].file.name,
          max: formatFileSize(MAX_FILE_SIZE),
        }),
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      if (files.length > 0) {
        // 创建 FormData
        const formData = new FormData()
        
        // 添加文本内容（如果有）
        if (content.trim()) {
          formData.append("content", content.trim())
        }
        
        // 添加所有文件
        files.forEach((filePreview) => {
          formData.append("files", filePreview.file)
        })

        // 使用多文件上传API
        const response = await inboxApi.uploadMultipleFiles(formData)

        if (!response.success) {
          const apiError = new Error(
            response.error || response.message || t('errors.uploadFailed')
          ) as ApiError
          apiError.code = response.code
          apiError.params = response.params
          throw apiError
        }
      } else if (content.trim()) {
        // 只有文本内容，没有文件
        const response = await inboxApi.createItem({
          content: content.trim(),
          contentType: ContentType.TEXT,
          source: "web",
        })

        if (!response.success) {
          const apiError = new Error(
            response.error || response.message || t('errors.createFailed')
          ) as ApiError
          apiError.code = response.code
          apiError.params = response.params
          throw apiError
        }
      }

      queryClient.invalidateQueries({ queryKey: ["inbox"] })
      toast({
        title: t('toast.success.title'),
        description: files.length > 0
          ? t('toast.success.withFiles', { count: files.length })
          : t('toast.success.processing'),
      })
      setOpen(false)
      setContent("")
      setFiles([])
    } catch (error: any) {
      toast({
        title: t('toast.failure.title'),
        description: getApiErrorMessage(error, errors, t('toast.failure.description')),
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const defaultTrigger = (
    <Button
      variant="outline"
      className="relative h-9 justify-start rounded-md bg-muted/50 text-sm font-normal text-muted-foreground shadow-none w-32 sm:w-40 md:w-48 lg:w-64 sm:pr-12"
    >
      <Plus className="mr-2 h-4 w-4 shrink-0" />
      <span className="hidden sm:inline-flex">{t('trigger.full')}</span>
      <span className="inline-flex sm:hidden">{t('trigger.short')}</span>
      <div className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden items-center gap-1 sm:flex">
        <kbd className="inline-flex h-5 w-5 select-none items-center justify-center rounded border bg-background font-mono text-base font-medium opacity-100 shadow-sm">
          ⌘
        </kbd>
        <kbd className="inline-flex h-5 w-5 select-none items-center justify-center rounded border bg-background font-mono text-xs font-medium opacity-100 shadow-sm">
          K
        </kbd>
      </div>
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Content Input */}
          <Textarea
            placeholder={t('placeholder')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px]"
            disabled={isUploading}
            autoFocus
          />

          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors"
          >
            <input
              type="file"
              id="file-upload"
              multiple
              accept="image/*,.pdf,.txt,.md,.zip,audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t('upload.instructions')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('upload.supported')}
              </span>
            </label>
          </div>
        </div>

        {/* File Previews - Outside upload area */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t('selectedFiles', { count: files.length })}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t('actions.clearAll')}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {files.map((filePreview, index) => (
                <div
                  key={index}
                  className="relative group border rounded-lg overflow-hidden bg-muted/30"
                >
                  {filePreview.preview ? (
                    <img
                      src={filePreview.preview}
                      alt={filePreview.file.name}
                      className="w-full h-20 object-cover"
                    />
                  ) : (
                    <div className="w-full h-20 flex items-center justify-center">
                      <File className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-xs p-1">
                    <div className="truncate" title={filePreview.file.name}>
                      {filePreview.file.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {formatFileSize(filePreview.file.size)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium shadow-sm">
                Esc
              </kbd>
              <span>{t('hints.close')}</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium shadow-sm">
                ⌘
              </kbd>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium shadow-sm">
                ↵
              </kbd>
              <span>{t('hints.submit')}</span>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
              {common('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isUploading} className="flex-1 sm:flex-none">
              {isUploading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  {common('processing')}
                </>
              ) : (
                t('actions.submit')
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
