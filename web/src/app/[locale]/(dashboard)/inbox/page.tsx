"use client"

import { useTranslations } from 'next-intl'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { mcpConnectorsApi } from '@/lib/api/mcp-connectors'
import { Button } from '@/components/ui/button'
import { ContentType, Item } from '@/types'
import {
  Loader2,
  LayoutGrid,
  Type,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Video,
  Link2,
  Inbox,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
import { useToast } from '@/hooks/use-toast'
import { useState, useMemo, useEffect, useRef, useCallback, type DragEvent as ReactDragEvent } from 'react'
import { MemoryCard } from '@/components/inbox/memory-card'
import { ExpandableInput, type ExpandableInputHandle } from '@/components/inbox/expandable-input'
import { SearchDialog, SearchFilters } from '@/components/shared/search-dialog'
import { DashboardFilterBar, FilterPillButton } from '@/components/shared/filter-bar'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'
import { resolveCategoryColor, resolveCategoryIconName } from '@/lib/category-appearance'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'

// 媒体类型配置
const contentTypeFilters = [
  { id: 'all', icon: LayoutGrid },
  { id: 'text', icon: Type },
  { id: 'url', icon: Link2 },
  { id: 'image', icon: ImageIcon },
  { id: 'audio', icon: Mic },
  { id: 'video', icon: Video },
  { id: 'file', icon: Paperclip },
] as const

const CARD_VERTICAL_SPACING = 16
const FALLBACK_CARD_HEIGHT = 232
const MAX_VISUAL_DRIFT_PX = 120

function estimateCardHeight(item: Item): number {
  const mimeType = item.mimeType?.toLowerCase() ?? ''
  const hasMultipleFiles = Boolean(item.allFiles && item.allFiles.length > 1)
  const hasSingleFile = Boolean(item.hasFile || (item.allFiles?.length ?? 0) === 1)

  let estimated = FALLBACK_CARD_HEIGHT

  if (hasMultipleFiles) {
    estimated += 126
  } else if (hasSingleFile) {
    if (mimeType.startsWith('image/') || item.contentType === ContentType.IMAGE) {
      estimated += 138
    } else if (mimeType.startsWith('video/') || item.contentType === ContentType.VIDEO) {
      estimated += 132
    } else if (mimeType.startsWith('audio/') || item.contentType === ContentType.AUDIO) {
      estimated += 108
    } else {
      estimated += 88
    }
  }

  const contentLength = item.content?.length ?? 0
  estimated += Math.min(56, Math.floor(contentLength / 40) * 8)

  return estimated
}

function selectColumnIndex(
  columnHeights: number[],
  columnItemCounts: number[],
  nextCardHeight: number
): number {
  const firstEmptyColumn = columnItemCounts.findIndex((count) => count === 0)
  if (firstEmptyColumn >= 0) {
    return firstEmptyColumn
  }

  let bestColumnIndex = 0
  let bestColumnScore = Number.POSITIVE_INFINITY

  columnHeights.forEach((height, index) => {
    const projectedHeights = columnHeights.map((value, columnIndex) => (
      columnIndex === index ? value + nextCardHeight : value
    ))

    const projectedMax = Math.max(...projectedHeights)
    const projectedMin = Math.min(...projectedHeights)
    const projectedDrift = projectedMax - projectedMin
    const driftOverflow = Math.max(0, projectedDrift - MAX_VISUAL_DRIFT_PX)
    const projectedHeight = height + nextCardHeight
    const score = driftOverflow * 10 + projectedHeight

    if (score < bestColumnScore) {
      bestColumnScore = score
      bestColumnIndex = index
    }
  })

  return bestColumnIndex
}

export default function InboxPage() {
  const t = useTranslations('inbox')
  const filtersT = useTranslations('inbox.contentTypeFilters')
  const searchT = useTranslations('commandSearch')
  const common = useTranslations('common')
  const time = useTranslations('time')
  const errors = useTranslations('errors')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ query: '' })
  const [activeType, setActiveType] = useState<string>('all')
  const [createdItemId, setCreatedItemId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(1)
  const [itemHeights, setItemHeights] = useState<Record<string, number>>({})
  const [isDesktopViewport, setIsDesktopViewport] = useState(false)
  const [isPageDragActive, setIsPageDragActive] = useState(false)
  const [isDragOverComposerZone, setIsDragOverComposerZone] = useState(false)
  const desktopComposerRef = useRef<ExpandableInputHandle | null>(null)
  const mobileComposerRef = useRef<ExpandableInputHandle | null>(null)
  const desktopDropZoneRef = useRef<HTMLDivElement | null>(null)
  const composerDragDepthRef = useRef(0)
  const dragAutoExpandedRef = useRef(false)

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

  const handleSearchFiltersChange = useCallback((nextFilters: SearchFilters) => {
    setSearchFilters(nextFilters)
    setActiveType(nextFilters.hasType ?? 'all')
  }, [])

  const handleContentTypeFilterChange = useCallback((typeId: string) => {
    setActiveType(typeId)
    setSearchFilters((prev) => ({
      ...prev,
      hasType: typeId === 'all' ? undefined : (typeId as SearchFilters['hasType']),
    }))
  }, [])

  const handleClearSearchQuery = useCallback(() => {
    setSearchFilters((prev) => ({
      ...prev,
      query: '',
    }))
  }, [])

  useEffect(() => {
    const getColumnCount = () => {
      const width = window.innerWidth
      if (width >= 1280) return 3
      if (width >= 768) return 2
      return 1
    }

    const updateColumnCount = () => {
      const nextCount = getColumnCount()
      setColumnCount((current) => (current === nextCount ? current : nextCount))
    }

    updateColumnCount()
    window.addEventListener('resize', updateColumnCount)
    return () => window.removeEventListener('resize', updateColumnCount)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia('(min-width: 768px)')
    const updateViewport = () => setIsDesktopViewport(media.matches)

    updateViewport()
    if (media.addEventListener) {
      media.addEventListener('change', updateViewport)
      return () => media.removeEventListener('change', updateViewport)
    }

    media.addListener(updateViewport)
    return () => media.removeListener(updateViewport)
  }, [])


  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: mcpConnectorsData } = useQuery({
    queryKey: ['mcp-connectors-list'],
    queryFn: () => mcpConnectorsApi.list(),
    staleTime: 5 * 60 * 1000,
  })

  // 使用数据缓存避免重复创建数组引用
  const categories = useMemo(() => categoriesData?.data || [], [categoriesData?.data])
  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories]
  )
  const categoryMetaMap = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.key,
        {
          name: category.name,
          icon: resolveCategoryIconName(category.key, category.icon),
          color: resolveCategoryColor(category.key, category.color),
        },
      ])
    )
  }, [categories])

  const categoryLabelMap = useMemo(() => {
    return new Map(
      Array.from(categoryMetaMap.entries()).map(([key, meta]) => [key, meta.name])
    )
  }, [categoryMetaMap])

  const connectorMetaMap = useMemo(() => {
    const map = new Map<string, { name: string; serverType?: string; logoColor?: string }>()
    const connectorItems = mcpConnectorsData?.data || []

    connectorItems.forEach((connector) => {
      const id = String(connector.id ?? '').trim()
      const name = String(connector.name ?? '').trim()
      if (!id || !name) return

      map.set(id, {
        name,
        serverType: String(connector.serverType ?? '').trim() || undefined,
        logoColor: String(connector.logoColor ?? '').trim() || undefined,
      })
    })

    return map
  }, [mcpConnectorsData?.data])

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

  useEffect(() => {
    const visibleIds = new Set(items.map((item) => item.id))

    setItemHeights((previous) => {
      let hasRemovedEntries = false
      const next: Record<string, number> = {}

      Object.entries(previous).forEach(([itemId, height]) => {
        if (visibleIds.has(itemId)) {
          next[itemId] = height
        } else {
          hasRemovedEntries = true
        }
      })

      return hasRemovedEntries ? next : previous
    })
  }, [items])

  const handleItemHeightChange = useCallback((itemId: string, nextHeight: number) => {
    const normalizedHeight = Math.max(FALLBACK_CARD_HEIGHT, Math.round(nextHeight))

    setItemHeights((previous) => {
      const currentHeight = previous[itemId]
      if (currentHeight && Math.abs(currentHeight - normalizedHeight) < 4) {
        return previous
      }

      return {
        ...previous,
        [itemId]: normalizedHeight,
      }
    })
  }, [])

  const getActiveComposer = useCallback(() => {
    if (isDesktopViewport) {
      return desktopComposerRef.current || mobileComposerRef.current
    }
    return mobileComposerRef.current || desktopComposerRef.current
  }, [isDesktopViewport])

  const appendFilesToCompose = useCallback((files: File[]) => {
    if (files.length === 0) return

    const composer = getActiveComposer()
    composer?.appendFiles(files)
  }, [getActiveComposer])

  const hasFileDragData = useCallback((dataTransfer?: DataTransfer | null) => {
    return Array.from(dataTransfer?.types ?? []).includes('Files')
  }, [])

  const ensureDesktopComposerExpandedForDrag = useCallback(() => {
    if (dragAutoExpandedRef.current) return
    desktopComposerRef.current?.focusComposer()
    dragAutoExpandedRef.current = true
  }, [])

  const collapseDesktopComposerIfEmpty = useCallback(() => {
    desktopComposerRef.current?.collapseComposerIfEmpty()
  }, [])

  const clearPageDragState = useCallback(() => {
    composerDragDepthRef.current = 0
    dragAutoExpandedRef.current = false
    setIsPageDragActive(false)
    setIsDragOverComposerZone(false)
  }, [])

  const isDropInsideComposerZone = useCallback((clientX: number, clientY: number) => {
    const zone = desktopDropZoneRef.current
    if (!zone) return false

    const rect = zone.getBoundingClientRect()
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    )
  }, [])

  const handleComposerDragEnter = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!isDesktopViewport || !hasFileDragData(event.dataTransfer)) return
    event.preventDefault()
    ensureDesktopComposerExpandedForDrag()
    composerDragDepthRef.current += 1
    setIsPageDragActive(true)
    setIsDragOverComposerZone(true)
  }, [isDesktopViewport, hasFileDragData, ensureDesktopComposerExpandedForDrag])

  const handleComposerDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!isDesktopViewport || !hasFileDragData(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsPageDragActive(true)
    setIsDragOverComposerZone(true)
  }, [isDesktopViewport, hasFileDragData])

  const handleComposerDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!isDesktopViewport || !hasFileDragData(event.dataTransfer)) return
    event.preventDefault()
    composerDragDepthRef.current = Math.max(0, composerDragDepthRef.current - 1)
    if (composerDragDepthRef.current === 0) {
      setIsDragOverComposerZone(false)
    }
  }, [isDesktopViewport, hasFileDragData])

  const handleComposerDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!isDesktopViewport || !hasFileDragData(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()

    const droppedFiles = Array.from(event.dataTransfer.files ?? [])
    clearPageDragState()

    if (droppedFiles.length === 0) return
    appendFilesToCompose(droppedFiles)
  }, [isDesktopViewport, hasFileDragData, clearPageDragState, appendFilesToCompose])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isDesktopViewport) {
      clearPageDragState()
      return
    }

    const handleWindowDragEnter = (event: DragEvent) => {
      if (!hasFileDragData(event.dataTransfer)) return
      event.preventDefault()
      ensureDesktopComposerExpandedForDrag()
      setIsPageDragActive(true)
    }

    const handleWindowDragOver = (event: DragEvent) => {
      if (!hasFileDragData(event.dataTransfer)) return
      event.preventDefault()
      ensureDesktopComposerExpandedForDrag()
      setIsPageDragActive(true)
      setIsDragOverComposerZone(isDropInsideComposerZone(event.clientX, event.clientY))
    }

    const handleWindowDragLeave = (event: DragEvent) => {
      if (!hasFileDragData(event.dataTransfer)) return
      const isLeavingWindow = (
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= window.innerWidth ||
        event.clientY >= window.innerHeight
      )
      if (!isLeavingWindow) return
      clearPageDragState()
      collapseDesktopComposerIfEmpty()
    }

    const handleWindowDrop = (event: DragEvent) => {
      if (!hasFileDragData(event.dataTransfer)) return
      const droppedInsideComposer = isDropInsideComposerZone(event.clientX, event.clientY)
      if (droppedInsideComposer) return

      event.preventDefault()
      clearPageDragState()
      collapseDesktopComposerIfEmpty()
    }

    window.addEventListener('dragenter', handleWindowDragEnter)
    window.addEventListener('dragover', handleWindowDragOver)
    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('drop', handleWindowDrop)

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter)
      window.removeEventListener('dragover', handleWindowDragOver)
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('drop', handleWindowDrop)
    }
  }, [
    isDesktopViewport,
    hasFileDragData,
    clearPageDragState,
    ensureDesktopComposerExpandedForDrag,
    collapseDesktopComposerIfEmpty,
    isDropInsideComposerZone,
  ])

  const columns = useMemo(() => {
    const columnItems: Item[][] = Array.from({ length: columnCount }, () => [])

    if (columnCount <= 1) {
      columnItems[0] = items
      return columnItems
    }

    const columnHeights = Array.from({ length: columnCount }, () => 0)
    const columnItemCounts = Array.from({ length: columnCount }, () => 0)

    items.forEach((item) => {
      const measuredHeight = itemHeights[item.id]
      const cardHeight = (measuredHeight ?? estimateCardHeight(item)) + CARD_VERTICAL_SPACING
      const targetColumn = selectColumnIndex(columnHeights, columnItemCounts, cardHeight)

      columnItems[targetColumn].push(item)
      columnHeights[targetColumn] += cardHeight
      columnItemCounts[targetColumn] += 1
    })

    return columnItems
  }, [items, columnCount, itemHeights])

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

  const invalidateInboxRelatedQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['inbox'] })
    queryClient.invalidateQueries({ queryKey: ['inbox-counts'] })
  }, [queryClient])

  // 删除 mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id)
      await inboxApi.deleteItem(id)
    },
    onSuccess: () => {
      invalidateInboxRelatedQueries()
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
    const qs = searchParams.toString()
    router.push(qs ? `/inbox/${item.id}?${qs}` : `/inbox/${item.id}`)
  }

  // 编辑条目
  const handleEdit = (item: Item) => {
    const qs = searchParams.toString()
    router.push(qs ? `/inbox/${item.id}?${qs}` : `/inbox/${item.id}`)
  }

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
      invalidateInboxRelatedQueries()
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

  const normalizedQuery = searchFilters.query?.trim() || ''
  const hasSearchQuery = normalizedQuery.length > 0
  const displayQuery = normalizedQuery.length > 24
    ? `${normalizedQuery.slice(0, 24)}...`
    : normalizedQuery

  return (
    <div className="relative h-full flex flex-col bg-background">
      {/* 顶部区域：标题、搜索、类型筛选 */}
      {/* playground 风格：移除固定容器限制，让输入框可以自由定位 */}
      <div
        ref={desktopDropZoneRef}
        className="hidden md:sticky md:top-14 md:z-30 md:block shrink-0 px-4 md:px-6 pt-6 pb-4 bg-card/70 dark:bg-background/50 backdrop-blur-xl relative"
        onDragEnter={handleComposerDragEnter}
        onDragOver={handleComposerDragOver}
        onDragLeave={handleComposerDragLeave}
        onDrop={handleComposerDrop}
      >
        <AnimatePresence>
          {isPageDragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 z-[28]"
            >
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[1.5px]" />
              <div className="absolute inset-3 rounded-2xl border border-dashed border-white/30 bg-white/[0.03] dark:bg-white/[0.025] md:inset-4" />
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <motion.p
                  animate={isDragOverComposerZone
                    ? { opacity: 1, scale: 1 }
                    : { opacity: [0.38, 0.72, 0.38], scale: [0.992, 1, 0.992] }}
                  transition={isDragOverComposerZone
                    ? { duration: 0.14, ease: 'easeOut' }
                    : { duration: 1.75, repeat: Infinity, ease: 'easeInOut' }}
                  className={cn(
                    'px-6 py-2.5 text-base font-semibold tracking-[0.08em] transition-colors duration-150',
                    isDragOverComposerZone
                      ? 'text-white [text-shadow:0_0_18px_rgba(255,255,255,0.38)]'
                      : 'text-white/46 [text-shadow:0_0_10px_rgba(255,255,255,0.12)]'
                  )}
                >
                  {t('dragOverlay.title')}
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ExpandableInput
          ref={desktopComposerRef}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
          dropTargetActive={isDragOverComposerZone}
        />
      </div>

      <div className="md:hidden">
        <ExpandableInput
          ref={mobileComposerRef}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
          dropTargetActive={false}
        />
      </div>

      {/* 搜索对话框 */}
      <SearchDialog
        filters={searchFilters}
        onFiltersChange={handleSearchFiltersChange}
        availableSources={availableSources}
        availableCategories={activeCategories.map((category) => ({
          key: category.key,
          name: category.name,
        }))}
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
      />

      {/* 结果区域 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/20 dark:bg-background/40">
        <DashboardFilterBar className="gap-2 pb-3.5 md:gap-4 md:pb-4">
          <div className="flex items-center gap-2 min-w-0 flex-wrap md:flex-nowrap md:shrink-0">
            <span className="text-lg md:text-xl font-semibold tracking-tight shrink-0">
              {currentCategoryLabel}
            </span>
            {hasSearchQuery ? (
              <div className="inline-flex h-9 shrink-0 items-center overflow-hidden rounded-xl bg-black/5 opacity-50 transition-opacity hover:opacity-90 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="flex h-full items-center gap-2 px-3 md:px-4 text-[10px] md:text-[11px] font-semibold text-foreground/75 dark:text-white/75"
                  aria-label={searchT('title') || 'Search'}
                >
                  <Search className="h-[11px] w-[11px] shrink-0" />
                  <span className="max-w-[180px] truncate">{t('searchKeywordSuffix', { query: displayQuery })}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSearchQuery}
                  className="h-full w-9 shrink-0 text-foreground/55 hover:bg-black/[0.06] hover:text-foreground/75 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white/75"
                  aria-label={t('clearSearchQuery')}
                >
                  <X className="h-3.5 w-3.5 mx-auto" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="h-9 w-9 shrink-0 rounded-xl text-foreground/80 opacity-70 hover:opacity-100 hover:bg-current/5"
                aria-label={searchT('title') || 'Search'}
              >
                <Search className="h-4 w-4 mx-auto" />
              </button>
            )}
            {totalCount > 0 && (
              <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-black/[0.03] px-3 text-xs font-bold text-foreground/70 shrink-0 dark:bg-white/[0.04] dark:text-white/70">
                {totalCount}
              </span>
            )}
          </div>
          {/* 媒体类型筛选 Pills */}
          <div className="flex items-center gap-2 overflow-x-auto min-w-0 md:flex-1 md:justify-end">
            {contentTypeFilters.map((type) => (
              <FilterPillButton
                key={type.id}
                onClick={() => handleContentTypeFilterChange(type.id)}
                active={activeType === type.id}
                className="flex items-center gap-2 shrink-0"
              >
                <type.icon size={11} />
                <span>{filtersT(type.id)}</span>
              </FilterPillButton>
            ))}
          </div>
        </DashboardFilterBar>
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
            {/* 瀑布流布局 - 按列分配数据避免新旧混排 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4">
              {columns.map((columnItems, columnIndex) => (
                <div key={`column-${columnIndex}`} className="flex flex-col">
                  <AnimatePresence mode="popLayout">
                    {columnItems.map((item) => (
                      <MemoryCard
                        key={item.id}
                        item={item}
                        categoryLabelMap={categoryLabelMap}
                        categoryMetaMap={categoryMetaMap}
                        connectorMetaMap={connectorMetaMap}
                        onDelete={handleDelete}
                        onRetry={handleRetry}
                        onEdit={handleEdit}
                        onRedistribute={(id) => redistributeMutation.mutate(id)}
                        onViewDetail={handleViewDetail}
                        onHeightChange={handleItemHeightChange}
                        deletingId={deletingId}
                        retryingId={retryingId}
                        animationVariant={item.id === createdItemId ? 'elastic' : 'fade'}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ))}
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
