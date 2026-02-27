'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Mic,
    Image as ImageIcon,
    Paperclip,
    Send,
    Sparkles,
    Command,
    Globe,
    FileText,
    StopCircle,
    Clock
} from 'lucide-react'

export default function UniversalQuickCapturePrototype() {
    const [isOpen, setIsOpen] = useState(true)
    const [inputValue, setInputValue] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Auto-focus on mount
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isOpen])

    // Mock recording timer
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)
        } else {
            setRecordingTime(0)
        }
        return () => clearInterval(interval)
    }, [isRecording])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (inputValue.trim()) {
        // Mock submission
        setInputValue('')
        setIsOpen(false)
        setTimeout(() => setIsOpen(true), 1500) // Reopen for demo looping
      }
    }
    if (e.key === 'Escape') {
      setInputValue('')
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false)
      setInputValue(prev => prev + (prev ? ' ' : '') + "刚刚开会讨论的下半年预算方案，主要是削减了营销频道的预算约 20%，增加到了研发部门的算力采购上。这个方案明天下班前得整理出一个清晰的表格发给财务。")
    } else {
      setIsRecording(true)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background decoration to simulate a blurred desktop/workspace */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      {!isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-semibold text-white">Thought Captured</h2>
          <p className="text-slate-400">Processing via AI and routing to destinations...</p>
        </motion.div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-2xl relative z-10"
          >
            {/* The Omni-Bar Container */}
            <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 shadow-2xl shadow-black/50 overflow-hidden rounded-[24px] flex flex-col transition-all duration-300 ring-1 ring-white/10 group focus-within:ring-white/20 focus-within:border-slate-600/50">
              
              {/* Header/Context indicators */}
              <div className="px-5 pt-4 pb-2 flex items-center justify-between opacity-60">
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 tracking-wider uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>SuperInbox Omni-Capture</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                  Press <kbd className="font-sans px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700">ESC</kbd> to clear
                </div>
              </div>

              {/* Main Input Area */}
              <div className="relative px-5 py-3">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? "Listening..." : "What's on your mind? (Any thoughts, tasks, or links)"}
                  className={`w-full bg-transparent border-none outline-none resize-none text-xl sm:text-2xl text-slate-100 placeholder:text-slate-600 font-medium leading-relaxed transition-all ${
                    inputValue.length > 50 ? 'h-32' : 'h-14'
                  }`}
                  style={{ minHeight: '56px' }}
                />

                {/* Live Transcript / AI Preview (Subtle) */}
                {inputValue.length > 10 && !isRecording && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="absolute bottom-3 right-5 pointer-events-none"
                  >
                     <span className="text-xs text-indigo-400 font-medium bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
                       AI is resolving intents...
                     </span>
                  </motion.div>
                )}
              </div>

              {/* Action Bar (Bottom Tools) */}
              <div className="px-3 py-3 bg-slate-800/30 border-t border-slate-700/50 flex items-center justify-between">
                
                {/* Left: Input Modes */}
                <div className="flex items-center gap-1.5">
                  {isRecording ? (
                    <motion.button 
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      onClick={toggleRecording}
                      className="flex items-center gap-2 h-9 px-3 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                    >
                      <motion.div 
                        animate={{ opacity: [1, 0.5, 1] }} 
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-rose-500"
                      />
                      <span className="text-sm font-medium font-mono">{formatTime(recordingTime)}</span>
                      <StopCircle className="w-4 h-4 ml-1" />
                    </motion.button>
                  ) : (
                    <button 
                      onClick={toggleRecording}
                      className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                      title="Voice Memo"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  )}

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
                    <ImageIcon className="w-4.5 h-4.5" />
                  </button>
                  <button className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
                    <Paperclip className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Right: Submit Button & Hint */}
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                    <Command className="w-3 h-3" />
                    <span>+</span>
                    <span>Enter</span>
                    <span className="ml-1">to super-send</span>
                  </div>
                  
                  <button 
                    onClick={() => {
                        if(inputValue.trim()) {
                            setInputValue('')
                            setIsOpen(false)
                            setTimeout(() => setIsOpen(true), 1500)
                        }
                    }}
                    disabled={!inputValue.trim() && !isRecording}
                    className={`h-9 px-4 rounded-full flex items-center gap-2 text-sm font-semibold transition-all ${
                      inputValue.trim() || isRecording
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span>Drop</span>
                    <CornerDownLeftIcon className="w-4 h-4 opacity-70" />
                  </button>
                </div>

              </div>
            </div>

            {/* Simulated Suggestions / Quick Actions (Appears below) */}
            <AnimatePresence>
              {!inputValue && !isRecording && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 px-2"
                >
                  <QuickAction title="Jot a note" icon={<FileText className="w-4 h-4 text-emerald-400" />} />
                  <QuickAction title="Save a link" icon={<Globe className="w-4 h-4 text-blue-400" />} />
                  <QuickAction title="Set reminder" icon={<Clock className="w-4 h-4 text-purple-400" />} />
                  <QuickAction title="Record memo" icon={<Mic className="w-4 h-4 text-rose-400" />} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function QuickAction({ title, icon }: { title: string, icon: React.ReactNode }) {
  return (
    <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 hover:bg-slate-800/80 hover:border-slate-600/50 transition-all text-slate-300 group">
      <div className="p-2 rounded-full bg-slate-900 shadow-inner group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-[11px] font-medium">{title}</span>
    </button>
  )
}

function CornerDownLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  )
}
