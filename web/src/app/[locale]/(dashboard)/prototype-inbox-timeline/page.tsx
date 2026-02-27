'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CalendarDays,
    CheckCircle2,
    MessageSquare,
    FileText,
    CornerDownRight,
    ChevronDown,
    Trash2,
    RefreshCw,
    MoreVertical,
    Link2,
    Inbox
} from 'lucide-react'

// Mock Data
const ITEMS = [
    {
        id: 'p1',
        type: 'parent',
        content: "今天真的是累瘫了，早上地铁还停运，迟到了半小时被老板说了。中午和市场部开了个很长的会，敲定了下半年的预算分配。对了，会议纪要得在明天下午 3 点前发给所有人。然后周末得把之前屯着的那几套极简 UI 的课给刷了。",
        time: "2 hours ago",
        category: 'note',
        children: [
            {
                id: 'c1',
                content: "发送下半年预算分配会议纪要",
                category: 'todo',
                route: "Todoist (Work)",
                status: 'completed',
                highlight: "会议纪要得在明天下午 3 点前发给所有人"
            },
            {
                id: 'c2',
                content: "刷极简 UI 课程",
                category: 'todo',
                route: "Notion",
                status: 'pending',
                highlight: "周末得把之前屯着的那几套极简 UI 的课给刷了"
            }
        ]
    },
    {
        id: 'p2',
        type: 'parent',
        content: "刚刚刷到一篇讲 Cursor 怎么和本地大语言模型协同的教程，感觉很有料。晚点得好好看一下，尝试把本地的 Llama 3 接入进去。链接是 https://example.com/cursor-local-llm",
        time: "4 hours ago",
        category: 'bookmark',
        children: [
            {
                id: 'c3',
                content: "阅读: Cursor 协同本地大语言模型教程",
                category: 'todo',
                route: "Todoist (Reading List)",
                status: 'pending',
                highlight: "晚点得好好看一下"
            },
            {
                id: 'c4',
                content: "https://example.com/cursor-local-llm",
                category: 'bookmark',
                route: "Raindrop.io",
                status: 'success',
                highlight: "链接是 https://example.com/..."
            }
        ]
    }
]

export default function CombinedTimelinePrototype() {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['p1']))

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setExpandedIds(next)
    }

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 min-h-screen bg-slate-50/50 dark:bg-slate-950/20">

            <div className="mb-8 space-y-2 px-2">
                <div className="flex items-center gap-2">
                    <Inbox className="h-6 w-6 text-slate-700 dark:text-slate-300" />
                    <h1 className="text-3xl font-bold tracking-tight">Timeline View (Inbox)</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    A prototype of the main SuperInbox timeline, showing how Parent Notes ("Memory") and extracted Child Tasks ("Intents") elegantly coexist.
                </p>
            </div>

            <div className="space-y-6">
                {ITEMS.map((item) => {
                    const isExpanded = expandedIds.has(item.id)
                    const allCompleted = item.children.every(c => c.status === 'completed' || c.status === 'success')

                    return (
                        <div key={item.id} className="relative group">
                            {/* Vertical connector line for visual grouping */}
                            <div className="absolute left-[39px] top-[70px] bottom-6 w-px bg-border max-w-[1px] -z-10 opacity-60" />

                            {/* PARENT CARD (The Journal/Memory) */}
                            <motion.div
                                layout
                                className={\`relative z-10 flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-colors border-border dark:bg-background/90 \${
                                allCompleted ? 'opacity-80' : ''
                            }\`}
              >
                            {/* Header */}
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={\`inline-flex h-7 w-7 items-center justify-center rounded-lg \${
                                        item.category === 'bookmark' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-500/10 text-slate-500'
                                    }\`}>
                                    {item.category === 'bookmark' ? <Link2 className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                                </span>
                                <span className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">{item.category}</span>
                                <span className="text-[11px] font-medium text-slate-400">• {item.time}</span>
                            </div>

                            <button className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </div>

                {/* Content */ }
                    <div className="mb-4">
                        <p className="text-[16px] leading-[1.65] text-foreground font-medium">
                            {item.content}
                        </p>
                    </div>

                    {/* Extracted Intents Footer */ }
                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {item.children.slice(0, 3).map((child, i) => (
                        <div key={i} className={\`h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-card z-10 \${
                          child.category === 'todo' ? 'bg-blue-500/10' : 'bg-purple-500/10'
                        }\`}>
                          {child.category === 'todo' ? 
                            <CheckCircle2 className="h-2.5 w-2.5 text-blue-500" /> : 
                            <CalendarDays className="h-2.5 w-2.5 text-purple-500" />
                          }
                        </div>
                      ))}
                    </div>
                    <span className="text-[12px] font-medium text-slate-500">
                      {item.children.length} actions extracted
                      {allCompleted && <span className="text-emerald-500 ml-1">(All clear)</span>}
                    </span>
                  </div>

                  <button 
                    onClick={() => toggleExpand(item.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-[12px] font-semibold text-muted-foreground transition-colors"
                  >
                    {isExpanded ? 'Hide Actions' : 'Show Actions'}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </motion.div>
                  </button>
                </div>
        </motion.div>

              {/* CHILD ITEMS (The Actions) */ }
    <AnimatePresence>
        {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-12 pt-3 space-y-2.5 relative"
                  >
                    {item.children.map((child, idx) => (
                      <motion.div
                        key={child.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={\`relative flex flex-col gap-2 rounded-xl border bg-card/60 p-3 shadow-sm transition-all border-border backdrop-blur-sm hover:shadow-md \${
                          child.status === 'completed' ? 'opacity-60 bg-muted/30 grayscale hover:grayscale-0' : ''
                        }\`}
                      >
                         {/* Connector branch */}
                        <div className="absolute -left-6 top-6 h-px w-6 border-b-2 border-dashed border-border/60 -z-10" />

                        <div className="flex items-start justify-between gap-3">
                           <div className="flex items-center gap-3">
                              <button className={\`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 \${
                                child.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                              }\`}>
                                {child.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                              </button>

                              <div className="flex flex-col">
                                 <span className={\`text-[14px] font-semibold \${child.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}\`}>
                                   {child.content}
                                 </span>
                                 <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <CornerDownRight className="h-3 w-3 opacity-60" /> Sent to {child.route}
                                 </span>
                              </div>
                           </div>

                           <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                               <button className="p-1.5 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                                 <RefreshCw className="h-3.5 w-3.5" />
                               </button>
                               <button className="p-1.5 text-muted-foreground hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/40 rounded transition-colors">
                                 <Trash2 className="h-3.5 w-3.5" />
                               </button>
                           </div>
                        </div>

                      </motion.div >
                    ))
}
                  </motion.div >
                )}
              </AnimatePresence >
            </div >
          )
        })}
      </div >
      
    </div >
  )
}
