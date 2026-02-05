"use client"

import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import {
  Inbox,
  GitBranch,
  Plug,
  CheckCircle2,
  Wallet,
  Lightbulb,
  Link2,
  Cpu,
  Type,
  User,
  LogOut,
  Languages,
  Moon,
  Sun,
  LayoutDashboard,
  Settings,
  Key,
  Shield,
  BarChart3,
  ChevronDown,
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
import { useMemo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PanelLeft, Menu } from 'lucide-react'
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
import { routing } from '@/i18n/routing'

// Gmail 风格的导航项组件
interface NavItemProps {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
  href: string
  color?: string
  isActive: boolean
  count?: number
  collapsed?: boolean
}

function NavItem({ label, icon: Icon, href, color, isActive, count, collapsed }: NavItemProps) {
  return (
    <SidebarMenuItem>
      <Link
        href={href}
        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl transition-all group ${
          isActive
            ? 'font-bold text-foreground bg-black/5 dark:bg-white/10'
            : 'text-foreground/80 opacity-60 hover:opacity-100 hover:bg-current/5'
        } ${collapsed ? 'justify-center px-2' : ''}`}
        title={collapsed ? label : undefined}
      >
          <div className={`flex items-center gap-3 ${collapsed ? '' : ''}`}>
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                isActive ? color || 'bg-current/10' : ''
              }`}
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

// Category key 到 icon 和颜色的映射
const categoryConfig: Record<string, { icon: typeof CheckCircle2; color?: string }> = {
  todo: { icon: CheckCircle2, color: 'text-blue-500 bg-blue-500/10' },
  expense: { icon: Wallet, color: 'text-orange-500 bg-orange-500/10' },
  idea: { icon: Lightbulb, color: 'text-yellow-500 bg-yellow-500/10' },
  note: { icon: Type },
  bookmark: { icon: Link2, color: 'text-indigo-500 bg-indigo-500/10' },
  schedule: { icon: Link2, color: 'text-purple-500 bg-purple-500/10' },
}

interface AppSidebarProps {
  className?: string
}

export function AppSidebar({ className }: AppSidebarProps) {
  const t = useTranslations('sidebar')
  const headerT = useTranslations('header')
  const pathname = usePathname()
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
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const categories = categoriesData?.data || []

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

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/settings') return pathname === '/settings'
    return pathname === href || pathname?.startsWith(href + '/')
  }

  // Mailbox 分组
  const mailboxItems = [
    { id: 'inbox', label: t('items.inbox') || 'All Memories', href: '/inbox', icon: Inbox, count: countData?.inboxTotal ?? 0 },
  ]

  // Intents (AI Labels) 分组 - 基于 API 返回的 categories
  const intentItems = useMemo(() => {
    const activeCategories = categories.filter((category) => category.isActive)

    // 如果没有获取到 categories，使用默认配置
    if (activeCategories.length === 0) {
      return [
        { id: 'todo', label: 'Todo & Tasks', href: '/inbox?category=todo', icon: CheckCircle2, color: 'text-blue-500 bg-blue-500/10', count: 0 },
        { id: 'expense', label: 'Finance', href: '/inbox?category=expense', icon: Wallet, color: 'text-orange-500 bg-orange-500/10', count: 0 },
        { id: 'idea', label: 'Insights & Ideas', href: '/inbox?category=idea', icon: Lightbulb, color: 'text-yellow-500 bg-yellow-500/10', count: 0 },
        { id: 'note', label: 'Daily Logs', href: '/inbox?category=note', icon: Type, count: 0 },
        { id: 'bookmark', label: 'Reading List', href: '/inbox?category=bookmark', icon: Link2, color: 'text-indigo-500 bg-indigo-500/10', count: 0 },
      ]
    }

    // 使用 API 返回的 category 名称
    return activeCategories.map((category) => {
      const config = categoryConfig[category.key] || { icon: Type }
      return {
        id: category.key,
        label: category.name, // 使用 API 返回的名称
        href: `/inbox?category=${category.key}`,
        icon: config.icon,
        color: config.color,
        count: countData?.categoryTotals?.get(category.key) ?? 0,
      }
    })
  }, [categories, countData])

  // Management 分组
  const managementItems = [
    { id: 'categories', label: t('items.categories') || 'Categories', href: '/category', icon: Cpu, color: 'text-purple-500 bg-purple-500/10' },
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

        <SidebarContent className="px-2 pt-4">
          <SidebarHeader className="p-0 pb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-foreground hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-black/5 text-black/40 dark:bg-white/5 dark:text-white/40 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="text-sm tracking-tight">
                      {authState.user?.username || headerT('userFallback')}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {authState.user?.username || headerT('userFallback')}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Navigation Menu */}
                <DropdownMenuItem
                  onClick={() => handleNavigate('/')}
                  className={cn("cursor-pointer", isActive('/') && "bg-accent")}
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

                {/* Theme Toggle */}
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

                {/* Language Selection */}
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

                {/* Logout */}
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{headerT('logout.action')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarHeader>
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
                    color={item.color}
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
          <div className="text-[10px] text-muted-foreground text-right">
            <p className="font-medium">{t('footer.version')}</p>
            <p className="mt-0.5 opacity-60">{t('footer.copyright')}</p>
          </div>
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
