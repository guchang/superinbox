'use client'

import { Badge } from '@/components/ui/badge'
import type { LogStatus, HttpMethod } from '@/types/logs'

// HTTP method badge
export function MethodBadge({ method }: { method: HttpMethod }) {
  const variants = {
    GET: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    POST: 'bg-green-100 text-green-800 hover:bg-green-200',
    PUT: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
    DELETE: 'bg-red-100 text-red-800 hover:bg-red-200',
    PATCH: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  }

  return (
    <Badge className={variants[method] || 'bg-gray-100'} variant="secondary">
      {method}
    </Badge>
  )
}

// Status badge
export function StatusBadge({ status, statusCode }: { status: LogStatus; statusCode: number }) {
  const variants = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    denied: 'bg-yellow-100 text-yellow-800',
  }

  const labels = {
    success: '成功',
    error: '失败',
    denied: '拒绝',
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={variants[status]} variant="secondary">
        {labels[status]}
      </Badge>
      <span className="text-xs text-muted-foreground">{statusCode}</span>
    </div>
  )
}

// Latency badge
export function LatencyBadge({ duration }: { duration: number }) {
  const getColor = () => {
    if (duration < 100) return 'text-green-600'
    if (duration < 500) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <span className={`text-sm font-medium ${getColor()}`}>
      {duration}ms
    </span>
  )
}
