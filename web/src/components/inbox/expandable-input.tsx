'use client'

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, Paperclip, Mic, X, Loader2, Plus, FileText, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useSidebar } from '@/components/ui/sidebar'
import { ImageGallery } from '@/components/inbox/image-gallery'

interface ExpandableInputProps {
  onSubmit: (content: string, files?: File[]) => void
  isSubmitting?: boolean
  dropTargetActive?: boolean
}

export interface ExpandableInputHandle {
  appendFiles: (files: File[]) => void
  focusComposer: () => void
  collapseComposerIfEmpty: () => void
}

type AnimationPhase = 'idle' | 'absorbing' | 'collapsing' | 'diving'

type UploadPreviewType = 'image' | 'video' | 'file'
const MOBILE_EXPANDED_HEIGHT = '50dvh'

interface SelectedUpload {
  file: File
  previewType: UploadPreviewType
  previewUrl?: string
}

const getUploadPreviewType = (file: File): UploadPreviewType => {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return 'file'
}

export const ExpandableInput = forwardRef<ExpandableInputHandle, ExpandableInputProps>(function ExpandableInput(
  {
    onSubmit,
    isSubmitting = false,
    dropTargetActive = false,
  },
  ref
) {
  const t = useTranslations('inbox')
  const common = useTranslations('common')
  const { toast } = useToast()
  const { resolvedTheme } = useTheme()

  // 避免 hydration mismatch：使用 mounted 状态
  const [mounted, setMounted] = useState(false)
  const isDark = mounted ? resolvedTheme === 'dark' : false

  useEffect(() => {
    setMounted(true)
  }, [resolvedTheme])

  // 自动展开：有内容、文件或聚焦时就展开
  const [content, setContent] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle')
  const [selectedFiles, setSelectedFiles] = useState<SelectedUpload[]>([])
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false)
  const hasInputContent = content.trim().length > 0
  const hasSelectedFiles = selectedFiles.length > 0
  const desktopExpanded = isFocused || hasInputContent || hasSelectedFiles
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const { openMobile } = useSidebar()
  const isExpanded = isMobile ? isMobilePanelOpen : desktopExpanded
  const [showFloatingButton, setShowFloatingButton] = useState(!isExpanded)
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const previousExpanded = useRef(isExpanded)
  const selectedFilesRef = useRef<SelectedUpload[]>([])

  const openInputPanel = useCallback(() => {
    setIsFocused(true)
    if (isMobile) {
      setIsMobilePanelOpen(true)
    }
  }, [isMobile])

  const focusComposerTextarea = useCallback((retryDelay = 120) => {
    const focusInput = () => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.focus()
      const cursorPosition = textarea.value.length
      try {
        textarea.setSelectionRange(cursorPosition, cursorPosition)
      } catch {
        // ignore selection errors for unsupported input methods
      }
    }

    requestAnimationFrame(() => {
      focusInput()
      if (retryDelay > 0) {
        setTimeout(focusInput, retryDelay)
      }
    })
  }, [])

  const closeInputPanel = useCallback(() => {
    setIsFocused(false)
    if (isMobile) {
      setIsMobilePanelOpen(false)
    }
  }, [isMobile])

  // 吸收动效提交 - 三阶段：absorbing -> collapsing -> diving
  const handleSubmit = useCallback(async () => {
    if (!content.trim() && selectedFiles.length === 0) {
      toast({
        title: common('error'),
        description: t('emptyContentError'),
        variant: 'destructive',
      })
      return
    }

    // 第一阶段：吸收 (400ms)
    setAnimationPhase('absorbing')
    await new Promise(resolve => setTimeout(resolve, 400))

    // 第二阶段：坍缩 (800ms) - 使用 SVG 十字形动画
    setAnimationPhase('collapsing')
    await new Promise(resolve => setTimeout(resolve, 800))

    // 第三阶段：潜入 (600ms)
    setAnimationPhase('diving')
    onSubmit(content, selectedFiles.map(({ file }) => file))

    await new Promise(resolve => setTimeout(resolve, 600))

    // 重置
    setContent('')
    setSelectedFiles((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl)
        }
      })
      return []
    })
    closeInputPanel()
    setAnimationPhase('idle')
  }, [content, selectedFiles, onSubmit, toast, common, t, closeInputPanel])

  const appendSelectedFiles = useCallback((files: File[]) => {
    if (files.length === 0) return

    const nextUploads: SelectedUpload[] = files.map((file) => {
      const previewType = getUploadPreviewType(file)
      return {
        file,
        previewType,
        previewUrl: previewType === 'image' || previewType === 'video'
          ? URL.createObjectURL(file)
          : undefined,
      }
    })

    setSelectedFiles((prev) => [...prev, ...nextUploads])
  }, [])

  // 处理文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    appendSelectedFiles(files)
    e.target.value = ''
  }, [appendSelectedFiles])

  useImperativeHandle(ref, () => ({
    appendFiles: (files: File[]) => {
      if (files.length === 0) return
      appendSelectedFiles(files)
      openInputPanel()
      focusComposerTextarea()
    },
    focusComposer: () => {
      openInputPanel()
      focusComposerTextarea()
    },
    collapseComposerIfEmpty: () => {
      if (content.trim().length > 0 || selectedFiles.length > 0) return
      closeInputPanel()
      textareaRef.current?.blur()
    },
  }), [appendSelectedFiles, openInputPanel, focusComposerTextarea, content, selectedFiles, closeInputPanel])

  // 移除已选文件
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => {
      const item = prev[index]
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  // 键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
    if (e.key === 'Escape' && isExpanded) {
      closeInputPanel()
    }
  }, [handleSubmit, isExpanded, closeInputPanel])

  const isCollapsing = animationPhase === 'collapsing'


  useEffect(() => {
    selectedFilesRef.current = selectedFiles
  }, [selectedFiles])

  useEffect(() => {
    return () => {
      selectedFilesRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl)
        }
      })
    }
  }, [])

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (!isMobile) {
      setShowFloatingButton(false)
      previousExpanded.current = isExpanded
      return
    }

    if (isExpanded) {
      setShowFloatingButton(false)
      previousExpanded.current = true
      return
    }

    if (previousExpanded.current) {
      setShowFloatingButton(false)
      closeTimerRef.current = setTimeout(() => {
        setShowFloatingButton(true)
      }, 180)
    } else {
      setShowFloatingButton(true)
    }

    previousExpanded.current = isExpanded
  }, [isExpanded, isMobile])

  useEffect(() => {
    if (!isExpanded) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeInputPanel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, closeInputPanel])

  const panelHeight = isExpanded ? 220 : 56
  const panelRadius = isExpanded ? 32 : 28
  const panelMotionProps = isMobile
    ? {
        initial: { opacity: 0, scale: 0.96, y: 12, height: 56, borderRadius: 28 },
        animate: { opacity: 1, scale: 1, y: 0, height: MOBILE_EXPANDED_HEIGHT, borderRadius: 32 },
        exit: { opacity: 0, scale: 0.98, y: 12, transition: { duration: 0.18, ease: 'easeOut' as const } },
        transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
      }
    : {
        initial: false,
        animate: { height: panelHeight, borderRadius: panelRadius },
        transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
      }

  return (
    <div className="relative w-full">
      {/* 移动端展开时的遮罩背景 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            onClick={closeInputPanel}
          />
        )}
      </AnimatePresence>

      {/* 坍缩阶段动画覆盖层 - 十字形 SVG */}
      <AnimatePresence>
        {isCollapsing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none",
              isDark ? 'bg-black/70' : 'bg-white/40'
            )}
          >
            <motion.div
              initial={{ scaleX: 1, scaleY: 1, opacity: 0 }}
              animate={{
                scaleY: [1.3, 0.02, 0.02],
                scaleX: [1.3, 1.3, 0],
                opacity: [0, 1, 1, 0]
              }}
              transition={{ duration: 0.8 }}
              className="relative flex items-center justify-center w-full"
            >
              <svg viewBox="0 0 100 100" className={cn("w-32 h-32", isDark ? 'text-white' : 'text-black')}>
                <path
                  d="M 50 0 C 50 35 65 50 100 50 C 65 50 50 65 50 100 C 50 65 35 50 0 50 C 35 50 50 35 50 0 Z"
                  fill="currentColor"
                />
              </svg>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 移动端悬浮按钮 */}
      <AnimatePresence>
        {showFloatingButton && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={() => {
              openInputPanel()
              if (isMobile) {
                focusComposerTextarea()
              }
            }}
            aria-label={t('captureButton')}
            className={cn(
              "fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] right-4 flex h-12 items-center gap-2 rounded-full px-4 md:hidden",
              openMobile ? 'z-30 opacity-0 pointer-events-none' : 'z-[60]',
              "ring-1 transition-all duration-200 active:scale-95",
              'border border-border bg-card text-foreground ring-ring/30 shadow-lg dark:border-white/20 dark:bg-popover/95 dark:backdrop-blur-md dark:shadow-[0_12px_30px_rgba(0,0,0,0.55)]'
            )}
          >
            <Plus size={16} strokeWidth={2.8} />
            <span className="text-xs font-semibold tracking-[0.02em]">{t('captureButton')}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* 主输入框容器 */}
      <AnimatePresence>
        {(!isMobile || isExpanded) && (
          <div
            className={cn(
              "relative transition-all duration-500 z-[60] md:z-10",
              isMobile
                ? 'fixed inset-0 w-full p-4 md:relative md:max-w-2xl md:mx-auto md:p-0'
                : 'md:max-w-2xl md:mx-auto md:p-0'
            )}
            onClick={() => {
              if (isMobile) {
                closeInputPanel()
              }
            }}
          >
            <motion.div
              {...panelMotionProps}
              data-drop-target="compose"
              className={cn(
                'relative border overflow-hidden shadow-2xl cursor-text transition-colors flex flex-col mx-auto w-full',
                isMobile && isDark
                  ? 'bg-popover/95 border-white/15 backdrop-blur-xl shadow-[0_24px_56px_rgba(0,0,0,0.55)]'
                  : 'bg-card border-border',
                dropTargetActive && 'border-ring/50'
              )}
              onClick={(event) => {
                if (isExpanded) {
                  event.stopPropagation()
                  return
                }
                openInputPanel()
              }}
            >

          {/* 输入区域 */}
          <div
            className={cn(
              "flex-1 min-h-0 relative transition-opacity duration-300 h-full",
              !isExpanded && 'opacity-0 md:opacity-100'
            )}
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={openInputPanel}
              onBlur={() => {
                if (!isMobile && !hasInputContent && !hasSelectedFiles) {
                  setIsFocused(false)
                }
              }}
              placeholder={t('inputPlaceholderExpanded') || "捕捉此时此刻的灵感..."}
              className={cn(
                'w-full h-full bg-transparent border-none outline-none resize-none no-scrollbar block',
                'px-6 text-sm md:text-base',
                'text-foreground placeholder:opacity-40',
                // 单行时垂直居中，多行时正常
                'py-[15px] leading-[22px] placeholder:leading-[22px]'
              )}
            />
          </div>

          {/* 展开状态：文件标签行（独立于工具栏） */}
          <AnimatePresence initial={false}>
            {isExpanded && hasSelectedFiles && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="shrink-0 px-5 pb-3"
              >
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pr-1">
                  {selectedFiles.map((entry, index) => {
                    const isPreviewableImage = entry.previewType === 'image' && Boolean(entry.previewUrl)

                    const fileChip = (
                      <div
                        className={cn(
                          'group flex h-9 min-w-[180px] max-w-[230px] items-center gap-2 rounded-lg bg-accent/60 px-1.5 pr-2 text-xs',
                          isPreviewableImage && 'cursor-zoom-in'
                        )}
                      >
                        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md bg-background/70">
                          {entry.previewType === 'image' && entry.previewUrl ? (
                            <Image
                              src={entry.previewUrl}
                              alt={entry.file.name}
                              width={28}
                              height={28}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : entry.previewType === 'video' && entry.previewUrl ? (
                            <>
                              <video
                                src={entry.previewUrl}
                                preload="metadata"
                                muted
                                playsInline
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white/85">
                                <Play className="h-3 w-3 fill-current" />
                              </span>
                            </>
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <FileText className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>

                        <span className="min-w-0 flex-1 truncate">{entry.file.name}</span>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            removeFile(index)
                          }}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )

                    return (
                      <motion.div
                        key={`${entry.file.name}-${index}`}
                        initial={{ scale: 0.94, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.94, opacity: 0 }}
                        className="relative shrink-0"
                      >
                        {isPreviewableImage && entry.previewUrl ? (
                          <ImageGallery
                            images={[
                              {
                                id: `composer-image-${index}`,
                                src: entry.previewUrl,
                                alt: entry.file.name,
                              },
                            ]}
                            layout="thumb"
                            renderTrigger={(openPreview) => (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => openPreview()}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    openPreview()
                                  }
                                }}
                                className="outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
                              >
                                {fileChip}
                              </div>
                            )}
                          />
                        ) : (
                          fileChip
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 展开状态：底部工具栏 */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="shrink-0 p-5 pt-0 flex items-center justify-between z-20"
              >
                {/* 左侧工具按钮 - playground 风格：简化版 */}
                <div className="flex items-center gap-1 opacity-70">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); imageInputRef.current?.click() }}
                    className="p-2 rounded-lg transition-all hover:opacity-100"
                  >
                    <ImageIcon size={18} />
                  </button>
                  <span className="w-4" />
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click() }}
                    className="p-2 rounded-lg transition-all hover:opacity-100"
                  >
                    <Paperclip size={18} />
                  </button>
                  <span className="w-4" />
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); toast({ title: t('voiceComingSoon'), channel: 'development' }) }}
                    className="p-2 rounded-lg transition-all hover:opacity-100"
                  >
                    <Mic size={18} />
                  </button>
                </div>

                {/* 右侧 Capture 按钮 - playground 风格 */}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSubmit() }}
                  disabled={!hasInputContent && !hasSelectedFiles}
                  aria-label={t('captureButton')}
                  className={cn(
                    'px-6 py-2 rounded-2xl text-[11px] font-semibold tracking-[0.03em]',
                    'flex items-center justify-center transition-all',
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                    'disabled:opacity-30 disabled:cursor-not-allowed'
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-center">{t('captureButton')}</span>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 隐藏的文件输入 */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 提示文字 - playground 风格：仅展开时显示 */}
      {isExpanded && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-[10px] text-muted-foreground/60 mt-2"
        >
          {t('inputHint') || 'Cmd + Enter to capture · Escape to collapse'}
        </motion.p>
      )}
    </div>
  )
})
