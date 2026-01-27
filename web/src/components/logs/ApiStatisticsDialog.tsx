'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getStatistics } from '@/lib/api/logs'
import { Card, CardContent } from '@/components/ui/card'
import { Activity, BarChart3, CheckCircle, XCircle, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { StatisticsTimeRange } from '@/types/logs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

interface ApiStatisticsDialogProps {
  open: boolean
  onClose: () => void
}

export function ApiStatisticsDialog({ open, onClose }: ApiStatisticsDialogProps) {
  const t = useTranslations('apiStatistics')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const [timeRange, setTimeRange] = useState<StatisticsTimeRange>('week')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['api-statistics', timeRange],
    queryFn: () => getStatistics({ timeRange }),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        {/* Time range selector */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={timeRange === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('today')}
          >
            {t('timeRange.today')}
          </Button>
          <Button
            variant={timeRange === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('week')}
          >
            {t('timeRange.week')}
          </Button>
          <Button
            variant={timeRange === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('month')}
          >
            {t('timeRange.month')}
          </Button>
          <Button
            variant={timeRange === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('all')}
          >
            {t('timeRange.all')}
          </Button>
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

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">{common('loading')}</div>
          </div>
        )}

        {/* Statistics content */}
        {data && !isLoading && (
          <div className="space-y-6">
            {/* Overview cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Total requests */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('summary.totalRequests')}</p>
                      <p className="text-2xl font-bold">{data.summary.totalRequests.toLocaleString()}</p>
                    </div>
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                  {data.summary.trendPercentage !== undefined && (
                    <div className="mt-2 flex items-center text-sm">
                      {data.summary.trendPercentage >= 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                          <span className="text-green-500">+{data.summary.trendPercentage}%</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4 mr-1 text-red-500 rotate-180" />
                          <span className="text-red-500">{data.summary.trendPercentage}%</span>
                        </>
                      )}
                      <span className="text-muted-foreground ml-1">{t('summary.compared')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Success rate */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('summary.successRate')}</p>
                      <p className="text-2xl font-bold">{data.summary.successRate}%</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={
                        data.summary.successRate >= 99
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100'
                          : data.summary.successRate >= 95
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100'
                      }
                    >
                      {data.summary.successRate >= 99
                        ? t('quality.excellent')
                        : data.summary.successRate >= 95
                          ? t('quality.good')
                          : t('quality.needsWork')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Success requests */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('summary.successCount')}</p>
                      <p className="text-2xl font-bold">{data.summary.successCount.toLocaleString()}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t('summary.share', { value: data.statusDistribution.find((d) => d.status === 'success')?.percentage || 0 })}
                  </div>
                </CardContent>
              </Card>

              {/* Error requests */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('summary.errorCount')}</p>
                      <p className="text-2xl font-bold">{data.summary.errorCount.toLocaleString()}</p>
                    </div>
                    <XCircle className="h-8 w-8 text-red-500" />
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t('summary.share', { value: data.statusDistribution.find((d) => d.status === 'error')?.percentage || 0 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* API Keys stats */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">{t('keys.title')}</h3>
                <div className="space-y-3">
                  {data.keyStats.map((key) => (
                    <div key={key.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium">{key.name}</div>
                          <div className="text-xs text-muted-foreground">{key.id}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('keys.table.requests')}:</span>{' '}
                          <span className="font-medium">{key.requests.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('keys.table.successRate')}:</span>{' '}
                          <span className={`font-medium ${
                            key.successRate >= 99 ? 'text-green-600' :
                            key.successRate >= 95 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {key.successRate}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('keys.table.lastUsed')}:</span>{' '}
                          <span className="text-muted-foreground">{new Date(key.lastUsed).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.keyStats.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">{common('noData')}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
