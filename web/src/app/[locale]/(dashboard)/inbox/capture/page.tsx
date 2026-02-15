"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { AnimatePresence, motion } from "framer-motion"
import { Link } from "@/i18n/navigation"
import { inboxApi } from "@/lib/api/inbox"
import { formatRelativeTime } from "@/lib/utils"
import { getApiErrorMessage, type ApiError } from "@/lib/i18n/api-errors"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FilePreview } from "@/components/file-preview"
import { CategoryType, ContentType, ItemStatus, type Item } from "@/types"
import {
  Check,
  Eye,
  FileText,
  GitBranch,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  Video,
  X,
  Zap,
} from "lucide-react"

interface FilePreviewState {
  file: File
  preview: string
}

const MAX_FILE_SIZE = 100 * 1024 * 1024
const MESSAGE_LIMIT = 10
const COLLAPSE_DURATION_MS = 800
const ROUTING_DOT_ANIMATION = { opacity: [0.1, 0.6, 0.1], scale: [0.8, 1, 0.8] }

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function InboxCapturePage() {
  const t = useTranslations("capture")
  const tDetail = useTranslations("inboxDetail")
  const tInbox = useTranslations("inbox")
  const common = useTranslations("common")
  const time = useTranslations("time")
  const errors = useTranslations("errors")
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [content, setContent] = useState("")
  const [files, setFiles] = useState<FilePreviewState[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isCollapsing, setIsCollapsing] = useState(false)
  const [shouldScroll, setShouldScroll] = useState(false)
  const [lastRenderedId, setLastRenderedId] = useState<string | null>(null)
  const [initialScrollDone, setInitialScrollDone] = useState(false)

  const listEndRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<FilePreviewState[]>([])

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["inbox", "capture"],
    queryFn: () =>
      inboxApi.getItems({
        limit: MESSAGE_LIMIT,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  })

  const orderedItems = useMemo(() => {
    const items = itemsData?.data?.items ?? []
    return [...items].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      return aTime - bTime
    })
  }, [itemsData])

  useLayoutEffect(() => {
    if (!shouldScroll || orderedItems.length === 0) return
    const latestId = orderedItems[orderedItems.length - 1]?.id
    if (!latestId || latestId === lastRenderedId) return

    const timeout = setTimeout(() => {
      const composerHeight = composerRef.current?.getBoundingClientRect().height ?? 0
      if (listEndRef.current) {
        listEndRef.current.style.scrollMarginBottom = `${composerHeight + 50}px`
      }
      listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      setLastRenderedId(latestId)
      setShouldScroll(false)
    }, 200)

    return () => clearTimeout(timeout)
  }, [orderedItems, shouldScroll, lastRenderedId])

  useEffect(() => {
    if (initialScrollDone || isLoading || orderedItems.length === 0) return
    setShouldScroll(true)
    setInitialScrollDone(true)
  }, [orderedItems.length, isLoading, initialScrollDone])

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    return () => {
      filesRef.current.forEach((filePreview) => {
        if (filePreview.preview) {
          URL.revokeObjectURL(filePreview.preview)
        }
      })
    }
  }, [])

  const validateFileSize = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: t("toast.fileTooLarge.title"),
        description: t("toast.fileTooLarge.description", {
          name: file.name,
          max: formatFileSize(MAX_FILE_SIZE),
        }),
        variant: "destructive",
      })
      return false
    }
    return true
  }

  const appendFiles = (nextFiles: File[]) => {
    const nextPreviews: FilePreviewState[] = []
    nextFiles.forEach((file) => {
      if (!validateFileSize(file)) return
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
      nextPreviews.push({ file, preview })
    })
    if (nextPreviews.length > 0) {
      setFiles((prev) => [...prev, ...nextPreviews])
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    appendFiles(selected)
    event.target.value = ""
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(event.dataTransfer.files)
    appendFiles(dropped)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items
    if (!items) return
    const pastedFiles: File[] = []
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (item.type.startsWith("image/") || item.kind === "file") {
        const file = item.getAsFile()
        if (file) {
          pastedFiles.push(file)
        }
      }
    }
    if (pastedFiles.length > 0) {
      event.preventDefault()
      appendFiles(pastedFiles)
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview)
      }
      return next
    })
  }

  const clearFiles = () => {
    files.forEach((filePreview) => {
      if (filePreview.preview) {
        URL.revokeObjectURL(filePreview.preview)
      }
    })
    setFiles([])
  }

  const triggerFilePicker = () => {
    fileInputRef.current?.click()
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true)

      if (files.length > 0) {
        const formData = new FormData()
        if (content.trim()) {
          formData.append("content", content.trim())
        }
        files.forEach((filePreview) => {
          formData.append("files", filePreview.file)
        })
        const response = await inboxApi.uploadMultipleFiles(formData)
        if (!response.success) {
          const apiError = new Error(
            response.error || response.message || t("toast.failure.description")
          ) as ApiError
          apiError.code = response.code
          apiError.params = response.params
          throw apiError
        }
        return
      }

      const response = await inboxApi.createItem({
        content: content.trim(),
        contentType: ContentType.TEXT,
        source: "web",
      })

      if (!response.success) {
        const apiError = new Error(
          response.error || response.message || t("toast.failure.description")
        ) as ApiError
        apiError.code = response.code
        apiError.params = response.params
        throw apiError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] })
      toast({
        title: t("toast.success.title"),
        description:
          files.length > 0
            ? t("toast.success.withFiles", { count: files.length })
            : t("toast.success.processing"),
      })
      setContent("")
      clearFiles()
      setShouldScroll(true)
    },
    onError: (error: unknown) => {
      toast({
        title: t("toast.failure.title"),
        description: getApiErrorMessage(error, errors, t("toast.failure.description")),
        variant: "destructive",
      })
    },
    onSettled: () => {
      setIsUploading(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (item: Item) => {
      setSavingId(item.id)
      const response = await inboxApi.updateItem(item.id, { content: editingValue.trim() })
      if (!response.success) {
        const apiError = new Error(
          response.error || response.message || t("toast.updateFailure.title")
        ) as ApiError
        apiError.code = response.code
        apiError.params = response.params
        throw apiError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] })
      toast({
        title: t("toast.updateSuccess.title"),
        description: t("toast.updateSuccess.description"),
      })
      setEditingId(null)
      setEditingValue("")
    },
    onError: (error: unknown) => {
      toast({
        title: t("toast.updateFailure.title"),
        description: getApiErrorMessage(error, errors, t("toast.updateFailure.description")),
        variant: "destructive",
      })
    },
    onSettled: () => {
      setSavingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await inboxApi.deleteItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] })
      queryClient.invalidateQueries({ queryKey: ["inbox-counts"] })
      toast({
        title: tInbox("toast.deleteSuccess.title"),
        description: tInbox("toast.deleteSuccess.description"),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: tInbox("toast.deleteFailure.title"),
        description: getApiErrorMessage(error, errors, common("unknownError")),
        variant: "destructive",
      })
    },
  })

  const handleSubmit = async () => {
    if (isUploading || isCollapsing) {
      return
    }
    if (!content.trim() && files.length === 0) {
      toast({
        title: t("toast.empty.title"),
        description: t("toast.empty.description"),
        variant: "destructive",
      })
      return
    }

    if (!isCollapsing) {
      setIsCollapsing(true)
      setTimeout(() => setIsCollapsing(false), COLLAPSE_DURATION_MS)
    }

    await createMutation.mutateAsync()
  }

  const handleDelete = async (id: string) => {
    if (confirm(tInbox("confirmDelete"))) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleMicClick = () => {
    toast({
      title: t("toast.micPending.title"),
      description: t("toast.micPending.description"),
    })
  }

  const getTypeMeta = (contentType: ContentType) => {
    const map = {
      [ContentType.TEXT]: {
        label: t("types.text"),
        icon: Zap,
        container: "bg-muted text-muted-foreground",
      },
      [ContentType.URL]: {
        label: t("types.url"),
        icon: Globe,
        container: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      },
      [ContentType.IMAGE]: {
        label: t("types.image"),
        icon: ImageIcon,
        container: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
      [ContentType.AUDIO]: {
        label: t("types.audio"),
        icon: Mic,
        container: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      },
      [ContentType.VIDEO]: {
        label: t("types.video"),
        icon: Video,
        container: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      },
      [ContentType.FILE]: {
        label: t("types.file"),
        icon: FileText,
        container: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      },
    }
    return map[contentType] ?? map[ContentType.TEXT]
  }

  const getIntentLabel = (item: Item) => {
    const category = item.analysis?.category
    if (!category) return t("status.synced")

    const map: Record<string, string> = {
      [CategoryType.TODO]: tInbox("badge.todo"),
      [CategoryType.IDEA]: tInbox("badge.idea"),
      [CategoryType.EXPENSE]: tInbox("badge.expense"),
      [CategoryType.NOTE]: tInbox("badge.note"),
      [CategoryType.BOOKMARK]: tInbox("badge.bookmark"),
      [CategoryType.SCHEDULE]: tInbox("badge.schedule"),
      [CategoryType.UNKNOWN]: tInbox("badge.unknown"),
    }

    return map[category] ?? String(category).toUpperCase()
  }

  const getCategoryMeta = (item: Item) => {
    if (item.status === ItemStatus.PROCESSING) {
      return { label: t("status.analyzing"), className: "text-amber-600 dark:text-amber-400" }
    }
    if (item.status === ItemStatus.MANUAL) {
      return { label: tDetail("status.manual"), className: "text-amber-600 dark:text-amber-400" }
    }
    if (item.status === ItemStatus.FAILED) {
      return { label: tDetail("status.failed"), className: "text-destructive" }
    }
    if (item.status === ItemStatus.PENDING) {
      return { label: tDetail("status.pending"), className: "text-blue-600 dark:text-blue-400" }
    }

    return { label: getIntentLabel(item), className: "text-emerald-600 dark:text-emerald-400" }
  }

  const getRoutingMeta = (item: Item) => {
    const ruleNames = item.distributedRuleNames || []
    const targets = item.distributedTargets || []

    if (ruleNames.length > 0) {
      return {
        label: tInbox("routingStatus.distributedWithRules", { rules: ruleNames.join(", ") }),
        className: "text-emerald-600 dark:text-emerald-400",
        showDots: false,
      }
    }

    if (targets.length > 0) {
      return {
        label: tInbox("routeDistributed", { count: targets.length }),
        className: "text-emerald-600 dark:text-emerald-400",
        showDots: false,
      }
    }

    switch (item.routingStatus) {
      case "processing":
        return {
          label: tInbox("routingStatus.processing"),
          className: "text-blue-600 dark:text-blue-400",
          showDots: true,
        }
      case "pending":
        return {
          label: tInbox("routingStatus.pending"),
          className: "text-blue-600 dark:text-blue-400",
          showDots: true,
        }
      case "failed":
        return {
          label: tInbox("routingStatus.failed"),
          className: "text-destructive",
          showDots: false,
        }
      case "completed":
        return {
          label: tInbox("routingStatus.completed"),
          className: "text-emerald-600 dark:text-emerald-400",
          showDots: false,
        }
      case "skipped":
        return {
          label: tInbox("routingStatus.skipped"),
          className: "text-muted-foreground",
          showDots: false,
        }
      default:
        return {
          label: t("routing.unconfigured"),
          className: "text-muted-foreground",
          showDots: false,
        }
    }
  }

  return (
    <div className="relative flex w-full flex-col gap-6 px-6 pb-4 sm:px-8">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 capture-grid" />
        <div className="absolute inset-0 capture-grid-fade" />
      </div>
      <div className="relative z-10 px-1 sm:px-0">
        {isLoading ? (
          <div className="flex items-center justify-center rounded-xl border bg-card/80 p-8 text-sm text-muted-foreground backdrop-blur">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {common("loading")}
          </div>
        ) : orderedItems.length === 0 ? (
          <div className="rounded-xl border bg-card/80 p-10 text-center backdrop-blur">
            <p className="text-sm font-medium">{t("empty.title")}</p>
            <p className="mt-2 text-xs text-muted-foreground">{t("empty.description")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {orderedItems.map((item, index) => {
                const isEditing = editingId === item.id
                const isSaving = savingId === item.id
                const contentClassName =
                  item.contentType === ContentType.URL ? "break-all" : "break-words"
                const typeMeta = getTypeMeta(item.contentType)
                const categoryMeta = getCategoryMeta(item)
                const routingMeta = getRoutingMeta(item)
                const TypeIcon = typeMeta.icon
                const entryDelay = Math.min(index, 6) * 0.05

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: item.status === ItemStatus.COMPLETED ? 1 : 1,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      delay: entryDelay,
                    }}
                    className="group flex gap-4"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${typeMeta.container}`}
                    >
                      <TypeIcon className={item.status === ItemStatus.PROCESSING ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                          {item.source.toUpperCase()}
                        </span>
                      </div>

                      <div className="relative overflow-hidden rounded-2xl rounded-tl-none border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-card dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/60 via-white/10 to-transparent opacity-20 dark:from-white/10 dark:via-white/5" />
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingValue}
                              onChange={(event) => setEditingValue(event.target.value)}
                              className="min-h-[96px]"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingId(null)
                                  setEditingValue("")
                                }}
                                disabled={isSaving}
                              >
                                {t("actions.cancel")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => updateMutation.mutate(item)}
                                disabled={!editingValue.trim() || isSaving}
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    {common("processing")}
                                  </>
                                ) : (
                                  <>
                                    <Check className="mr-1 h-3 w-3" />
                                    {t("actions.save")}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-sm leading-relaxed text-foreground ${contentClassName}`}>
                            {item.content}
                          </p>
                        )}

                        {item.hasFile && (
                          <div className="mt-3">
                            <FilePreview
                              itemId={item.id}
                              fileName={item.fileName}
                              mimeType={item.mimeType}
                              allFiles={item.allFiles}
                            />
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em]">
                          <span className={categoryMeta.className}>{categoryMeta.label}</span>
                          <span className={`flex items-center gap-2 ${routingMeta.className}`}>
                            <GitBranch className="h-3 w-3" />
                            <span className="truncate">{routingMeta.label}</span>
                            {routingMeta.showDots && (
                              <span className="flex items-center gap-1">
                                {Array.from({ length: 6 }).map((_, dotIndex) => (
                                  <motion.span
                                    key={`${item.id}-dot-${dotIndex}`}
                                    className="h-1 w-1 rounded-full bg-current"
                                    animate={ROUTING_DOT_ANIMATION}
                                    transition={{
                                      duration: 1.2,
                                      repeat: Infinity,
                                      delay: dotIndex * 0.1,
                                      ease: "easeInOut",
                                    }}
                                  />
                                ))}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => {
                            setEditingId(item.id)
                            setEditingValue(item.content)
                          }}
                          disabled={item.status === ItemStatus.PROCESSING}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          {t("actions.edit")}
                        </Button>
                        <Link href={`/inbox/${item.id}`}>
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-2">
                            <Eye className="mr-1 h-3 w-3" />
                            {t("actions.view")}
                          </Button>
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          {t("actions.delete")}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      <div
        ref={composerRef}
        className={`glass-panel sticky bottom-4 z-20 rounded-2xl shadow-[0_26px_80px_rgba(15,23,42,0.14)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.55)] ${
          isDragging ? "border-primary/60 bg-primary/5" : ""
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
      >
        <div className="relative">
          <AnimatePresence>
            {isCollapsing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur"
              >
                <motion.div
                  initial={{ scaleX: 1, scaleY: 1, opacity: 0 }}
                  animate={{
                    scaleY: [1.3, 0.02, 0.02],
                    scaleX: [1.3, 1.3, 0],
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: 0.8,
                    times: [0, 0.7, 0.9, 1],
                    ease: [0.19, 1, 0.22, 1],
                  }}
                  className="relative flex w-full items-center justify-center"
                >
                  <div className="relative flex h-16 w-40 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
                    <div className="h-10 w-10 rounded-full border border-primary/40" />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={t("placeholder")}
            className="min-h-[110px] resize-none border-none bg-transparent px-4 py-4 shadow-none focus-visible:ring-0"
            disabled={isUploading}
          />
        </div>

        {files.length > 0 && (
          <div className="px-4 pb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("files.selected", { count: files.length })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={clearFiles}
                disabled={isUploading}
              >
                {t("files.clear")}
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {files.map((filePreview, index) => (
                <div
                  key={`${filePreview.file.name}-${index}`}
                  className="flex min-w-[180px] items-center gap-2 rounded-lg border bg-muted/40 px-2 py-2"
                >
                  {filePreview.preview ? (
                    <Image
                      src={filePreview.preview}
                      alt={filePreview.file.name}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{filePreview.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatFileSize(filePreview.file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeFile(index)}
                    disabled={isUploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-black/5 px-4 py-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.zip,audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={triggerFilePicker}
              disabled={isUploading}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={triggerFilePicker}
              disabled={isUploading}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={triggerFilePicker}
              disabled={isUploading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleMicClick}
              disabled={isUploading}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <span className="ml-2">{t("composer.hint")}</span>
          </div>
          <Button
            type="button"
            className="h-9"
            onClick={handleSubmit}
            disabled={isUploading || isCollapsing}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {common("processing")}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t("actions.send")}
              </>
            )}
          </Button>
        </div>
      </div>

    </div>
  )
}
