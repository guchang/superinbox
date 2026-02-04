"use client"

import { useTranslations } from 'next-intl'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { Button } from '@/components/ui/button'
import { CategoryType } from '@/types'
import {
  Loader2,
  LayoutGrid,
  Type,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Inbox,
  ChevronRight,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useToast } from '@/hooks/use-toast'
import { useState, useMemo, useEffect, useRef } from 'react'
import { MemoryCard } from '@/components/inbox/memory-card'
import { CommandSearch, SearchFilters } from '@/components/shared/command-search'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

// 媒体类型配置
const contentTypeFilters = [
  { id: 'all', label: 'All Types', icon: LayoutGrid },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'image', label: 'Images', icon: ImageIcon },
  { id: 'audio', label: 'Audios', icon: Mic },
  { id: 'file', label: 'Docs', icon: Paperclip },
] as const


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
  const [activeType, setActiveType] = useState<string>('all')
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 5 * 60 * 1000,
  })

  // 使用数据缓存避免重复创建数组引用
  const categories = useMemo(() => categoriesData?.data || [], [categoriesData?.data])
  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories]
  )
  const categoryLabelMap = useMemo(() => {
    return new Map(categories.map((category) => [category.key, category.name]))
  }, [categories])

  // 构建查询参数 - 统一使用 activeType 作为媒体类型筛选
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {}

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
    // 只使用 activeType 作为媒体类型筛选参数，避免与 searchFilters.hasType 冲突
    if (activeType !== 'all') {
      params.hastype = activeType
    }

    return params
  }, [searchFilters, activeType])

  // 使用 useInfiniteQuery 实现无限滚动
  const {
    data: itemsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['inbox', queryParams],
    queryFn: ({ pageParam = 1 }) =>
      inboxApi.getItems({ ...queryParams, page: pageParam, limit: 20 }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.data) return undefined
      const { page, limit, total } = lastPage.data
      const hasMore = page * limit < total
      return hasMore ? page + 1 : undefined
    },
    initialPageParam: 1,
  })

  // 合并所有页面的数据
  const items = useMemo(() => {
    return itemsData?.pages.flatMap((page) => page.data?.items || []) || []
  }, [itemsData])

  // 获取总数
  const totalCount = itemsData?.pages[0]?.data?.total || 0

  // Auto-refetch when there are processing items
  const { isPolling } = useAutoRefetch({
    refetch,
    items,
    interval: 3000,
  })

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // 获取所有可用的来源
  const { data: sourcesData } = useQuery({
    queryKey: ['inbox', 'sources'],
    queryFn: () => inboxApi.getSources(),
    staleTime: 5 * 60 * 1000,
  })

  const availableSources = useMemo(() => {
    return sourcesData?.data || []
  }, [sourcesData])

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

  // 获取当前分类标签
  const currentCategoryLabel = useMemo(() => {
    if (searchFilters.category) {
      return categoryLabelMap.get(searchFilters.category) || searchFilters.category
    }
    return t('title') || 'All Memories'
  }, [searchFilters.category, categoryLabelMap, t])

  return (
    <div className="h-full flex flex-col">
      {/* 顶部区域：标题、搜索、类型筛选 */}
      <div className="shrink-0 px-4 md:px-6 pt-6 pb-4 space-y-4 border-b border-border/40 bg-background/50">
        {/* 标题和搜索 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{currentCategoryLabel}</h1>
            {totalCount > 0 && (
              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-muted">
                {totalCount}
              </span>
            )}
          </div>

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

        {/* 媒体类型筛选 Pills - 紧凑设计 */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {contentTypeFilters.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveType(type.id)}
              className={cn(
                "whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all shrink-0",
                activeType === type.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <type.icon size={14} />
              <span>{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 结果区域 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{common('loading')}</span>
            </div>
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32 opacity-40 gap-4"
          >
            <div className="p-4 rounded-full border border-dashed border-current">
              <Inbox size={32} />
            </div>
            <p className="text-sm italic">
              {searchFilters.query || searchFilters.category || searchFilters.status || searchFilters.source || activeType !== 'all'
                ? t('emptyFiltered')
                : common('noData')}
            </p>
          </motion.div>
        ) : (
          <>
            {/* 瀑布流布局 */}
            <div className="columns-1 md:columns-2 xl:columns-3 gap-4 space-y-4">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <MemoryCard
                    key={item.id}
                    item={item}
                    categoryLabelMap={categoryLabelMap}
                    onDelete={handleDelete}
                    onRetry={handleRetry}
                    deletingId={deletingId}
                    retryingId={retryingId}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Load More Trigger */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="py-8 text-center">
                {isFetchingNextPage ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{common('loading')}</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="gap-2"
                  >
                    {t('loadMore')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
