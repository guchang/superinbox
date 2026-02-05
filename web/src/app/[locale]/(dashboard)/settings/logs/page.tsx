'use client'

import { useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Download, BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getAccessLogs, getStatistics } from '@/lib/api/logs'
import { useLogFilters } from '@/lib/hooks/use-log-filters'
import { useAuth } from '@/lib/hooks/use-auth'
import { LogTable } from '@/components/logs/LogTable'
import { LogFilters } from '@/components/logs/LogFilters'
import { LogExportDialog } from '@/components/logs/LogExportDialog'
import { ApiStatisticsDialog } from '@/components/logs/ApiStatisticsDialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

function GlobalLogsPageContent() {
  const t = useTranslations('logs')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const { authState } = useAuth()
  const { filters, dateRange, updateFilter, resetFilters } = useLogFilters()
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [statisticsDialogOpen, setStatisticsDialogOpen] = useState(false)

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
        <div className="text-muted-foreground">{common('loading')}</div>
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
        <AlertTitle>{common('permissionDenied.title')}</AlertTitle>
        <AlertDescription>
          {common('permissionDenied.description')}
        </AlertDescription>
      </Alert>
    )
  }

  const logs = data?.data || []
  const total = data?.total || 0

  return (
    <div className="w-full space-y-6 px-4 md:px-6 py-6">
      {/* Page header */}
      <div className="flex items-center justify-end gap-2">
        <Button onClick={() => setStatisticsDialogOpen(true)} size="default" variant="outline">
          <BarChart3 className="mr-2 h-4 w-4" />
          {t('actions.statistics')}
        </Button>
        <Button onClick={() => setExportDialogOpen(true)} size="default">
          <Download className="mr-2 h-4 w-4" />
          {t('actions.export')}
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{common('loadFailure.title')}</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(error, errors, common('unknownError'))}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => refetch()}
            >
              {common('reload')}
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

      {/* Statistics dialog */}
      <ApiStatisticsDialog
        open={statisticsDialogOpen}
        onClose={() => setStatisticsDialogOpen(false)}
      />
    </div>
  )
}

// Wrap in Suspense boundary for SSR
export default function GlobalLogsPage() {
  const common = useTranslations('common')
  return (
    <Suspense fallback={<div className="p-6">{common('loading')}</div>}>
      <GlobalLogsPageContent />
    </Suspense>
  )
}
