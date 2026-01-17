'use client'

import type { LogFilters } from '@/types/logs'

interface FilterTagsProps {
  filters: LogFilters
  onRemove: (key: keyof LogFilters) => void
}

export function FilterTags({ filters, onRemove }: FilterTagsProps) {
  const tags = []

  if (filters.timeRange !== 'today') {
    const labels = { week: '本周', month: '本月', custom: '自定义' }
    tags.push({
      label: `时间: ${labels[filters.timeRange as keyof typeof labels] || filters.timeRange}`,
      key: 'timeRange' as const,
    })
  }

  if (filters.status && filters.status !== 'all') {
    const labels = { success: '成功', error: '失败', denied: '拒绝' }
    tags.push({
      label: `状态: ${labels[filters.status] || filters.status}`,
      key: 'status' as const,
    })
  }

  if (filters.searchQuery) {
    tags.push({
      label: `搜索: ${filters.searchQuery}`,
      key: 'searchQuery' as const,
    })
  }

  if (filters.methods && filters.methods.length > 0) {
    tags.push({
      label: `方法: ${filters.methods.join(', ')}`,
      key: 'methods' as const,
    })
  }

  if (filters.ipAddress) {
    tags.push({
      label: `IP: ${filters.ipAddress}`,
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
