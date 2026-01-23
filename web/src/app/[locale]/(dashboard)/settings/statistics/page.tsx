'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TrendingUp, Activity, BarChart3, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { getStatistics } from '@/lib/api/logs'
import { useAuth } from '@/lib/hooks/use-auth'
import type { StatisticsTimeRange } from '@/types/logs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatRelativeTime } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

type TimeRange = 'today' | 'week' | 'month' | 'all'

export default function StatisticsPage() {
  const t = useTranslations('statistics')
  const common = useTranslations('common')
  const time = useTranslations('time')
  const errors = useTranslations('errors')
  const { authState } = useAuth()
  const [timeRange, setTimeRange] = useState<TimeRange>('week')

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: 'today', label: t('timeRange.today') },
    { value: 'week', label: t('timeRange.week') },
    { value: 'month', label: t('timeRange.month') },
    { value: 'all', label: t('timeRange.all') },
  ]

  // Check admin permission
  const hasPermission = authState.user?.scopes?.includes('admin:full') ?? false

  // Fetch statistics data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['statistics', timeRange],
    queryFn: () => getStatistics({ timeRange: timeRange as StatisticsTimeRange }),
    enabled: hasPermission && !authState.isLoading,
  })

  // Show loading while checking auth
  if (authState.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{common('loading')}</div>
      </div>
    )
  }

  // Permission check
  if (!hasPermission) {
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

  const stats = data

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeRangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{common('loadFailure.title')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{getApiErrorMessage(error, errors, common('unknownError'))}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {common('reload')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats overview cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.totalRequests')}
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary.totalRequests.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.summary.trendPercentage !== undefined && (
                  <span className="flex items-center">
                    {stats.summary.trendPercentage >= 0 ? (
                      <>
                        <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                        <span className="text-green-500">+{stats.summary.trendPercentage}%</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-3 w-3 mr-1 text-red-500 rotate-180" />
                        <span className="text-red-500">{stats.summary.trendPercentage}%</span>
                      </>
                    )}
                    <span className="ml-1">{t('summary.compared')}</span>
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Success rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.successRate')}
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary.successRate}%</div>
              <div className="text-xs text-muted-foreground mt-1">
                <Badge variant="outline" className="text-xs">
                  {stats.summary.successRate >= 99
                    ? t('quality.excellent')
                    : stats.summary.successRate >= 95
                      ? t('quality.good')
                      : t('quality.needsWork')}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Success requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.successCount')}
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary.successCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('summary.share', { value: stats.statusDistribution.find(d => d.status === 'success')?.percentage || 0 })}
              </p>
            </CardContent>
          </Card>

          {/* Error requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.errorCount')}
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary.errorCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('summary.share', { value: stats.statusDistribution.find(d => d.status === 'error')?.percentage || 0 })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trend chart placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>{t('trend.title')}</CardTitle>
          <CardDescription>
            {t('trend.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">{t('trend.placeholderTitle')}</p>
              <p className="text-xs mt-1">{t('trend.placeholderSubtitle')}</p>
              {stats && stats.trendData.length > 0 && (
                <p className="text-xs mt-2 text-muted-foreground/70">
                  {t('trend.collected', { count: stats.trendData.length })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys detailed stats */}
      {stats && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('keys.title')}</CardTitle>
                <CardDescription>
                  {t('keys.description')}
                </CardDescription>
              </div>
              <Badge variant="outline">{t('keys.activeCount', { count: stats.keyStats.length })}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('keys.table.name')}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">{t('keys.table.requests')}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">{t('keys.table.share')}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">{t('keys.table.successRate')}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">{t('keys.table.lastUsed')}</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">{t('keys.table.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.keyStats.map((key) => (
                    <tr key={key.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{key.name}</div>
                          <div className="text-xs text-muted-foreground">{key.id}</div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="font-medium">{key.requests.toLocaleString()}</span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 bg-secondary rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${key.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-10">{key.percentage}%</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className={`text-sm font-medium ${
                          key.successRate >= 99 ? 'text-green-600' :
                          key.successRate >= 95 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {key.successRate}%
                        </span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="text-sm text-muted-foreground">
                          {formatRelativeTime(key.lastUsed, time)}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant={key.isActive ? 'default' : 'secondary'} className="text-xs">
                          {key.isActive ? t('keys.status.active') : t('keys.status.inactive')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {stats.keyStats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        {common('noData')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
