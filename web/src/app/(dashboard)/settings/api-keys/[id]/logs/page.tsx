'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'next/navigation'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { getApiKeyLogs } from '@/lib/api/logs'
import { useLogFilters } from '@/lib/hooks/use-log-filters'
import { useAuth } from '@/lib/hooks/use-auth'
import { LogTable } from '@/components/logs/LogTable'
import { LogFilters } from '@/components/logs/LogFilters'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function ApiKeyLogsPage() {
  const params = useParams()
  const keyId = params.id as string
  const { authState } = useAuth()
  const { filters, dateRange, updateFilter, resetFilters } = useLogFilters()

  // Permission check
  if (!authState.user || !authState.user.scopes?.includes('admin:full')) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>权限不足</AlertTitle>
        <AlertDescription>
          您需要 admin:full 权限才能访问此页面
        </AlertDescription>
      </Alert>
    )
  }

  // Fetch API key info
  const { data: apiKey } = useQuery({
    queryKey: ['apiKey', keyId],
    queryFn: async () => {
      // Reuse existing getApiKey function
      const { getApiKey } = await import('@/lib/api/api-keys')
      return getApiKey(keyId)
    },
  })

  // Fetch logs (filtered by this key)
  const { data, isLoading, error } = useQuery({
    queryKey: ['logs', 'apiKey', keyId, filters, dateRange],
    queryFn: () => getApiKeyLogs(keyId, {
      ...filters,
      ...dateRange,
    }),
  })

  const logs = data?.data || []
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      {/* Key info header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <Link
          href="/settings/api-keys"
          className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          返回 API Keys
        </Link>
        <h1 className="text-2xl font-bold mb-2">
          {apiKey?.name || '未命名 Key'}
        </h1>
        <div className="flex gap-6 text-sm opacity-90">
          <span>Key: {apiKey?.keyPreview || 'N/A'}</span>
          <span>•</span>
          <span>创建于: {apiKey?.createdAt ? new Date(apiKey.createdAt).toLocaleDateString() : 'N/A'}</span>
          <span>•</span>
          <span>共 {total.toLocaleString()} 次调用</span>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
            📊 查看统计
          </Button>
          <Button variant="outline" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
            ✏️ 编辑 Key
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
        isGlobalView={false}
      />
    </div>
  )
}
