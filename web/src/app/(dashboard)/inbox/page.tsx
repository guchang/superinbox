"use client"

import { useQuery } from '@tanstack/react-query'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatRelativeTime } from '@/lib/utils'
import { IntentType, ItemStatus } from '@/types'
import { Eye, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function InboxPage() {
  const { data: itemsData, isLoading, refetch } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => inboxApi.getItems({ limit: 20 }),
  })

  const items = itemsData?.data?.items || []

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

  const getStatusBadgeVariant = (status: ItemStatus) => {
    const variants: Record<ItemStatus, any> = {
      [ItemStatus.PENDING]: 'secondary',
      [ItemStatus.PROCESSING]: 'outline',
      [ItemStatus.COMPLETED]: 'default',
      [ItemStatus.FAILED]: 'destructive',
    }
    return variants[status] || 'outline'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">收件箱</h1>
          <p className="text-muted-foreground">管理所有收到的信息条目</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input placeholder="搜索内容..." className="max-w-sm" />
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="按意图筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部意图</SelectItem>
                <SelectItem value={IntentType.TODO}>待办事项</SelectItem>
                <SelectItem value={IntentType.IDEA}>想法</SelectItem>
                <SelectItem value={IntentType.EXPENSE}>支出</SelectItem>
                <SelectItem value={IntentType.NOTE}>笔记</SelectItem>
                <SelectItem value={IntentType.BOOKMARK}>书签</SelectItem>
                <SelectItem value={IntentType.SCHEDULE}>日程</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="按状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value={ItemStatus.PENDING}>待处理</SelectItem>
                <SelectItem value={ItemStatus.PROCESSING}>处理中</SelectItem>
                <SelectItem value={ItemStatus.COMPLETED}>已完成</SelectItem>
                <SelectItem value={ItemStatus.FAILED}>失败</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            加载中...
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无数据
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getIntentBadgeVariant(item.analysis?.intent || IntentType.UNKNOWN)}>
                        {item.analysis?.intent || IntentType.UNKNOWN}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(item.status)}>
                        {item.status}
                      </Badge>
                      <Badge variant="outline">{item.source}</Badge>
                    </div>
                    <p className="text-sm line-clamp-2">{item.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                  <Link href={`/inbox/${item.id}`}>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
