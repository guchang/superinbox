"use client"

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { IntentType, ItemStatus } from '@/types'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function InboxDetailPage() {
  const params = useParams()
  const id = params.id as string

  const { data: itemData, isLoading, refetch } = useQuery({
    queryKey: ['inbox', id],
    queryFn: () => inboxApi.getItem(id),
    enabled: !!id,
  })

  const item = itemData?.data

  const getIntentBadgeVariant = (intent: IntentType) => {
    const variants: Record<IntentType, any> = {
      [IntentType.TODO]: 'default',
      [IntentType.IDEA]: 'secondary',
      [IntentType.EXPENSE]: 'destructive',
      [IntentType.NOTE]: 'outline',
      [IntentType.BOOKMARK]: 'outline',
      [IntentType.SCHEDULE]: 'default',
      [IntentType.UNKNOWN]: 'secondary',
    }
    return variants[intent] || 'outline'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">条目不存在</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inbox">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">条目详情</h1>
            <p className="text-muted-foreground">ID: {item.id}</p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>内容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">原始内容</p>
              <p className="text-sm bg-muted p-4 rounded-lg">{item.content}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={getIntentBadgeVariant(item.analysis?.intent || IntentType.UNKNOWN)}>
                {item.analysis?.intent || IntentType.UNKNOWN}
              </Badge>
              <Badge variant="outline">{item.contentType}</Badge>
              <Badge variant="outline">{item.source}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* AI Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>AI 分析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {item.analysis ? (
              <>
                <div>
                  <p className="text-sm font-medium mb-1">意图</p>
                  <p className="text-sm">{item.analysis.intent}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">置信度</p>
                  <p className="text-sm">{(item.analysis.confidence * 100).toFixed(1)}%</p>
                </div>
                {item.analysis.summary && (
                  <div>
                    <p className="text-sm font-medium mb-1">摘要</p>
                    <p className="text-sm">{item.analysis.summary}</p>
                  </div>
                )}
                {item.analysis.entities && item.analysis.entities.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">实体</p>
                    <div className="flex flex-wrap gap-2">
                      {item.analysis.entities.map((entity, index) => (
                        <Badge key={index} variant="secondary">
                          {entity.type}: {entity.value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">暂无 AI 分析结果</p>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>元数据</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">状态</p>
                <p className="text-sm">{item.status}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">优先级</p>
                <p className="text-sm">{item.priority}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">创建时间</p>
                <p className="text-sm">{formatDate(item.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">更新时间</p>
                <p className="text-sm">{formatDate(item.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
