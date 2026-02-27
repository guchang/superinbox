'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Layers,
  Workflow,
  Inbox,
  Wand2,
  ArrowRight
} from 'lucide-react'

const PROTOTYPES = [
  {
    id: 'quick-capture',
    title: 'Universal Quick Capture',
    description: '全局无压输入捕获。仿 Spotlight/Raycast 的极速录入体验，支持文本、语音等混合模态。',
    path: '/prototype-quick-capture',
    icon: <Wand2 className="w-5 h-5 text-emerald-500" />,
    color: 'bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20'
  },
  {
    id: 'intent-extraction',
    title: 'Intent Extraction (AI 意图拆解)',
    description: '展示如何将用户的原话（Memory）拆解成一个个结构化的原子意图（Intent）。',
    path: '/prototype-intent-extraction',
    icon: <Sparkles className="w-5 h-5 text-blue-500" />,
    color: 'bg-blue-500/10 border-blue-500/20 group-hover:bg-blue-500/20'
  },
  {
    id: 'intent-correction',
    title: 'AI Correction & Human Training',
    description: '用户如何对 AI 提取出的结构化意图进行人工纠偏、删除和重新训练。',
    path: '/prototype-intent-correction',
    icon: <Layers className="w-5 h-5 text-indigo-500" />,
    color: 'bg-indigo-500/10 border-indigo-500/20 group-hover:bg-indigo-500/20'
  },
  {
    id: 'routing-trace',
    title: 'Routing Trace (流转溯源)',
    description: '可视化展示提取出的意图如何被独立路由并分发到特定的第三方服务，以及追踪执行状态。',
    path: '/prototype-routing-trace',
    icon: <Workflow className="w-5 h-5 text-amber-500" />,
    color: 'bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20'
  },
  {
    id: 'inbox-timeline',
    title: 'Inbox Timeline (主时间线)',
    description: '收件箱核心视图。展示 Parent 原始输入和 Child 结构化动作如如何在信息流中优雅共存。',
    path: '/prototype-inbox-timeline',
    icon: <Inbox className="w-5 h-5 text-purple-500" />,
    color: 'bg-purple-500/10 border-purple-500/20 group-hover:bg-purple-500/20'
  }
]

export default function PrototypesIndexPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header Section */}
        <div className="space-y-4 text-center md:text-left">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            SuperInbox Prototypes
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl">
            A sandbox collection of high-fidelity functional UI prototypes exploring the "Two-Layer (Raw Memory + Structured Intent) Architecture" product philosophy.
          </p>
        </div>

        {/* Prototypes Grid */}
        <div className="grid gap-6 md:grid-cols-2 pt-4">
          {PROTOTYPES.map((proto, index) => (
            <motion.div
              key={proto.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={proto.path} className="block group">
                <div className="relative h-full flex flex-col p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">

                  {/* Icon & Title */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={\`shrink-0 p-3 rounded-2xl border transition-colors \${proto.color}\`}>
                    {proto.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {proto.title}
                    </h2>
                    <div className="flex items-center gap-1 mt-1 text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                      <span>View Prototype</span>
                      <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="mt-auto">
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-500">
                    {proto.description}
                  </p>
                </div>
              </div>
            </Link>
            </motion.div>
          ))}
      </div>

    </div>
    </div >
  )
}
