'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { Image, Paperclip, Mic, X, Loader2, Plus, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

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

      {/* 主输入框容器 */}
      {/* playground 风格：移动端收起时固定在右下角，展开时固定在底部 */}
      <div
        className={cn(
          "relative transition-all duration-500 z-10",
          // 展开时：移动端全屏遮罩 + 固定底部，桌面端正常（有最大宽度）
          isExpanded
            ? 'md:max-w-2xl md:mx-auto w-full fixed inset-0 bg-black/20 backdrop-blur-sm md:relative md:bg-transparent md:backdrop-blur-none p-4 md:p-0'
            : 'md:max-w-2xl md:mx-auto md:p-0 w-auto',
          // 收起时：移动端固定在右下角（使用 CSS media query）
          !isExpanded && 'fixed bottom-8 right-8 md:static md:bottom-auto md:right-auto'
        )}
      >
        <motion.div
          animate={{
            height: isExpanded ? 220 : 56,
            width: isExpanded ? '100%' : '100%',
            borderRadius: isExpanded ? 32 : 28,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30
          }}
          className={cn(
            'relative border overflow-hidden shadow-2xl cursor-text transition-colors flex flex-col mx-auto',
            isDark ? 'bg-[#12121a] border-white/[0.1]' : 'bg-white border-black/[0.08]',
            // 收起时：移动端圆形按钮（使用 CSS media query）
            !isExpanded && 'w-14 h-14 md:w-full md:h-auto'
          )}
          onClick={() => !isExpanded && setIsFocused(true)}
        >
          {/* 移动端收起状态：显示 + 图标 */}
          <div className="absolute inset-0 flex items-center justify-center md:hidden pointer-events-none">
            {!isExpanded && <Plus size={24} className="text-foreground" />}
          </div>

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
                'w-full h-full bg-transparent border-none outline-none resize-none no-scrollbar',
                'px-6 py-5 text-sm md:text-base',
                'text-foreground placeholder:opacity-30'
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
