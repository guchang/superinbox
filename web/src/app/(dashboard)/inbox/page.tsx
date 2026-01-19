"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import { CategoryType, ItemStatus } from '@/types'
import { Eye, Trash2, Loader2, Clock, Search, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { useState, useMemo } from 'react'
import { CommandSearch, SearchFilters } from '@/components/shared/command-search'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'
import { FilePreview } from '@/components/file-preview'
import { Input } from '@/components/ui/input'

export default function InboxPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ query: '' })

  // 构建查询参数
  const queryParams = useMemo(() => {
    const params: any = { limit: 100 }

    if (searchFilters.query) {
      params.query = searchFilters.query
    }
    if (searchFilters.category) {
      params.category = searchFilters.category
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

  // Auto-refetch when there are processing items
  const { isPolling } = useAutoRefetch({
    refetch,
    items,
    interval: 3000, // Poll every 3 seconds
  })

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

  // 重试 AI 处理 mutation
  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      setRetryingId(id)
      await inboxApi.retryAIProcessing(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      toast({
        title: '重试成功',
        description: 'AI 处理已重新开始',
      })
    },
    onError: (error) => {
      toast({
        title: '重试失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setRetryingId(null)
    },
  })

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条记录吗？')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleRetry = async (id: string) => {
    await retryMutation.mutateAsync(id)
  }

  // Unified badge that combines category and AI status
  const getUnifiedBadgeVariant = (category: CategoryType, status: ItemStatus) => {
    switch (status) {
      case ItemStatus.PROCESSING:
        return 'outline' // Processing state uses outline variant
      case ItemStatus.FAILED:
        return 'destructive' // Failed state uses destructive variant
      case ItemStatus.COMPLETED:
      case ItemStatus.PENDING:
      default:
        return 'default' // Completed/normal state uses default variant (black background, white text)
    }
  }

  const getUnifiedBadgeLabel = (category: CategoryType, status: ItemStatus) => {
    switch (status) {
      case ItemStatus.PROCESSING:
        return 'ANALYZING...'
      case ItemStatus.FAILED:
        return 'FAILED'
      case ItemStatus.COMPLETED:
      case ItemStatus.PENDING:
      default:
        const labels: Record<CategoryType, string> = {
          [CategoryType.TODO]: 'TODO',
          [CategoryType.IDEA]: 'IDEA', 
          [CategoryType.EXPENSE]: 'EXPENSE',
          [CategoryType.NOTE]: 'NOTE',
          [CategoryType.BOOKMARK]: 'BOOKMARK',
          [CategoryType.SCHEDULE]: 'SCHEDULE',
          [CategoryType.UNKNOWN]: 'UNKNOWN',
        }
        return labels[category] || 'UNKNOWN'
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">收件箱</h1>
          <p className="text-muted-foreground">管理所有收到的信息条目</p>
        </div>
        
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="搜索条目内容..." 
            className="pl-9"
            value={searchFilters.query || ''}
            onChange={(e) => setSearchFilters(prev => ({ ...prev, query: e.target.value }))}
          />
        </div>
      </div>

      {/* Advanced Filters */}
      <CommandSearch
        filters={searchFilters}
        onFiltersChange={setSearchFilters}
        availableSources={availableSources}
      />

      {/* Results Count */}
      {(searchFilters.query || searchFilters.category || searchFilters.status || searchFilters.source) && (
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
            {searchFilters.query || searchFilters.category || searchFilters.status || searchFilters.source
              ? '没有找到匹配的条目'
              : '暂无数据'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`transition-all hover:bg-accent/50 ${
                item.status === ItemStatus.PROCESSING ? 'bg-accent/30 animate-pulse' : ''
              }`}
            >
              <CardContent className="p-6">
                {/* Top Row: Unified Badge and Time with Source */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 h-5">
                    <Badge 
                      variant={getUnifiedBadgeVariant(item.analysis?.category || CategoryType.UNKNOWN, item.status)}
                      className="h-5 text-xs font-bold gap-1"
                    >
                      {item.status === ItemStatus.PROCESSING && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {getUnifiedBadgeLabel(item.analysis?.category || CategoryType.UNKNOWN, item.status)}
                    </Badge>
                    {/* Add retry button for failed items */}
                    {item.status === ItemStatus.FAILED && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRetry(item.id)
                        }}
                        disabled={retryingId === item.id}
                        className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {retryingId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatRelativeTime(item.createdAt)} · {item.source.toUpperCase()}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                  <p className={`text-base leading-relaxed font-medium transition-colors ${
                    item.status === ItemStatus.PROCESSING 
                      ? 'text-muted-foreground italic' 
                      : 'text-foreground'
                  }`}>
                    {item.content}
                  </p>

                  {/* File Preview */}
                  {item.hasFile && (
                    <div className="mt-4">
                      <FilePreview
                        itemId={item.id}
                        fileName={item.fileName}
                        mimeType={item.mimeType}
                        allFiles={item.allFiles}
                      />
                    </div>
                  )}
                </div>

                {/* Bottom Row: Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex-1">
                    {/* Route Status - Simplified */}
                    {item.status === ItemStatus.PROCESSING ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>等待 AI 解析分类以匹配路由规则...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          路由: 待配置
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Link href={`/inbox/${item.id}`}>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={item.status === ItemStatus.PROCESSING}
                        className="gap-2 text-xs font-medium"
                      >
                        <Eye className="h-4 w-4" />
                        查看详情
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDelete(item.id)
                      }}
                      disabled={deletingId === item.id}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
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
