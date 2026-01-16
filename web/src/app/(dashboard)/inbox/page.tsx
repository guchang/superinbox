"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import { IntentType, ItemStatus } from '@/types'
import { Eye, RefreshCw, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { useState, useMemo } from 'react'
import { CommandSearch, SearchFilters } from '@/components/shared/command-search'

export default function InboxPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ query: '' })

  // 构建查询参数
  const queryParams = useMemo(() => {
    const params: any = { limit: 100 }

    if (searchFilters.query) {
      params.query = searchFilters.query
    }
    if (searchFilters.intent) {
      params.intent = searchFilters.intent
    }
    if (searchFilters.status) {
      params.status = searchFilters.status
    }
    if (searchFilters.source) {
      params.source = searchFilters.source
    }

    return params
  }, [searchFilters])

  const { data: itemsData, isLoading, refetch } = useQuery({
    queryKey: ['inbox', queryParams],
    queryFn: () => inboxApi.getItems(queryParams),
  })

  const items = itemsData?.data?.items || []

  // 获取所有可用的来源（需要从所有数据中获取，而不是筛选后的数据）
  const { data: allItemsData } = useQuery({
    queryKey: ['inbox', { limit: 1000 }], // 获取所有数据用于提取 source
    queryFn: () => inboxApi.getItems({ limit: 1000 }),
  })

  const availableSources = useMemo(() => {
    const sources = new Set((allItemsData?.data?.items || []).map(item => item.source))
    return Array.from(sources).sort()
  }, [allItemsData])

  // 删除 mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id)
      await inboxApi.deleteItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      toast({
        title: '删除成功',
        description: '条目已成功删除',
      })
    },
    onError: (error) => {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setDeletingId(null)
    },
  })

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条记录吗？')) {
      await deleteMutation.mutateAsync(id)
    }
  }

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

      {/* 搜索和筛选 */}
      <CommandSearch
        filters={searchFilters}
        onFiltersChange={setSearchFilters}
        availableSources={availableSources}
      />

      {/* 结果统计 */}
      {(searchFilters.query || searchFilters.intent || searchFilters.status || searchFilters.source) && (
        <div className="text-sm text-muted-foreground">
          找到 {items.length} 条结果
        </div>
      )}

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
            {searchFilters.query || searchFilters.intent || searchFilters.status || searchFilters.source
              ? '没有找到匹配的条目'
              : '暂无数据'}
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
                  <div className="flex items-center gap-1">
                    <Link href={`/inbox/${item.id}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
