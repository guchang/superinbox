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
    RefreshCw,
    Plus,
    Trash2,
    Pencil,
    Bot,
    BrainCircuit,
    CornerDownRight
} from 'lucide-react'

type ExtractedIntent = {
    id: string
    content: string
    category: 'schedule' | 'todo' | 'idea' | 'expense' | 'note'
    highlight: string
    status: 'active' | 'deleted' | 'edited'
}

export default function IntentCorrectionPrototype() {
    const [isEditing, setIsEditing] = useState(true)
    const [isTraining, setIsTraining] = useState(false)

    const rawText = "昨天和老王吃饭花了 358，记得报销。然后他说他那个出海的项目现在遇到点增长瓶颈，可能是本地化没做好。周末有空帮他引荐一下李总。"

    const [intents, setIntents] = useState<ExtractedIntent[]>([
        {
            id: 'i1',
            content: "和老王吃饭 - 358元",
            category: 'expense',
            highlight: "花了 358，记得报销",
            status: 'active'
        },
        {
            id: 'i2',
            content: "老王出海项目遇到增长瓶颈 (本地化问题)",
            category: 'note',
            highlight: "出海的项目现在遇到点增长瓶颈，可能是本地化没做好",
            status: 'active'
        },
        {
            id: 'i3',
            content: "帮老王引荐李总",
            category: 'todo',
            highlight: "帮他引荐一下李总",
            status: 'active'
        }
    ])

    const handleTrainAI = () => {
        setIsTraining(true)
        setTimeout(() => {
            setIsTraining(false)
            setIsEditing(false)
        }, 1500)
    }

    const handleDelete = (id: string) => {
        setIntents(intents.map(i => i.id === id ? { ...i, status: 'deleted' } : i))
    }

    const handleRestore = (id: string) => {
        setIntents(intents.map(i => i.id === id ? { ...i, status: 'active' } : i))
    }

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-8 min-h-screen">

            <div className="mb-8 space-y-2">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="h-6 w-6 text-indigo-500" />
                    <h1 className="text-3xl font-bold tracking-tight">AI Intent Correction & Training</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    A prototype showing how users can intervene, correct AI extractions, and train the model for future personalization.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left Column: Raw Memory & Selection */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Original Memory</h2>
                        <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">Immutable</span>
                    </div>

                    <div className="rounded-2xl border bg-card p-6 shadow-sm border-border dark:bg-background/80 relative overflow-hidden">
                        {/* Decorative Quotes */}
                        <div className="absolute top-2 left-2 text-6xl text-slate-100 dark:text-slate-800 opacity-50 select-none font-serif leading-none">"</div>

                        <p className="text-[17px] font-medium leading-[1.8] text-foreground relative z-10 selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-100">
                            昨天和老王吃饭<span className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-b border-orange-500/20">花了 358，记得报销</span>。然后他说他那个<span className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-b border-slate-500/20">出海的项目现在遇到点增长瓶颈，可能是本地化没做好</span>。周末有空<span className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-b border-blue-500/20">帮他引荐一下李总</span>。
                        </p>

                        {isEditing && (
                            <div className="mt-6 pt-4 border-t border-dashed border-border flex items-center justify-between">
                                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                                    Tip: Highlight text above to manually extract a new intent
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: AI Extraction Results & Editing */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Bot className="h-4 w-4" /> 2. Extracted Intents
                        </h2>
                        {isEditing && (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                        )}
                    </div>

                    <div className="space-y-3 relative">
                        {/* Connection Guide Line */}
                        <div className="absolute -left-6 top-6 bottom-6 w-px border-l-2 border-dashed border-border/60 -z-10 hidden lg:block" />

                        <AnimatePresence>
                            {intents.map((intent, idx) => (
                                <motion.div
                                    key={intent.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: intent.status === 'deleted' ? 0.4 : 1, scale: 1 }}
                                    className={`relative flex flex-col gap-3 rounded-xl border bg-card/60 p-4 shadow-sm border-border backdrop-blur-sm transition-all ${intent.status === 'deleted' ? 'grayscale' : ''}`}
                                >
                                    <div className="absolute -left-[1.6rem] top-1/2 w-6 border-b-2 border-dashed border-border/60 -z-10 hidden lg:block" />

                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${intent.category === 'expense' ? 'bg-orange-500/10 text-orange-500' :
                                                    intent.category === 'todo' ? 'bg-blue-500/10 text-blue-500' :
                                                        'bg-slate-500/10 text-slate-500'
                                                }`}>
                                                {intent.category === 'expense' && <FileText className="h-4 w-4" />}
                                                {intent.category === 'todo' && <CheckCircle2 className="h-4 w-4" />}
                                                {intent.category === 'note' && <MessageSquare className="h-4 w-4" />}
                                            </div>

                                            {isEditing && intent.status !== 'deleted' ? (
                                                <div className="flex flex-col gap-1">
                                                    <select
                                                        defaultValue={intent.category}
                                                        className="text-[10px] font-bold uppercase bg-transparent text-muted-foreground outline-none cursor-pointer hover:text-foreground"
                                                    >
                                                        <option value="expense">EXPENSE</option>
                                                        <option value="todo">TODO</option>
                                                        <option value="schedule">SCHEDULE</option>
                                                        <option value="note">NOTE</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        defaultValue={intent.content}
                                                        className="bg-transparent text-sm font-semibold text-foreground outline-none border-b border-dashed border-border/50 focus:border-indigo-500 w-full"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className={`text-[10px] font-bold uppercase ${intent.category === 'expense' ? 'text-orange-500' :
                                                            intent.category === 'todo' ? 'text-blue-500' :
                                                                'text-slate-500'
                                                        }`}>{intent.category}</span>
                                                    <span className={`text-sm font-semibold ${intent.status === 'deleted' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                                        {intent.content}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {isEditing && (
                                            <div className="flex shrink-0 items-center gap-1">
                                                {intent.status === 'deleted' ? (
                                                    <button onClick={() => handleRestore(intent.id)} className="p-1.5 text-muted-foreground hover:bg-slate-100 rounded-md">
                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleDelete(intent.id)} className="p-1.5 text-muted-foreground hover:bg-rose-50 rounded-md hover:text-rose-500">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {isEditing && intent.status !== 'deleted' && (
                                        <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground">
                                            <CornerDownRight className="h-3 w-3 opacity-50" />
                                            <span className="truncate italic opacity-80">"{intent.highlight}"</span>
                                        </div>
                                    )}
                                </motion.div>
                            ))
                            }
                        </AnimatePresence >

                        {isEditing && (
                            <button className="w-full py-3 rounded-xl border-2 border-dashed border-border/60 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-sm font-medium text-muted-foreground hover:text-indigo-600 transition-colors flex items-center justify-center gap-2">
                                <Plus className="h-4 w-4" /> Add Missing Intent
                            </button>
                        )}
                    </div >

                </div >
            </div >

            {/* Action Bar */}
            {
                isEditing ? (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border shadow-xl rounded-full p-2 flex items-center gap-4 pl-6 z-50"
                    >
                        <div className="flex flex-col justify-center">
                            <span className="text-sm font-semibold">Review AI Extraction</span>
                            <span className="text-xs text-muted-foreground leading-none">Your edits will train the AI to better understand your style.</span>
                        </div>
                        <button
                            onClick={handleTrainAI}
                            disabled={isTraining}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full font-medium text-sm transition-all disabled:opacity-70 min-w-[140px] justify-center"
                        >
                            {isTraining ? (
                                <><RefreshCw className="h-4 w-4 animate-spin" /> Training...</>
                            ) : (
                                <><BrainCircuit className="h-4 w-4" /> Save & Train AI</>
                            )}
                        </button>
                    </motion.div>
                ) : (
                    <div className="flex justify-center mt-12">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                        >
                            <Pencil className="h-3.5 w-3.5" /> Return to Edit Mode
                        </button>
                    </div>
                )
            }

        </div >
    )
}
