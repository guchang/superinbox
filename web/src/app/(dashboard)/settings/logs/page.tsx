'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowLeftToLine, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { getAccessLogs } from '@/lib/api/logs'
import { useLogFilters } from '@/lib/hooks/use-log-filters'
import { useAuth } from '@/lib/hooks/use-auth'
import { LogTable } from '@/components/logs/LogTable'
import { LogFilters } from '@/components/logs/LogFilters'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function GlobalLogsPage() {
  const { authState } = useAuth()
  const { filters, dateRange, updateFilter, resetFilters } = useLogFilters()

  // Show loading while checking auth
  if (authState.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  // Debug: Log auth state to help diagnose permission issues
  console.log('[GlobalLogsPage] Auth state:', {
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    hasUser: !!authState.user,
    user: authState.user ? {
      id: authState.user.id,
      username: authState.user.username,
      email: authState.user.email,
      role: authState.user.role,
    } : null,
  })

  // Permission check
  if (!authState.user || authState.user.role !== 'admin') {
    console.log('[GlobalLogsPage] Permission check failed:', {
      hasUser: !!authState.user,
      role: authState.user?.role,
    })
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>权限不足</AlertTitle>
        <AlertDescription>
          您需要管理员权限才能访问此页面
        </AlertDescription>
      </Alert>
    )
  }

  // Fetch log data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['logs', 'global', filters, dateRange],
    queryFn: () => getAccessLogs({
      ...filters,
      ...dateRange,
    }),
  })

  const logs = data?.data || []
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">访问日志审计</h1>
          <p className="text-muted-foreground">
            查看和分析所有 API Key 的访问记录
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/settings/statistics">
              📊 查看统计
            </Link>
          </Button>
          <Button>
            📥 导出日志
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : '未知错误'}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => refetch()}
            >
              重新加载
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <LogFilters
        filters={filters}
        onUpdate={updateFilter}
        onReset={resetFilters}
      />

      {/* Logs table */}
      <LogTable
        logs={logs}
        total={total}
        page={filters.page}
        pageSize={filters.pageSize}
        loading={isLoading}
        onPageChange={(page) => updateFilter('page', page)}
        onPageSizeChange={(pageSize) => updateFilter('pageSize', pageSize)}
        isGlobalView={true}
      />
    </div>
  )
}
