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
import { useQuery } from '@tanstack/react-query'
import { getStatistics } from '@/lib/api/logs'
import { useAuth } from '@/lib/hooks/use-auth'
import type { StatisticsTimeRange } from '@/types/logs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type TimeRange = 'today' | 'week' | 'month' | 'all'

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all', label: '全部' },
]

function formatLastUsed(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  return `${diffDays} 天前`
}

export default function StatisticsPage() {
  const { authState } = useAuth()
  const [timeRange, setTimeRange] = useState<TimeRange>('week')

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
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  // Permission check
  if (!hasPermission) {
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

  const stats = data

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API 使用统计</h1>
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
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error instanceof Error ? error.message : '未知错误'}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重新加载
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
                总请求数
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
                    <span className="ml-1">较上个周期</span>
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Success rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                成功率
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary.successRate}%</div>
              <div className="text-xs text-muted-foreground mt-1">
                <Badge variant="outline" className="text-xs">
                  {stats.summary.successRate >= 99 ? '优秀' : stats.summary.successRate >= 95 ? '良好' : '需改进'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Success requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                成功请求
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary.successCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                占比 {stats.statusDistribution.find(d => d.status === 'success')?.percentage || 0}%
              </p>
            </CardContent>
          </Card>

          {/* Error requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                失败请求
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary.errorCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                占比 {stats.statusDistribution.find(d => d.status === 'error')?.percentage || 0}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trend chart placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>请求趋势</CardTitle>
          <CardDescription>
            按日期统计的 API 请求量变化
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">趋势图表</p>
              <p className="text-xs mt-1">功能待开发</p>
              {stats && stats.trendData.length > 0 && (
                <p className="text-xs mt-2 text-muted-foreground/70">已收录 {stats.trendData.length} 天的数据</p>
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
                <CardTitle>API Key 详情</CardTitle>
                <CardDescription>
                  查看所有活跃 API Key 的请求量数据
                </CardDescription>
              </div>
              <Badge variant="outline">共 {stats.keyStats.length} 个活跃 Key</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Key 名称</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">请求量</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">占比</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">成功率</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">最后使用</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">状态</th>
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
                        <span className="text-sm text-muted-foreground">{formatLastUsed(key.lastUsed)}</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant={key.isActive ? 'default' : 'secondary'} className="text-xs">
                          {key.isActive ? '活跃' : '未激活'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {stats.keyStats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无数据
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
