'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { getApiKeyLogs } from '@/lib/api/logs'
import { useLogFilters } from '@/lib/hooks/use-log-filters'
import { useAuth } from '@/lib/hooks/use-auth'
import { LogTable } from '@/components/logs/LogTable'
import { LogFilters } from '@/components/logs/LogFilters'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

export default function ApiKeyLogsPage() {
  const t = useTranslations('apiKeyLogs')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const locale = useLocale()
  const params = useParams()
  const keyId = params.id as string
  const { authState } = useAuth()
  const { filters, dateRange, updateFilter, resetFilters } = useLogFilters()

  const isAdmin = Boolean(authState.user?.scopes?.includes('admin:full'))
  const canQuery = !authState.isLoading && isAdmin && Boolean(keyId)

  const { data: apiKey } = useQuery({
    queryKey: ['apiKey', keyId],
    queryFn: async () => {
      const { getApiKey } = await import('@/lib/api/api-keys')
      return getApiKey(keyId)
    },
    enabled: canQuery,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['logs', 'apiKey', keyId, filters, dateRange],
    queryFn: () =>
      getApiKeyLogs(keyId, {
        ...filters,
        ...dateRange,
      }),
    enabled: canQuery,
  })

  if (authState.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{common('loading')}</div>
      </div>
    )
  }

  if (!isAdmin) {
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
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <Link
          href="/settings/api-keys"
          className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="text-2xl font-bold mb-2">
          {apiKey?.name || t('unnamed')}
        </div>
        <div className="flex gap-6 text-sm opacity-90">
          <span>{t('keyLabel', { key: apiKey?.keyPreview || 'N/A' })}</span>
          <span>•</span>
          <span>
            {t('createdAt', {
              date: apiKey?.createdAt
                ? new Intl.DateTimeFormat(locale).format(new Date(apiKey.createdAt))
                : 'N/A',
            })}
          </span>
          <span>•</span>
          <span>{t('totalCalls', { count: total.toLocaleString() })}</span>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
            {t('actions.viewStats')}
          </Button>
          <Button variant="outline" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
            {t('actions.editKey')}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{common('loadFailure.title')}</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(error, errors, common('unknownError'))}
          </AlertDescription>
        </Alert>
      )}

      <LogFilters
        filters={filters}
        onUpdate={updateFilter}
        onReset={resetFilters}
      />

      <LogTable
        logs={logs}
        total={total}
        page={filters.page}
        pageSize={filters.pageSize}
        loading={isLoading}
        onPageChange={(page) => updateFilter('page', page)}
        onPageSizeChange={(pageSize) => updateFilter('pageSize', pageSize)}
        isGlobalView={false}
      />
    </div>
  )
}
