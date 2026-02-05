"use client"

import { useTranslations } from 'next-intl'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { Button } from '@/components/ui/button'
import { CategoryType, ContentType, Item } from '@/types'
import {
  Loader2,
  LayoutGrid,
  Type,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Video,
  Inbox,
  ChevronRight,
  Search,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useToast } from '@/hooks/use-toast'
import { useState, useMemo, useEffect, useRef } from 'react'
import { MemoryCard } from '@/components/inbox/memory-card'
import { ExpandableInput } from '@/components/inbox/expandable-input'
import { DetailModal } from '@/components/inbox/detail-modal'
import { SearchDialog, SearchFilters } from '@/components/shared/search-dialog'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'

// 媒体类型配置
const contentTypeFilters = [
  { id: 'all', icon: LayoutGrid },
  { id: 'text', icon: Type },
  { id: 'image', icon: ImageIcon },
  { id: 'audio', icon: Mic },
  { id: 'video', icon: Video },
  { id: 'file', icon: Paperclip },
] as const


export default function InboxPage() {
  const t = useTranslations('inbox')
  const filtersT = useTranslations('inbox.contentTypeFilters')
  const searchT = useTranslations('commandSearch')
  const common = useTranslations('common')
  const time = useTranslations('time')
  const errors = useTranslations('errors')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ query: '' })
  const [activeType, setActiveType] = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [createdItemId, setCreatedItemId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // 监听 URL 参数控制搜索对话框与筛选
  useEffect(() => {
    const searchParam = searchParams.get('search')
    if (searchParam === 'true') {
      setIsSearchOpen(true)
      // 清除 URL 参数但保持对话框打开
      window.history.replaceState({}, '', window.location.pathname)
    }

    const nextFilters: SearchFilters = {
      query: searchParams.get('query') || '',
      category: (searchParams.get('category') || undefined) as SearchFilters['category'],
      status: (searchParams.get('status') || undefined) as SearchFilters['status'],
      source: searchParams.get('source') || undefined,
      hasType: (searchParams.get('hastype') || undefined) as SearchFilters['hasType'],
    }

    setSearchFilters(nextFilters)

    const urlType = searchParams.get('hastype')
    if (urlType) {
      setActiveType(urlType)
    } else {
      setActiveType('all')
    }
  }, [searchParams])


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

  // 合并所有页面的数据（后端已按时间从新到旧排序）
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

  // 查看详情
  const handleViewDetail = (item: Item) => {
    setSelectedItem(item)
    setIsDetailModalOpen(true)
  }

  // 编辑条目
  const handleEdit = (item: Item) => {
    setEditingItem(item)
    setIsEditDialogOpen(true)
  }

  // 重分类 mutation
  const reclassifyMutation = useMutation({
    mutationFn: async (id: string) => {
      await inboxApi.reclassifyItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      toast({
        title: t('toast.reclassifySuccess.title'),
        description: t('toast.reclassifySuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.reclassifyFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  // 重新分发 mutation
  const redistributeMutation = useMutation({
    mutationFn: async (id: string) => {
      await inboxApi.distributeItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      toast({
        title: t('toast.redistributeSuccess.title'),
        description: t('toast.redistributeSuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.redistributeFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  // 创建条目 mutation
  const createMutation = useMutation({
    mutationFn: async ({ content, files }: { content: string; files?: File[] }) => {
      if (files && files.length > 0) {
        // 上传文件
        const formData = new FormData()
        files.forEach((file) => formData.append('files', file))
        if (content.trim()) {
          formData.append('content', content)
        }
        return inboxApi.uploadMultipleFiles(formData)
      } else {
        // 纯文本
        return inboxApi.createItem({
          content,
          contentType: ContentType.TEXT,
          source: 'web',
        })
      }
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      toast({
        title: t('toast.createSuccess.title'),
        description: t('toast.createSuccess.description'),
      })
      if (response?.success && response.data?.id) {
        setCreatedItemId(response.data.id)
      }
    },
    onError: (error) => {
      toast({
        title: t('toast.createFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  const handleCreate = async (content: string, files?: File[]) => {
    await createMutation.mutateAsync({ content, files })
  }

  useEffect(() => {
    if (!createdItemId) return
    const hasItem = items.some((item) => item.id === createdItemId)
    if (!hasItem) return
    const timeout = setTimeout(() => setCreatedItemId(null), 800)
    return () => clearTimeout(timeout)
  }, [createdItemId, items])

  // 获取当前分类标签
  const currentCategoryLabel = useMemo(() => {
    if (searchFilters.category) {
      return categoryLabelMap.get(searchFilters.category) || searchFilters.category
    }
    return t('allCategoriesTitle') || t('title') || 'All categories'
  }, [searchFilters.category, categoryLabelMap, t])

  return (
    <div className="h-full flex flex-col bg-[#f5f5f7] dark:bg-[#0b0b0f]">
      {/* 顶部区域：标题、搜索、类型筛选 */}
      {/* playground 风格：移除固定容器限制，让输入框可以自由定位 */}
      <div className="hidden md:block shrink-0 px-4 md:px-6 pt-6 pb-4 border-b border-black/[0.03] dark:border-white/[0.03] bg-white/50 dark:bg-[#0b0b0f]/50 backdrop-blur-xl relative">
        <ExpandableInput
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
        />
      </div>

      <div className="md:hidden">
        <ExpandableInput
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
        />
      </div>

      {/* 搜索对话框 */}
      <SearchDialog
        filters={searchFilters}
        onFiltersChange={setSearchFilters}
        availableSources={availableSources}
        availableCategories={activeCategories.map((category) => ({
          key: category.key,
          name: category.name,
        }))}
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
      />

      {/* 结果区域 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-black/[0.01] dark:bg-[#0b0b0f]/40">
        <div className="flex flex-col gap-2 pb-2 md:gap-3 md:pb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold tracking-tight whitespace-nowrap flex-shrink-0">
              {currentCategoryLabel}
            </span>
            {totalCount > 0 && (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-muted">
                {totalCount}
              </span>
            )}
          </div>
          {/* 媒体类型筛选 Pills */}
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 overflow-x-auto md:flex-wrap md:overflow-visible flex-1 min-w-0">
              {contentTypeFilters.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveType(type.id)}
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[10px] md:text-[11px] font-black uppercase flex items-center gap-2 transition-all shrink-0",
                    activeType === type.id
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-black/5 opacity-40 hover:opacity-100 dark:bg-white/5"
                  )}
                >
                  <type.icon size={11} />
                  <span>{filtersT(type.id)}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="h-9 w-9 shrink-0 rounded-xl text-foreground/80 opacity-60 hover:opacity-100 hover:bg-current/5"
              aria-label={searchT('title') || 'Search'}
            >
              <Search className="h-4 w-4 mx-auto" />
            </button>
          </div>
        </div>
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
            {/* 瀑布流布局 - 数据已重新排序以适配按列填充 */}
            <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <MemoryCard
                    key={item.id}
                    item={item}
                    categoryLabelMap={categoryLabelMap}
                    onDelete={handleDelete}
                    onRetry={handleRetry}
                    onEdit={handleEdit}
                    onReclassify={(id) => reclassifyMutation.mutate(id)}
                    onRedistribute={(id) => redistributeMutation.mutate(id)}
                    onViewDetail={handleViewDetail}
                    deletingId={deletingId}
                    retryingId={retryingId}
                    animationVariant={item.id === createdItemId ? 'elastic' : 'fade'}
                  />
                ))}

            {/* Detail Modal */}
            <DetailModal
              item={selectedItem}
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
              onEdit={handleEdit}
              onReclassify={(id) => reclassifyMutation.mutate(id)}
              onRedistribute={(id) => redistributeMutation.mutate(id)}
              reclassifying={reclassifyMutation.isPending}
              redistributing={redistributeMutation.isPending}
            />
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
