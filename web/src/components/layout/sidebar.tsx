"use client"

import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
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
} from '@/components/ui/sidebar'
import { useMemo, useState, useEffect, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PanelLeft } from 'lucide-react'
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

// Gmail 风格的导航项组件
interface NavItemProps {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
  href: string
  iconStyle?: CSSProperties
  isActive: boolean
  count?: number
  collapsed?: boolean
}

function NavItem({ label, icon: Icon, href, iconStyle, isActive, count, collapsed }: NavItemProps) {
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

export function AppSidebar({ className }: AppSidebarProps) {
  const t = useTranslations('sidebar')
  const headerT = useTranslations('header')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { authState, logout } = useAuth()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
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
    if (nextLocale === pathname.split('/')[1]) return
    const localePattern = new RegExp(`^/(${['zh-CN', 'en'].join('|')})(?=/|$)`)
    const currentPath = window.location.pathname.replace(localePattern, '') || '/'
    window.location.href = `/${nextLocale}${currentPath}`
  }

  const handleNavigate = (path: string) => {
    router.push(path)
  }

  const isDark = mounted && theme === "dark"
  const userName = authState.user?.username || headerT('userFallback')
  const userEmail = authState.user?.email || headerT('userFallback')
  const userInitials = userName.slice(0, 2).toUpperCase()

  // 响应式检测：sm 以下关闭移动端抽屉
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

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

  const categories = useMemo(() => categoriesData?.data || [], [categoriesData?.data])

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

  // Mailbox 分组
  const mailboxItems = [
    { id: 'inbox', label: t('items.inbox') || 'All Memories', href: '/inbox', icon: Inbox, count: countData?.inboxTotal ?? 0 },
  ]

  // Intents (AI Labels) 分组 - 基于 API 返回的 categories
  const intentItems = useMemo(() => {
    const activeCategories = categories.filter((category) => category.isActive)

    if (activeCategories.length === 0) {
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

    return activeCategories.map((category) => ({
      id: category.key,
      label: category.name,
      href: `/inbox?category=${category.key}`,
      icon: getCategoryIconComponent(category.icon, category.key),
      iconStyle: getCategorySoftStyle(category.key, category.color, isDark ? 'dark' : 'light'),
      count: countData?.categoryTotals?.get(category.key) ?? 0,
    }))
  }, [categories, countData, isDark])

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
            onClick={() => setIsMobileOpen(false)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}

        <SidebarHeader className="px-2 pt-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-9 gap-2">
                <Link href="/inbox">
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
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Intents Section */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-3 mb-2 opacity-20 font-black uppercase text-[10px] tracking-widest">
              {t('sections.intents')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
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
                  />
                ))}
              </SidebarMenu>
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
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-black/[0.03] dark:border-white/[0.03] px-4 py-3">
          <SidebarMenu>
            <SidebarMenuItem>
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
                    disabled={pathname.split('/')[1] === 'zh-CN'}
                  >
                    <Languages className="mr-2 h-4 w-4" />
                    <span>{headerT('language.zh')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleLocaleChange('en')}
                    className="cursor-pointer"
                    disabled={pathname.split('/')[1] === 'en'}
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
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
