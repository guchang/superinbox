'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Lightbulb,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Bot
} from 'lucide-react'

// Mock Data Types
type MockItem = {
  id: string
  content: string
  category: 'note' | 'schedule' | 'todo' | 'idea'
  status: 'completed' | 'pending' | 'failed'
  destination?: string
  color: string
}

// Mock Data for the Demo
const PARENT_ITEM = {
  id: 'p1',
  content: "明天 7 点开 kickoff 会议，9 点和 HRBP 聊人事变动，\n晚上下班要去接儿子，然后带他一起去山姆买零食，\n这周末要一起看部电影，具体看哪部电影周五晚上查一下。",
  category: 'note' as const,
  color: '#64748b',
  timestamp: 'Just now'
}

const EXTRACTED_CHILDREN: MockItem[] = [
  {
    id: 'c1',
    content: "7:00 AM - Kickoff 会议",
    category: 'schedule',
    status: 'completed',
    destination: 'Google Calendar',
    color: '#8b5cf6'
  },
  {
    id: 'c2',
    content: "9:00 AM - 和 HRBP 聊人事变动",
    category: 'schedule',
    status: 'completed',
    destination: 'Google Calendar',
    color: '#8b5cf6'
  },
  {
    id: 'c3',
    content: "下班接儿子去山姆买零食",
    category: 'todo',
    status: 'pending',
    destination: 'Todoist',
    color: '#3b82f6'
  },
  {
    id: 'c4',
    content: "周末看电影 (周五查片单)",
    category: 'todo',
    status: 'completed',
    destination: 'Todoist',
    color: '#3b82f6'
  }
]

function getIcon(category: string) {
  switch (category) {
    case 'schedule': return <CalendarDays className="h-4 w-4" />
    case 'todo': return <CheckCircle2 className="h-4 w-4" />
    case 'idea': return <Lightbulb className="h-4 w-4" />
    case 'note': return <MessageSquare className="h-4 w-4" />
    default: return <FileText className="h-4 w-4" />
  }
}

export default function TwoLayerPrototypePage() {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12 space-y-8 min-h-screen bg-slate-50 dark:bg-slate-950/50">
      
      <div className="mb-10 text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Parent-Child Architecture UI Prototype</h1>
        <p className="text-muted-foreground text-sm">
          A high-fidelity mockup demonstrating how complex raw inputs are preserved while AI extracts independent structured intents.
        </p>
      </div>

      <div className="relative group">
        {/* Connection Line to Children */}
        {isExpanded && (
          <div className="absolute left-[39px] top-[140px] bottom-10 w-px bg-border max-w-[1px] -z-10" />
        )}

        {/* 1. The Parent Card (Raw Memory Layer) */}
        <motion.div 
          layout
          className="relative z-10 flex min-h-[140px] flex-col rounded-2xl border bg-card p-5 shadow-sm border-border dark:bg-background/80"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                <MessageSquare className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold text-slate-500">Raw Input (Memory Layer)</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">{PARENT_ITEM.timestamp}</span>
          </div>

          <div className="flex-1 mb-5">
            <p className="text-[17px] font-medium leading-relaxed whitespace-pre-wrap text-foreground">
              {PARENT_ITEM.content}
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center ring-2 ring-card z-20">
                  <CalendarDays className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center ring-2 ring-card z-10">
                  <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <span className="text-[13px] font-medium text-slate-500">
                AI extracted <strong className="text-foreground">4 tasks</strong>
              </span>
            </div>
            
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              {isExpanded ? 'Hide Intents' : 'View Intents'}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </motion.div>
            </button>
          </div>
        </motion.div>

        {/* 2. The Child Cards (Structured Intent Layer) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pl-14 pt-4 space-y-3 relative overflow-visible"
            >
              {EXTRACTED_CHILDREN.map((child, index) => (
                <motion.div
                  key={child.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative flex items-center gap-4 rounded-xl border bg-card/60 p-3 shadow-sm border-border backdrop-blur-sm hover:bg-card/80 transition-colors"
                >
                  {/* Connector Curve */}
                  <div className="absolute -left-[1.35rem] top-1/2 h-px w-5 bg-border -z-10" />

                  {/* Icon */}
                  <div 
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${child.color}15`, color: child.color }}
                  >
                    {getIcon(child.category)}
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col justify-center min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: child.color }}>
                        {child.category}
                      </span>
                      <span className="text-muted-foreground text-[10px]">•</span>
                      <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                        Routed to {child.destination}
                        {child.status === 'completed' ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                      </span>
                    </div>
                    <p className="text-[14px] font-medium text-foreground truncate">
                      {child.content}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800 transition-colors">
                          <ChevronRight className="h-4 w-4" />
                      </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
    </div>
  )
}
