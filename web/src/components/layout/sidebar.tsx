"use client"

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import {
  Inbox,
  GitBranch,
  Plug,
  Cpu,
  LogOut,
  Languages,
  Moon,
  Sun,
  LayoutDashboard,
  Settings,
  Key,
  Shield,
  BarChart3,
  MoreVertical,
  PanelLeft,
  ArrowUp,
  ArrowDown,
  Check,
  GripVertical,
  X,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
  type ComponentType,
  type DragEvent as ReactDragEvent,
} from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from '@/lib/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from 'next-themes'
import { getCategoryIconComponent, getCategorySoftStyle } from '@/lib/category-appearance'
import type { Category } from '@/types'

// Gmail 风格的导航项组件
interface NavItemProps {
  id: string
  label: string
  icon: ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
  href: string
  iconStyle?: CSSProperties
  isActive: boolean
  count?: number
  collapsed?: boolean
  onNavigate?: () => void
}

function NavItem({ label, icon: Icon, href, iconStyle, isActive, count, collapsed, onNavigate }: NavItemProps) {
  return (
    <SidebarMenuItem>
      <Link
        href={href}
        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-xl transition-all group ${
          isActive
            ? 'font-bold text-foreground bg-black/5 dark:bg-white/10'
            : 'text-foreground/80 opacity-60 hover:opacity-100 hover:bg-current/5'
        } ${collapsed ? 'justify-center px-2' : ''}`}
        title={collapsed ? label : undefined}
        onClick={onNavigate}
      >
          <div className={`flex items-center gap-3 ${collapsed ? '' : ''}`}>
            <div
              className="p-1.5 rounded-lg transition-colors"
              style={isActive ? iconStyle : undefined}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            </div>
            {!collapsed && <span className="text-sm tracking-tight">{label}</span>}
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2">
              {count !== undefined && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-muted text-foreground/70 dark:bg-white/10">
                  {count}
                </span>
              )}
            </div>
          )}
      </Link>
    </SidebarMenuItem>
  )
}

interface AppSidebarProps {
  className?: string
}

const UNKNOWN_CATEGORY_KEY = 'unknown'
const TRASH_CATEGORY_KEY = 'trash'

const normalizeCategoryKey = (category: Pick<Category, 'key'> | null | undefined) =>
  category?.key?.trim().toLowerCase() ?? ''

const isUnknownCategory = (category: Pick<Category, 'key'> | null | undefined) => {
  return normalizeCategoryKey(category) === UNKNOWN_CATEGORY_KEY
}

const isTrashCategory = (category: Pick<Category, 'key'> | null | undefined) => {
  return normalizeCategoryKey(category) === TRASH_CATEGORY_KEY
}

const isSystemCategory = (category: Pick<Category, 'key'> | null | undefined) => {
  return isUnknownCategory(category) || isTrashCategory(category)
}

const compareCategoryOrder = (a: Category, b: Category) => {
  const systemOrder = (category: Category) => {
    if (isUnknownCategory(category)) return 1
    if (isTrashCategory(category)) return 2
    return 0
  }

  const aSystemOrder = systemOrder(a)
  const bSystemOrder = systemOrder(b)
  const aIsSystem = aSystemOrder > 0
  const bIsSystem = bSystemOrder > 0

  if (aIsSystem !== bIsSystem) {
    return aIsSystem ? 1 : -1
  }

  if (aIsSystem && bIsSystem) {
    return aSystemOrder - bSystemOrder
  }

  const aSortOrder = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER
  const bSortOrder = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER
  if (aSortOrder !== bSortOrder) {
    return aSortOrder - bSortOrder
  }

  return a.createdAt.localeCompare(b.createdAt)
}

export function AppSidebar({ className }: AppSidebarProps) {
  const t = useTranslations('sidebar')
  const headerT = useTranslations('header')
  const pathname = usePathname()
  const currentLocale = useLocale()
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { setOpenMobile } = useSidebar()
  const { authState, logout } = useAuth()
  const { toast } = useToast()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isDesktopViewport, setIsDesktopViewport] = useState(false)
  const [isIntentSortMode, setIsIntentSortMode] = useState(false)
  const [intentOrderDraft, setIntentOrderDraft] = useState<string[]>([])
  const [isSavingIntentOrder, setIsSavingIntentOrder] = useState(false)
  const [draggingIntentId, setDraggingIntentId] = useState<string | null>(null)
  const [dragOverIntentId, setDragOverIntentId] = useState<string | null>(null)

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false)
    setOpenMobile(false)
  }, [setOpenMobile])

  useEffect(() => {
    if (!isMobileOpen) return

    const mobileRouter = router as { prefetch?: (href: string) => void }
    mobileRouter.prefetch?.('/settings/mobile')
  }, [isMobileOpen, router])

  const searchParamsKey = searchParams?.toString() ?? ''

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    closeMobileSidebar()

    try {
      await logout()
      toast({
        title: headerT('logout.success'),
      })
    } catch (error) {
      toast({
        title: headerT('logout.failure'),
        variant: "destructive",
      })
    }
  }

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === currentLocale) return
    closeMobileSidebar()
    const localePattern = new RegExp(`^/(${['zh-CN', 'en'].join('|')})(?=/|$)`)
    const currentPath = window.location.pathname.replace(localePattern, '') || '/'
    window.location.href = `/${nextLocale}${currentPath}`
  }

  const handleNavigate = (path: string) => {
    closeMobileSidebar()
    router.push(path)
  }

  const isDark = mounted && resolvedTheme === "dark"
  const userName = authState.user?.username || headerT('userFallback')
  const userEmail = authState.user?.email || headerT('userFallback')
  const userInitials = userName.slice(0, 2).toUpperCase()

  // 响应式检测：sm 以下关闭移动端抽屉
  useEffect(() => {
    const checkScreenSize = () => {
      const isDesktop = window.innerWidth >= 768
      setIsDesktopViewport(isDesktop)

      if (isDesktop) {
        closeMobileSidebar()
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [closeMobileSidebar])

  useEffect(() => {
    closeMobileSidebar()
  }, [pathname, searchParamsKey, closeMobileSidebar])

  // 从 API 获取 categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const categories = useMemo(() => {
    const source = categoriesData?.data || []
    return [...source].sort(compareCategoryOrder)
  }, [categoriesData?.data])

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories]
  )

  const unknownCategory = useMemo(
    () => categories.find((category) => isUnknownCategory(category)) ?? null,
    [categories]
  )

  const trashCategory = useMemo(
    () => categories.find((category) => isTrashCategory(category)) ?? null,
    [categories]
  )

  const visibleIntentCategories = useMemo(() => {
    const categoryMap = new Map<string, Category>()
    activeCategories.forEach((category) => categoryMap.set(category.id, category))
    if (trashCategory) {
      categoryMap.set(trashCategory.id, trashCategory)
    }
    return [...categoryMap.values()].sort(compareCategoryOrder)
  }, [activeCategories, trashCategory])

  const knownActiveCategories = useMemo(
    () => activeCategories.filter((category) => !isSystemCategory(category)),
    [activeCategories]
  )

  const fixedSystemCategories = useMemo(
    () =>
      [unknownCategory, trashCategory].filter(
        (category): category is Category => Boolean(category)
      ),
    [trashCategory, unknownCategory]
  )

  useEffect(() => {
    if (!isIntentSortMode) {
      setIntentOrderDraft(knownActiveCategories.map((category) => category.id))
      setDraggingIntentId(null)
      setDragOverIntentId(null)
    }
  }, [isIntentSortMode, knownActiveCategories])

  const { data: countData } = useQuery({
    queryKey: ['inbox-counts', categories.map((category) => category.key).join(',')],
    queryFn: async () => {
      const inboxResponse = await inboxApi.getItems({ limit: 1 })
      const inboxTotal = inboxResponse.data?.total ?? 0

      const categoryTotals = new Map<string, number>()
      await Promise.all(
        categories.map(async (category) => {
          const response = await inboxApi.getItems({ category: category.key, limit: 1 })
          categoryTotals.set(category.key, response.data?.total ?? 0)
        })
      )

      return {
        inboxTotal,
        categoryTotals,
      }
    },
    enabled: categories.length > 0,
    staleTime: 60 * 1000,
  })

  const activeCategory = searchParams?.get('category')

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/settings') return pathname === '/settings'
    if (href.startsWith('/inbox?category=')) {
      const targetCategory = href.split('category=')[1]
      return pathname === '/inbox' && activeCategory === targetCategory
    }
    if (href === '/inbox') {
      return pathname === '/inbox' && !activeCategory
    }
    return pathname === href || pathname?.startsWith(href + '/')
  }

  const canSortIntents = knownActiveCategories.length > 1
  const currentIntentOrder = knownActiveCategories.map((category) => category.id)
  const hasIntentOrderChanges =
    intentOrderDraft.length !== currentIntentOrder.length ||
    intentOrderDraft.some((id, index) => id !== currentIntentOrder[index])
  const isDesktopIntentSort = isIntentSortMode && isDesktopViewport

  const handleOpenIntentSortMode = () => {
    setIntentOrderDraft(currentIntentOrder)
    setDraggingIntentId(null)
    setDragOverIntentId(null)
    setIsIntentSortMode(true)
  }

  const handleCancelIntentSortMode = () => {
    setIntentOrderDraft(currentIntentOrder)
    setDraggingIntentId(null)
    setDragOverIntentId(null)
    setIsIntentSortMode(false)
  }

  const moveIntentOrder = (categoryId: string, direction: -1 | 1) => {
    setIntentOrderDraft((prev) => {
      const currentIndex = prev.indexOf(categoryId)
      const targetIndex = currentIndex + direction

      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= prev.length) {
        return prev
      }

      const next = [...prev]
      const [item] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
  }

  const handleIntentDragStart = (event: ReactDragEvent<HTMLDivElement>, categoryId: string) => {
    if (!isDesktopIntentSort || isSavingIntentOrder) {
      event.preventDefault()
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', categoryId)
    setDraggingIntentId(categoryId)
    setDragOverIntentId(categoryId)
  }

  const handleIntentDragOver = (event: ReactDragEvent<HTMLDivElement>, categoryId: string) => {
    if (!draggingIntentId || draggingIntentId === categoryId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (dragOverIntentId !== categoryId) {
      setDragOverIntentId(categoryId)
    }
  }

  const handleIntentDrop = (event: ReactDragEvent<HTMLDivElement>, categoryId: string) => {
    event.preventDefault()

    if (!draggingIntentId || draggingIntentId === categoryId) {
      setDraggingIntentId(null)
      setDragOverIntentId(null)
      return
    }

    setIntentOrderDraft((prev) => {
      const fromIndex = prev.indexOf(draggingIntentId)
      const toIndex = prev.indexOf(categoryId)

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return prev
      }

      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      return next
    })

    setDraggingIntentId(null)
    setDragOverIntentId(null)
  }

  const handleIntentDragEnd = () => {
    setDraggingIntentId(null)
    setDragOverIntentId(null)
  }

  const handleSaveIntentOrder = async () => {
    if (!hasIntentOrderChanges || isSavingIntentOrder) {
      setDraggingIntentId(null)
      setDragOverIntentId(null)
      setIsIntentSortMode(false)
      return
    }

    const nextSortOrderById = new Map(
      intentOrderDraft.map((id, index) => [id, index + 1])
    )

    const updateTargets = knownActiveCategories
      .map((category) => ({
        id: category.id,
        nextSortOrder: nextSortOrderById.get(category.id),
        currentSortOrder: category.sortOrder,
      }))
      .filter(
        (item): item is { id: string; nextSortOrder: number; currentSortOrder: number | undefined } =>
          typeof item.nextSortOrder === 'number' && item.currentSortOrder !== item.nextSortOrder
      )

    if (updateTargets.length === 0) {
      setDraggingIntentId(null)
      setDragOverIntentId(null)
      setIsIntentSortMode(false)
      return
    }

    setIsSavingIntentOrder(true)

    try {
      await Promise.all(
        updateTargets.map((item) =>
          categoriesApi.update(item.id, {
            sortOrder: item.nextSortOrder,
          })
        )
      )

      await queryClient.invalidateQueries({ queryKey: ['categories'] })

      setDraggingIntentId(null)
      setDragOverIntentId(null)
      setIsIntentSortMode(false)
      toast({
        title: t('sorting.saved'),
      })
    } catch (error) {
      toast({
        title: t('sorting.saveFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsSavingIntentOrder(false)
    }
  }

  const intentDraftCategories = useMemo(() => {
    const categoryMap = new Map(knownActiveCategories.map((category) => [category.id, category]))
    return intentOrderDraft
      .map((id) => categoryMap.get(id))
      .filter((category): category is Category => Boolean(category))
  }, [knownActiveCategories, intentOrderDraft])

  const isMobileViewport = mounted && !isDesktopViewport

  // Mailbox 分组
  const mailboxItems = [
    { id: 'inbox', label: t('items.inbox') || 'All Memories', href: '/inbox', icon: Inbox, count: countData?.inboxTotal ?? 0 },
  ]

  // Intents (AI Labels) 分组 - 基于 API 返回的 categories
  const intentItems = useMemo(() => {
    if (visibleIntentCategories.length === 0) {
      const fallback = [
        { key: 'todo', label: 'Todo' },
        { key: 'idea', label: 'Idea' },
        { key: 'expense', label: 'Expense' },
        { key: 'schedule', label: 'Schedule' },
        { key: 'note', label: 'Note' },
        { key: 'bookmark', label: 'Bookmark' },
      ]

      return fallback.map((category) => ({
        id: category.key,
        label: category.label,
        href: `/inbox?category=${category.key}`,
        icon: getCategoryIconComponent(undefined, category.key),
        iconStyle: getCategorySoftStyle(category.key, undefined, isDark ? 'dark' : 'light'),
        count: 0,
      }))
    }

    return visibleIntentCategories.map((category) => ({
      id: category.key,
      label: category.name,
      href: `/inbox?category=${category.key}`,
      icon: getCategoryIconComponent(category.icon, category.key),
      iconStyle: getCategorySoftStyle(category.key, category.color, isDark ? 'dark' : 'light'),
      count: countData?.categoryTotals?.get(category.key) ?? 0,
    }))
  }, [countData, isDark, visibleIntentCategories])

  // Management 分组
  const managementItems = [
    { id: 'categories', label: t('items.categories') || 'Categories', href: '/category', icon: Cpu },
    { id: 'routing', label: t('items.routing') || 'Routing', href: '/routing', icon: GitBranch },
    { id: 'connections', label: t('items.connections') || 'Connections', href: '/mcp-adapters', icon: Plug },
  ]

  return (
    <>
      {/* 移动端抽屉遮罩 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* 主侧边栏 */}
      <Sidebar
        className={cn(
          "border-r border-black/[0.03] dark:border-white/[0.03] bg-[#f5f5f7] dark:bg-[#0b0b0f]",
          "[&_[data-sidebar=sidebar]]:bg-[#f5f5f7] dark:[&_[data-sidebar=sidebar]]:bg-[#0b0b0f]",
          // 三阶段响应式
          "hidden md:block",
          "w-64 min-w-64 max-w-64",
          // 移动端抽屉模式
          isMobileOpen && "fixed inset-y-0 left-0 z-50 w-64 min-w-64 max-w-64 block md:hidden",
          className
        )}
      >
        {/* 移动端关闭按钮 */}
        {isMobileOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8 rounded-lg md:hidden"
            onClick={closeMobileSidebar}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}

        <SidebarHeader className="px-2 pt-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-9 gap-2">
                <Link href="/inbox" onClick={closeMobileSidebar}>
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground shadow-lg">
                    <Inbox className="h-4 w-4" />
                  </div>
                  <span className="text-base font-black tracking-tight uppercase">SuperInbox</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="px-2 pt-2">
          {/* Mailbox Section */}
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {mailboxItems.map((item) => (
                  <NavItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    href={item.href}
                    icon={item.icon}
                    isActive={isActive(item.href)}
                    count={item.count}
                    onNavigate={closeMobileSidebar}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Intents Section */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="mb-2 px-3">
              <div className="flex w-full items-center justify-between gap-2">
                <span className="opacity-20 font-black uppercase text-[10px] tracking-widest">
                  {t('sections.intents')}
                </span>
                {!isIntentSortMode ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 gap-1 px-1 text-[10px] font-normal text-muted-foreground/55 hover:text-muted-foreground"
                    onClick={handleOpenIntentSortMode}
                    disabled={!canSortIntents}
                    title={canSortIntents ? t('sorting.edit') : t('sorting.disabled')}
                  >
                    <span>{t('sorting.edit')}</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={handleCancelIntentSortMode}
                      disabled={isSavingIntentOrder}
                      title={t('sorting.cancel')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleSaveIntentOrder}
                      disabled={!hasIntentOrderChanges || isSavingIntentOrder}
                      title={t('sorting.save')}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {!isIntentSortMode ? (
                <SidebarMenu className="space-y-0.5">
                  {intentItems.map((item) => (
                    <NavItem
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      href={item.href}
                      icon={item.icon}
                      iconStyle={item.iconStyle}
                      isActive={isActive(item.href)}
                      count={item.count}
                      onNavigate={closeMobileSidebar}
                    />
                  ))}
                </SidebarMenu>
              ) : (
                <>
                  <SidebarMenu className="space-y-1">
                    {intentDraftCategories.map((category, index) => {
                      const Icon = getCategoryIconComponent(category.icon, category.key)
                      const iconStyle = getCategorySoftStyle(
                        category.key,
                        category.color,
                        isDark ? 'dark' : 'light'
                      )
                      const isDragging = draggingIntentId === category.id
                      const isDragOver =
                        dragOverIntentId === category.id && draggingIntentId !== category.id

                      return (
                        <SidebarMenuItem key={category.id}>
                          <div
                            className={cn(
                              'flex items-center gap-2 rounded-xl border border-border bg-background/70 px-2 py-1.5 transition-colors',
                              isDesktopIntentSort && 'cursor-grab active:cursor-grabbing',
                              isDragging && 'opacity-45',
                              isDragOver && 'border-primary/60 bg-primary/10'
                            )}
                            draggable={isDesktopIntentSort && !isSavingIntentOrder}
                            onDragStart={(event) => handleIntentDragStart(event, category.id)}
                            onDragOver={(event) => handleIntentDragOver(event, category.id)}
                            onDrop={(event) => handleIntentDrop(event, category.id)}
                            onDragEnd={handleIntentDragEnd}
                          >
                            <GripVertical
                              className={cn(
                                'h-3.5 w-3.5',
                                isDesktopIntentSort
                                  ? 'text-muted-foreground/65'
                                  : 'text-muted-foreground/45'
                              )}
                            />
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                style={iconStyle}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="truncate text-sm text-foreground">{category.name}</span>
                            </div>
                            <div className="flex items-center gap-1 md:hidden">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveIntentOrder(category.id, -1)}
                                disabled={index === 0 || isSavingIntentOrder}
                                title={t('sorting.moveUp')}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveIntentOrder(category.id, 1)}
                                disabled={index === intentDraftCategories.length - 1 || isSavingIntentOrder}
                                title={t('sorting.moveDown')}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </SidebarMenuItem>
                      )
                    })}
                    {fixedSystemCategories.map((category) => {
                      const Icon = getCategoryIconComponent(category.icon, category.key)
                      return (
                        <SidebarMenuItem key={category.id}>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-2 py-1.5 opacity-75">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                style={getCategorySoftStyle(
                                  category.key,
                                  category.color,
                                  isDark ? 'dark' : 'light'
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="truncate text-sm text-foreground">
                                {category.name}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {t('sorting.fixedBottom')}
                            </span>
                          </div>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                  <p className="px-3 pt-2 text-[10px] text-muted-foreground">
                    {t('sorting.hint')}
                  </p>
                </>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Management Section */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-3 mb-2 opacity-20 font-black uppercase text-[10px] tracking-widest">
              {t('sections.management')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {managementItems.map((item) => (
                  <NavItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    href={item.href}
                    icon={item.icon}
                    isActive={isActive(item.href)}
                    onNavigate={closeMobileSidebar}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-black/[0.03] dark:border-white/[0.03] px-4 py-3">
          <SidebarMenu>
            <SidebarMenuItem>
              {isMobileViewport ? (
                <SidebarMenuButton
                  asChild
                  size="lg"
                  className={cn(
                    'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground',
                    pathname.startsWith('/settings/mobile') && 'bg-sidebar-accent text-sidebar-accent-foreground'
                  )}
                >
                  <Link href="/settings/mobile" prefetch onClick={closeMobileSidebar}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                      {userInitials}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{userName}</span>
                      <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                    </div>
                    <Settings className="ml-auto size-4 text-muted-foreground" />
                  </Link>
                </SidebarMenuButton>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                        {userInitials}
                      </div>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{userName}</span>
                        <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                      </div>
                      <MoreVertical className="ml-auto size-4 text-muted-foreground" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-56"
                    side="right"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{userName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {userEmail}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => handleNavigate('/dashboard')}
                      className={cn("cursor-pointer", isActive('/dashboard') && "bg-accent")}
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>{t('items.dashboard')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleNavigate('/settings')}
                      className={cn("cursor-pointer", isActive('/settings') && "bg-accent")}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>{t('items.settings')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleNavigate('/settings/api-keys')}
                      className={cn("cursor-pointer", isActive('/settings/api-keys') && "bg-accent")}
                    >
                      <Key className="mr-2 h-4 w-4" />
                      <span>{t('items.apiKeys')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleNavigate('/settings/logs')}
                      className={cn("cursor-pointer", isActive('/settings/logs') && "bg-accent")}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      <span>{t('items.logs')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleNavigate('/settings/statistics')}
                      className={cn("cursor-pointer", isActive('/settings/statistics') && "bg-accent")}
                    >
                      <BarChart3 className="mr-2 h-4 w-4" />
                      <span>{t('items.statistics')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => setTheme(isDark ? "light" : "dark")}
                      className="cursor-pointer"
                    >
                      {isDark ? (
                        <Sun className="mr-2 h-4 w-4" />
                      ) : (
                        <Moon className="mr-2 h-4 w-4" />
                      )}
                      <span>{isDark ? headerT('theme.light') : headerT('theme.dark')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuLabel>{headerT('language.label')}</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => handleLocaleChange('zh-CN')}
                      className="cursor-pointer"
                      disabled={currentLocale === 'zh-CN'}
                    >
                      <Languages className="mr-2 h-4 w-4" />
                      <span>{headerT('language.zh')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleLocaleChange('en')}
                      className="cursor-pointer"
                      disabled={currentLocale === 'en'}
                    >
                      <Languages className="mr-2 h-4 w-4" />
                      <span>{headerT('language.en')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{headerT('logout.action')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
