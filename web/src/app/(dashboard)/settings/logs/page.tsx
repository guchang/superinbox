'use client'

import { useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Download } from 'lucide-react'
import Link from 'next/link'
import { getAccessLogs } from '@/lib/api/logs'
import { useLogFilters } from '@/lib/hooks/use-log-filters'
import { useAuth } from '@/lib/hooks/use-auth'
import { LogTable } from '@/components/logs/LogTable'
import { LogFilters } from '@/components/logs/LogFilters'
import { LogExportDialog } from '@/components/logs/LogExportDialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

function GlobalLogsPageContent() {
  const { authState } = useAuth()
  const { filters, dateRange, updateFilter, resetFilters } = useLogFilters()
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  // All hooks must be called before any conditional returns
  const hasPermission = authState.user?.scopes?.includes('admin:full') ?? false

  // Fetch log data - always call useQuery, but only enable when authorized
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['logs', 'global', filters, dateRange],
    queryFn: () => getAccessLogs({
      ...filters,
      ...dateRange,
    }),
    enabled: hasPermission && !authState.isLoading,
  })

  // Debug: Log auth state to help diagnose permission issues
  console.log('[GlobalLogsPage] Auth state:', {
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    hasUser: !!authState.user,
    hasPermission,
    user: authState.user ? {
      id: authState.user.id,
      username: authState.user.username,
      email: authState.user.email,
      role: authState.user.role,
      scopes: authState.user.scopes,
    } : null,
  })

  // Show loading while checking auth
  if (authState.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  // Permission check - use scopes instead of role
  if (!hasPermission) {
    console.log('[GlobalLogsPage] Permission check failed:', {
      hasUser: !!authState.user,
      scopes: authState.user?.scopes,
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

  const logs = data?.data || []
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">访问日志审计</h1>
        </div>
        <Button onClick={() => setExportDialogOpen(true)} size="default">
          <Download className="mr-2 h-4 w-4" />
          导出日志
        </Button>
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

      {/* Export dialog */}
      <LogExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        filters={{ ...filters, ...dateRange }}
        logCount={total}
      />
    </div>
  )
}

// Wrap in Suspense boundary for SSR
export default function GlobalLogsPage() {
  return (
    <Suspense fallback={<div className="p-6">加载中...</div>}>
      <GlobalLogsPageContent />
    </Suspense>
  )
}
