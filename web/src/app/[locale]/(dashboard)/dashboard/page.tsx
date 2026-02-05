"use client"

import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { categoriesApi } from '@/lib/api/categories'
import { settingsApi } from '@/lib/api/settings'
import { inboxApi } from '@/lib/api/inbox'
import {
  Inbox,
  BrainCircuit,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { ItemStatus } from '@/types'
import { formatRelativeTime } from '@/lib/utils'
import { Link } from '@/i18n/navigation'
import { useMemo } from 'react'

const getIntentLabel = (
  category: string,
  labelMap: Map<string, string>,
  fallbackLabels: Record<string, string>
): string => {
  return labelMap.get(category) || fallbackLabels[category] || category
}

const getIntentColor = (category: string): string => {
  const colors: Record<string, string> = {
    todo: 'bg-blue-500',
    idea: 'bg-purple-500',
    expense: 'bg-red-500',
    schedule: 'bg-green-500',
    note: 'bg-yellow-500',
    bookmark: 'bg-pink-500',
    unknown: 'bg-gray-500',
  }
  return colors[category] || 'bg-gray-500'
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const common = useTranslations('common')
  const time = useTranslations('time')

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categoryLabelMap = useMemo(() => {
    const entries = (categoriesData?.data || []).map((category) => [category.key, category.name] as const)
    return new Map(entries)
  }, [categoriesData])

  // 获取统计数据
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['statistics'],
    queryFn: () => settingsApi.getStatistics(),
  })

  // 获取最近条目
  const { data: itemsData } = useQuery({
    queryKey: ['inbox', { limit: 3, sortBy: 'createdAt', sortOrder: 'desc' as const }],
    queryFn: () => inboxApi.getItems({ limit: 3, sortBy: 'createdAt', sortOrder: 'desc' }),
  })

  const stats = statsData?.data
  const recentItems = itemsData?.data?.items || []

  // 计算待处理数量
  const pendingCount = (stats?.itemsByStatus?.pending || 0) + (stats?.itemsByStatus?.processing || 0)

  // 计算AI处理相关的数量
  const completedCount = stats?.itemsByStatus?.completed || 0
  const failedCount = stats?.itemsByStatus?.failed || 0
  const processingCount = stats?.itemsByStatus?.processing || 0
  const totalProcessed = completedCount + failedCount

  const fallbackLabels = useMemo(() => ({
    todo: t('categories.todo'),
    idea: t('categories.idea'),
    expense: t('categories.expense'),
    schedule: t('categories.schedule'),
    note: t('categories.note'),
    bookmark: t('categories.bookmark'),
    unknown: t('categories.unknown'),
  }), [t])

  const statCards = [
    {
      title: t('stats.totalItems.title'),
      value: stats?.totalItems?.toLocaleString() || '0',
      description: t('stats.totalItems.description', { count: stats?.monthItems || 0 }),
      icon: Inbox,
      color: 'text-blue-600',
    },
    {
      title: t('stats.aiSuccessRate.title'),
      value: `${stats?.aiSuccessRate || 0}%`,
      // Show completed/failed breakdown
      description: totalProcessed > 0
        ? t('stats.aiSuccessRate.breakdown', { completed: completedCount, failed: failedCount })
        : t('stats.aiSuccessRate.description'),
      icon: BrainCircuit,
      color: 'text-purple-600',
    },
    {
      title: t('stats.todayItems.title'),
      value: `+${stats?.todayItems || 0}`,
      description: t('stats.todayItems.description'),
      icon: TrendingUp,
      color: 'text-green-600',
    },
    {
      title: t('stats.pending.title'),
      value: pendingCount.toString(),
      // Show pending/processing breakdown
      description: pendingCount > 0
        ? t('stats.pending.breakdown', { processing: processingCount, pending: stats?.itemsByStatus?.pending || 0 })
        : t('stats.pending.description'),
      icon: Clock,
      color: 'text-orange-600',
    },
  ]

  // 计算分类分布百分比
  const categoryDistribution = useMemo(() => {
    if (!stats?.itemsByCategory) return []
    const total = stats.totalItems || 1
    return Object.entries(stats.itemsByCategory)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / total) * 100),
      }))
  }, [stats])

  return (
    <div className="w-full space-y-6 px-4 md:px-6 py-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 意图分布 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t('categoryDistribution.title')}</CardTitle>
            <CardDescription>{t('categoryDistribution.description')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {statsLoading ? (
              <div className="text-center text-muted-foreground py-8">{common('loading')}</div>
            ) : categoryDistribution.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">{common('noData')}</div>
            ) : (
              <div className="space-y-3">
                {categoryDistribution.map(({ category, count, percentage }) => (
                  <div key={category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">
                        {getIntentLabel(category, categoryLabelMap, fallbackLabels)}
                      </span>
                      <span className="text-muted-foreground">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getIntentColor(category)} transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近条目 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle>{t('recent.title')}</CardTitle>
                <CardDescription>{t('recent.description')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/inbox">{t('recent.viewAll')}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {t('recent.emptyPrefix')}
                <Link href="/inbox" className="text-primary hover:underline">
                  {t('recent.emptyAction')}
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/inbox/${item.id}`}
                    className="block hover:bg-accent/50 rounded-lg transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 p-3 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={
                              item.status === ItemStatus.COMPLETED
                                ? 'default'
                                : item.status === ItemStatus.FAILED
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {getIntentLabel(item.analysis?.category ?? 'unknown', categoryLabelMap, fallbackLabels)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {item.source}
                          </Badge>
                        </div>
                        <p className="text-sm line-clamp-2">{item.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
