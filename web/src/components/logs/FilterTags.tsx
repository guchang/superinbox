'use client'

import { useTranslations } from 'next-intl'
import type { LogFilters } from '@/types/logs'

interface FilterTagsProps {
  filters: LogFilters
  onRemove: (key: keyof LogFilters) => void
}

export function FilterTags({ filters, onRemove }: FilterTagsProps) {
  const t = useTranslations('logs')
  const tags = []

  if (filters.timeRange !== 'today') {
    const labels = {
      week: t('timeRange.week'),
      month: t('timeRange.month'),
      custom: t('timeRange.custom'),
    }
    tags.push({
      label: t('tags.time', {
        value: labels[filters.timeRange as keyof typeof labels] || filters.timeRange,
      }),
      key: 'timeRange' as const,
    })
  }

  if (filters.status && filters.status !== 'all') {
    const labels = {
      success: t('status.success'),
      error: t('status.error'),
      denied: t('status.denied'),
    }
    tags.push({
      label: t('tags.status', { value: labels[filters.status] || filters.status }),
      key: 'status' as const,
    })
  }

  if (filters.searchQuery) {
    tags.push({
      label: t('tags.search', { value: filters.searchQuery }),
      key: 'searchQuery' as const,
    })
  }

  if (filters.methods && filters.methods.length > 0) {
    tags.push({
      label: t('tags.methods', { value: filters.methods.join(', ') }),
      key: 'methods' as const,
    })
  }

  if (filters.ipAddress) {
    tags.push({
      label: t('tags.ip', { value: filters.ipAddress }),
      key: 'ipAddress' as const,
    })
  }

  if (tags.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-4 py-3 flex-wrap bg-muted/50 rounded-lg">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="inline-flex items-center gap-1 px-3 py-1 bg-white border rounded-md text-sm"
        >
          {tag.label}
          <button
            onClick={() => onRemove(tag.key)}
            className="text-muted-foreground hover:text-destructive"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}
