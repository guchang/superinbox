"use client"

import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import { CategoryType, ContentType, ItemStatus } from '@/types'
import { Eye, Trash2, Loader2, Clock, RefreshCw } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useToast } from '@/hooks/use-toast'
import { useState, useMemo } from 'react'
import { CommandSearch, SearchFilters } from '@/components/shared/command-search'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'
import { FilePreview } from '@/components/file-preview'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { RoutingStatus } from '@/components/inbox/routing-status'

export default function InboxPage() {
  const t = useTranslations('inbox')
  const common = useTranslations('common')
  const time = useTranslations('time')
  const errors = useTranslations('errors')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ query: '' })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categories = categoriesData?.data || []
  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories]
  )
  const categoryLabelMap = useMemo(() => {
    return new Map(categories.map((category) => [category.key, category.name]))
  }, [categories])

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
    if (searchFilters.hasType) {
      params.hastype = searchFilters.hasType
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
        title: t('toast.deleteSuccess.title'),
        description: t('toast.deleteSuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.deleteFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
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
        title: t('toast.retrySuccess.title'),
        description: t('toast.retrySuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.retryFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setRetryingId(null)
    },
  })

  const handleDelete = async (id: string) => {
    if (confirm(t('confirmDelete'))) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleRetry = async (id: string) => {
    await retryMutation.mutateAsync(id)
  }

  // Unified badge that combines category and AI status
  const getUnifiedBadgeVariant = (_category: string, status: ItemStatus) => {
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

  const getUnifiedBadgeLabel = (category: string, status: ItemStatus) => {
    switch (status) {
      case ItemStatus.PROCESSING:
        return t('badge.analyzing')
      case ItemStatus.FAILED:
        return t('badge.failed')
      case ItemStatus.COMPLETED:
      case ItemStatus.PENDING:
      default:
        const labels: Record<string, string> = {
          [CategoryType.TODO]: t('badge.todo'),
          [CategoryType.IDEA]: t('badge.idea'),
          [CategoryType.EXPENSE]: t('badge.expense'),
          [CategoryType.NOTE]: t('badge.note'),
          [CategoryType.BOOKMARK]: t('badge.bookmark'),
          [CategoryType.SCHEDULE]: t('badge.schedule'),
          [CategoryType.UNKNOWN]: t('badge.unknown'),
        }
        return categoryLabelMap.get(category) || labels[category] || category.toUpperCase()
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        
        {/* Unified Search - 右对齐，扩展时向左延伸 */}
        <div className="flex justify-end">
          <CommandSearch
            filters={searchFilters}
            onFiltersChange={setSearchFilters}
            availableSources={availableSources}
            availableCategories={activeCategories.map((category) => ({
              key: category.key,
              name: category.name,
            }))}
          />
        </div>
      </div>

      {/* Results Count */}
      {(searchFilters.query || searchFilters.category || searchFilters.status || searchFilters.source || searchFilters.hasType) && (
        <div className="text-sm text-muted-foreground">
          {t('resultsCount', { count: items.length })}
        </div>
      )}

      {/* Items List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {common('loading')}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {searchFilters.query || searchFilters.category || searchFilters.status || searchFilters.source || searchFilters.hasType
              ? t('emptyFiltered')
              : common('noData')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
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
                      variant={getUnifiedBadgeVariant(item.analysis?.category ?? 'unknown', item.status)}
                      className="h-5 text-xs font-bold gap-1"
                    >
                      {item.status === ItemStatus.PROCESSING && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {getUnifiedBadgeLabel(item.analysis?.category ?? 'unknown', item.status)}
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
                    <span>{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)} · {item.source.toUpperCase()}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                  <p className={`text-base leading-relaxed font-medium transition-colors ${
                    item.status === ItemStatus.PROCESSING 
                      ? 'text-muted-foreground italic' 
                      : 'text-foreground'
                  } ${item.contentType === ContentType.URL ? 'break-all' : 'break-words'}`}>
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
                    {/* Route Status - SSE only for first item, others disabled */}
                    <RoutingStatus
                      itemId={item.id}
                      initialDistributedTargets={item.distributedTargets}
                      initialRuleNames={item.distributedRuleNames}
                      disabled={index !== 0}  // 只有第一条启用 SSE
                    />
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Link href={`/inbox/${item.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={item.status === ItemStatus.PROCESSING}
                        className="h-9 w-9"
                        aria-label={t('actions.viewDetails')}
                      >
                        <Eye className="h-4 w-4" />
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
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      aria-label={common('delete')}
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
