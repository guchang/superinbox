"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import { CommandSearch, type SearchFilters } from "./command-search"
import { INBOX_OPEN_SEARCH_EVENT } from '@/lib/constants/ui-events'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

interface SearchDialogProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  availableSources?: string[]
  availableCategories?: Array<{ key: string; name: string }>
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SearchDialog({
  filters,
  onFiltersChange,
  availableSources = [],
  availableCategories = [],
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SearchDialogProps) {
  const t = useTranslations('commandSearch')
  const [internalOpen, setInternalOpen] = React.useState(false)

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen

  // 全局键盘快捷键
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "/" && !open) {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, setOpen])

  React.useEffect(() => {
    const handleOpenSearch = () => setOpen(true)
    window.addEventListener(INBOX_OPEN_SEARCH_EVENT, handleOpenSearch)
    return () => window.removeEventListener(INBOX_OPEN_SEARCH_EVENT, handleOpenSearch)
  }, [setOpen])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        overlayClassName="bg-transparent"
        className="max-w-3xl w-[92vw] p-0 overflow-hidden rounded-[28px] sm:rounded-[28px] border border-black/[0.08] bg-white text-slate-900 shadow-2xl dark:border-white/[0.1] dark:bg-[#12121a] dark:text-white [&>button]:hidden"
      >
        <DialogTitle className="sr-only">{t('title') || 'Search'}</DialogTitle>
        <CommandSearch
          filters={filters}
          onFiltersChange={onFiltersChange}
          availableSources={availableSources}
          availableCategories={availableCategories}
          variant="dialog"
        />
      </DialogContent>
    </Dialog>
  )
}

// 触发按钮组件
interface SearchTriggerProps {
  onClick?: () => void
  collapsed?: boolean
}

export function SearchTrigger({ onClick, collapsed }: SearchTriggerProps) {
  const t = useTranslations('commandSearch')

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group",
        "text-foreground/80 opacity-60 hover:opacity-100 hover:bg-current/5",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? t('title') : undefined}
    >
      <div className="p-1.5 rounded-lg transition-colors">
        <Search className="h-4 w-4 stroke-2" />
      </div>
      {!collapsed && (
        <span className="text-sm tracking-tight">{t('title')}</span>
      )}
    </button>
  )
}
