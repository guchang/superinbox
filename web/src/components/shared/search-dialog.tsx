"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import { CommandSearch, type SearchFilters } from "./command-search"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {t('title') || 'Search'}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {t('description') || 'Search your memories by keywords, category, status, and more.'}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-8 w-8"
            >
              ✕
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6">
          <CommandSearch
            filters={filters}
            onFiltersChange={onFiltersChange}
            availableSources={availableSources}
            availableCategories={availableCategories}
          />
        </div>
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
