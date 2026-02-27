'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CalendarDays,
    CheckCircle2,
    GitBranch,
    Bot,
    Send,
    AlertCircle,
    RefreshCw,
    LogOut,
    ChevronRight,
    Database,
    Globe
} from 'lucide-react'

export default function RoutingTracePrototype() {
    const [retryId, setRetryId] = useState<string | null>(null)

    const handleRetry = (id: string) => {
        setRetryId(id)
        setTimeout(() => setRetryId(null), 2000)
    }

    const routes = [
        {
            id: 'r1',
            childContent: "7:00 AM - Kickoff 会议",
            category: 'schedule',
            connector: 'Google Calendar API',
            status: 'success',
            logs: ["Resolved target: gcal-prod", "Sent POST /events", "Returned 200 OK"],
            time: "10:24:02 AM",
            iconColor: 'text-purple-500'
        },
        {
            id: 'r2',
            childContent: "9:00 AM - 和 HRBP 聊人事变动",
            category: 'schedule',
            connector: 'Google Calendar API',
            status: 'success',
            logs: ["Resolved target: gcal-prod", "Sent POST /events", "Returned 200 OK"],
            time: "10:24:03 AM",
            iconColor: 'text-purple-500'
        },
        {
            id: 'r3',
            childContent: "下班接儿子去山姆买零食",
            category: 'todo',
            connector: 'Todoist MCP Agent',
            status: 'failed',
            logs: ["Resolved target: todoist-mcp", "Connected to MCP stdio", "Error: MCP Server timeout after 3000ms"],
            time: "10:24:06 AM",
            iconColor: 'text-blue-500'
        },
        {
            id: 'r4',
            childContent: "周末看电影 (周五查片单)",
            category: 'todo',
            connector: 'Notion MCP Agent',
            status: 'success',
            logs: ["Resolved target: notion-mcp", "Appended to block_id: a1b2c3d4", "Success"],
            time: "10:24:08 AM",
            iconColor: 'text-blue-500'
        }
    ]

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-10 min-h-screen">

            <div className="mb-10 space-y-2">
                <div className="flex items-center gap-2">
                    <GitBranch className="h-6 w-6 text-emerald-500" />
                    <h1 className="text-3xl font-bold tracking-tight">Multi-Target Routing Trace</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    A prototype showing how individual extracted intents are routed to independent third-party services and MCP agents.
                </p>
            </div>

            <div className="relative">
                <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-border to-transparent -z-10" />

                <div className="space-y-8">
                    {routes.map((route, index) => (
                        <motion.div
                            key={route.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.15 }}
                            className="relative flex gap-6"
                        >
                            {/* Timeline dot */}
                            <div className="flex flex-col items-center shrink-0 mt-1">
                                <div className={`flex h-[46px] w-[46px] items-center justify-center rounded-full border-[3px] border-background ${
                                    route.status === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                } shadow-md`}>
                                {route.status === 'success' ? <Send className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            </div>
                        </div>

              {/* Card */ }
                        < div className = {`flex-1 flex flex-col rounded-2xl border bg-card p-5 shadow-sm border-border dark:bg-background/80 ${
                        route.status === 'failed' ? 'ring-1 ring-rose-500/30' : ''
                    }`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <Database className="h-3.5 w-3.5" />
                                Payload (Child Item)
                            </div>
                            <p className="text-[15px] font-medium text-foreground">{route.childContent}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{route.time}</span>
                    </div>

                    <div className="mt-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-border/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-slate-500" />
                                <span className="text-sm font-semibold text-foreground">{route.connector}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {route.status === 'failed' ? (
                                    <span className="text-xs font-bold text-rose-500 uppercase tracking-widest px-2 py-0.5 bg-rose-500/10 rounded">Failed</span>
                                ) : (
                                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 rounded">200 OK</span>
                                )}
                            </div>
                        </div>

                        <div className="font-mono text-[11px] text-muted-foreground space-y-1 p-3 bg-card border border-border/50 rounded-lg">
                            {route.logs.map((log, i) => (
                                <div key={i} className={`flex items-start gap-2 ${log.includes("Error") ? 'text-rose-500 font-semibold' : ''}`}>
                            <span className="opacity-50 select-none">{'>'}</span>
                            <span>{log}</span>
                        </div>
                      ))}
                    </div>

                    {route.status === 'failed' && (
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => handleRetry(route.id)}
                                disabled={retryId === route.id}
                                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:text-rose-400 rounded-lg transition-colors"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${retryId === route.id ? 'animate-spin' : ''}`} />
                                {retryId === route.id ? 'Retrying Connection...' : 'Retry Dispatch for this Intent'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    ))
}
        </div >
      </div >
      
    </div >
  )
}
