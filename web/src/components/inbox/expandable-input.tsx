'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { Image, Paperclip, Mic, X, Loader2, Plus, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-is-mobile'

interface ExpandableInputProps {
  onSubmit: (content: string, files?: File[]) => void
  isSubmitting?: boolean
}

type AnimationPhase = 'idle' | 'absorbing' | 'collapsing' | 'diving'

export function ExpandableInput({ onSubmit, isSubmitting = false }: ExpandableInputProps) {
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

  // 自动展开：有内容或聚焦时就展开
  const [content, setContent] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const isExpanded = isFocused || content.trim().length > 0

  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const [showFloatingButton, setShowFloatingButton] = useState(!isExpanded)
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const previousExpanded = useRef(isExpanded)

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
    onSubmit(content, selectedFiles)

    await new Promise(resolve => setTimeout(resolve, 600))

    // 重置
    setContent('')
    setSelectedFiles([])
    setIsFocused(false)
    setAnimationPhase('idle')
  }, [content, selectedFiles, onSubmit, toast, common, t])

  // 处理文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files])
      toast({
        title: t('fileSelected'),
        description: files.map(f => f.name).join(', '),
      })
    }
    e.target.value = ''
  }, [toast, t])

  // 移除已选文件
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  // 键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
    if (e.key === 'Escape' && isExpanded) {
      setIsFocused(false)
    }
  }, [handleSubmit, isExpanded])

  const isAnimating = animationPhase !== 'idle'
  const isCollapsing = animationPhase === 'collapsing'

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
        setIsFocused(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  const panelHeight = isExpanded ? 220 : 56
  const panelRadius = isExpanded ? 32 : 28
  const panelMotionProps = isMobile
    ? {
        initial: { opacity: 0, scale: 0.96, y: 12, height: 56, borderRadius: 28 },
        animate: { opacity: 1, scale: 1, y: 0, height: 220, borderRadius: 32 },
        exit: { opacity: 0, scale: 0.98, y: 12, transition: { duration: 0.18, ease: 'easeOut' } },
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
            onClick={() => setIsFocused(false)}
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
            onClick={() => setIsFocused(true)}
            className={cn(
              "fixed bottom-8 right-8 z-[60] h-14 w-14 rounded-full shadow-2xl flex items-center justify-center md:hidden",
              isDark ? 'bg-[#12121a] text-white' : 'bg-white text-black'
            )}
          >
            <Plus size={24} />
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
                setIsFocused(false)
              }
            }}
          >
            <motion.div
              {...panelMotionProps}
              className={cn(
                'relative border overflow-hidden shadow-2xl cursor-text transition-colors flex flex-col mx-auto w-full',
                isDark ? 'bg-[#12121a] border-white/[0.1]' : 'bg-white border-black/[0.08]'
              )}
              onClick={(event) => {
                if (isExpanded) {
                  event.stopPropagation()
                  return
                }
                setIsFocused(true)
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
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                // 仅当没有内容时才失去焦点收起
                if (!content.trim()) {
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
                <div className="flex items-center gap-1 opacity-40">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); imageInputRef.current?.click() }}
                    className="p-2 rounded-lg transition-all hover:opacity-100"
                  >
                    <Image size={18} />
                  </button>
                  <span className="w-4" />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click() }}
                    className="p-2 rounded-lg transition-all hover:opacity-100"
                  >
                    <Paperclip size={18} />
                  </button>
                  <span className="w-4" />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); toast({ title: t('voiceComingSoon') }) }}
                    className="p-2 rounded-lg transition-all hover:opacity-100"
                  >
                    <Mic size={18} />
                  </button>

                  {/* 已选文件预览 */}
                  {selectedFiles.length > 0 && (
                    <div className="flex items-center gap-1 ml-2">
                      {selectedFiles.map((file, index) => (
                        <motion.div
                          key={index}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="relative group"
                        >
                          <div className="h-8 px-2 rounded-lg bg-accent/50 flex items-center gap-1 text-xs">
                            <span className="truncate max-w-[60px]">{file.name}</span>
                            <button
                              onClick={() => removeFile(index)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 右侧 Capture 按钮 - playground 风格 */}
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleSubmit() }}
                  disabled={!content.trim() && selectedFiles.length === 0}
                  className={cn(
                    'px-6 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest',
                    'flex items-center gap-1 transition-all',
                    isDark ? 'bg-white text-black hover:bg-white/90' : 'bg-black text-white hover:bg-black/90',
                    'disabled:opacity-30 disabled:cursor-not-allowed'
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Capture
                      <ChevronRight size={14} className="inline ml-1" />
                    </>
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
            onChange={(e) => handleFileSelect(e, 'image')}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'file')}
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
}
