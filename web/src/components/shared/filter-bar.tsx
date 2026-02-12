import * as React from 'react'

import { cn } from '@/lib/utils'

export function DashboardFilterBar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    />
  )
}

export interface FilterPillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function FilterPillButton({
  className,
  active = false,
  ...props
}: FilterPillButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'whitespace-nowrap rounded-xl px-3 py-1.5 text-[10px] font-semibold transition-all md:px-4 md:py-2 md:text-[11px]',
        active
          ? 'bg-black text-white dark:bg-white dark:text-black'
          : 'bg-black/5 opacity-40 hover:opacity-100 dark:bg-white/5',
        className
      )}
      {...props}
    />
  )
}
