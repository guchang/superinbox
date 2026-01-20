"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import { CategoryType, ContentType, ItemStatus } from '@/types'
import { ArrowLeft, RefreshCw, Sparkles, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { FilePreview } from '@/components/file-preview'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'

export default function InboxDetailPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const params = useParams()
  const id = params.id as string

  const { data: itemData, isLoading, refetch } = useQuery({
    queryKey: ['inbox', id],
    queryFn: () => inboxApi.getItem(id),
    enabled: !!id,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const item = itemData?.data
  const categoryLabelMap = useMemo(() => {
    return new Map((categoriesData?.data || []).map((category) => [category.key, category.name]))
  }, [categoriesData])
  const { isPolling } = useAutoRefetch({
    refetch,
    items: item ? [item] : [],
    interval: 3000,
  })

  // 删除 mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await inboxApi.deleteItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      toast({
        title: '删除成功',
        description: '条目已成功删除',
      })
      router.push('/inbox')
    },
    onError: (error) => {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    },
  })

  const reclassifyMutation = useMutation({
    mutationFn: async () => {
      await inboxApi.reclassifyItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox', id] })
      toast({
        title: '重新分类已开始',
        description: '正在重新分析条目',
      })
    },
    onError: (error) => {
      toast({
        title: '重新分类失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    },
  })

  const handleDelete = () => {
    if (confirm('确定要删除这条记录吗？')) {
      deleteMutation.mutate()
    }
  }

  const getCategoryBadgeVariant = (category: string) => {
    const variants: Record<string, any> = {
      [CategoryType.TODO]: 'default',
      [CategoryType.IDEA]: 'secondary',
      [CategoryType.EXPENSE]: 'destructive',
      [CategoryType.NOTE]: 'outline',
      [CategoryType.BOOKMARK]: 'outline',
      [CategoryType.SCHEDULE]: 'default',
      [CategoryType.UNKNOWN]: 'secondary',
    }
    return variants[category] || 'outline'
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

  const entityGroups = (item.analysis?.entities || []).reduce<Record<string, string[]>>(
    (acc, entity) => {
      if (!entity?.type || entity.type === 'customFields') return acc
      const value = entity.value?.trim()
      if (!value) return acc
      if (!acc[entity.type]) acc[entity.type] = []
      acc[entity.type].push(value)
      return acc
    },
    {}
  )
  const entityEntries = Object.entries(entityGroups)
  const categoryKey = item.analysis?.category ?? 'unknown'
  const categoryLabel =
    categoryLabelMap.get(categoryKey) ||
    ({
      [CategoryType.TODO]: 'TODO',
      [CategoryType.IDEA]: 'IDEA',
      [CategoryType.EXPENSE]: 'EXPENSE',
      [CategoryType.NOTE]: 'NOTE',
      [CategoryType.BOOKMARK]: 'BOOKMARK',
      [CategoryType.SCHEDULE]: 'SCHEDULE',
      [CategoryType.UNKNOWN]: 'UNKNOWN',
    }[categoryKey] || categoryKey)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inbox">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">条目详情</h1>
            <p className="text-muted-foreground">ID: {id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="h-10 w-10"
          >
            <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            onClick={() => reclassifyMutation.mutate()}
            disabled={reclassifyMutation.isPending || item.status === ItemStatus.PROCESSING}
            className="h-10 gap-2 px-4"
          >
            {reclassifyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            重新分类
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="h-10 w-10"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Status & Category */}
      <div className="flex items-center gap-2">
        <Badge variant={getCategoryBadgeVariant(categoryKey)}>
          {categoryLabel}
        </Badge>
        <Badge variant={getStatusBadgeVariant(item.status)} className="gap-1">
          {item.status === ItemStatus.PROCESSING && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {item.status}
        </Badge>
        <Badge variant="outline">{item.source}</Badge>
        <Badge variant="outline">{item.contentType}</Badge>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>原始内容</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`whitespace-pre-wrap ${item.contentType === ContentType.URL ? 'break-all' : 'break-words'}`}>
            {item.content}
          </p>
        </CardContent>
      </Card>

      {/* File Preview */}
      {item.hasFile && (
        <Card>
          <CardHeader>
            <CardTitle>附件</CardTitle>
          </CardHeader>
          <CardContent>
            <FilePreview
              itemId={item.id}
              fileName={item.fileName}
              mimeType={item.mimeType}
            />
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {item.analysis && (
        <Card>
          <CardHeader>
            <CardTitle>AI 分析结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">意图分类</p>
                <p className="font-medium">{categoryLabel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">置信度</p>
                <p className="font-medium">
                  {(item.analysis.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {item.analysis.summary && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">摘要</p>
                <p className="text-sm">{item.analysis.summary}</p>
              </div>
            )}

            {entityEntries.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">提取的实体</p>
                <div className="space-y-1">
                  {entityEntries.map(([type, values]) => (
                    <div key={type} className="text-sm">
                      <span className="text-muted-foreground">{type}:</span>{' '}
                      <span className="font-mono">{values.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>元数据</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">状态</span>
              <p className="font-medium">{item.status}</p>
            </div>
            <div>
              <span className="text-muted-foreground">优先级</span>
              <p className="font-medium">{item.priority}</p>
            </div>
            <div>
              <span className="text-muted-foreground">来源</span>
              <p className="font-medium">{item.source}</p>
            </div>
            <div>
              <span className="text-muted-foreground">内容类型</span>
              <p className="font-medium">{item.contentType}</p>
            </div>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">创建时间</span>
            <p className="font-medium">{formatRelativeTime(item.createdAt)}</p>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">更新时间</span>
            <p className="font-medium">{formatRelativeTime(item.updatedAt)}</p>
          </div>
          {item.processedAt && (
            <div className="text-sm">
              <span className="text-muted-foreground">处理时间</span>
              <p className="font-medium">{formatRelativeTime(item.processedAt)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution Results */}
      {item.distributionResults && Object.keys(item.distributionResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>分发结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(item.distributionResults).map(([target, result]) => (
                <div key={target} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{target}</span>
                  <Badge
                    variant={result?.success ? 'default' : 'destructive'}
                  >
                    {result?.success ? '成功' : '失败'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
