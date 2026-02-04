"use client"

import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/lib/api/categories'
import {
  Inbox,
  BrainCircuit,
  GitBranch,
  Settings,
  Home,
  Key,
  Activity,
  BarChart3,
  Plug,
  Sparkles,
  HardDrive,
  CheckCircle2,
  Wallet,
  Lightbulb,
  Link2,
  Cpu,
  Type,
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
import { SearchTrigger } from '@/components/shared/search-dialog'

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
            : 'text-foreground/80 opacity-40 hover:opacity-100 hover:bg-current/5'
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
              {count !== undefined && count > 0 && (
                <span className="text-xs font-medium text-muted-foreground">{count}</span>
              )}
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
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
  schedule: { icon: Sparkles, color: 'text-purple-500 bg-purple-500/10' },
}

interface AppSidebarProps {
  className?: string
}

export function AppSidebar({ className }: AppSidebarProps) {
  const t = useTranslations('sidebar')
  const pathname = usePathname()
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // 处理搜索按钮点击
  const handleSearchClick = () => {
    // 如果在 inbox 页面，通过 URL 参数触发搜索对话框
    if (pathname?.startsWith('/inbox')) {
      router.push('/inbox?search=true')
    } else {
      // 否则导航到 inbox 并打开搜索
      router.push('/inbox?search=true')
    }
    // 移动端：关闭抽屉
    if (window.innerWidth < 768) {
      setIsMobileOpen(false)
    }
  }

  // 响应式检测：md 屏幕时自动折叠
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      // md: 768px - lg: 1024px 之间折叠
      setIsCollapsed(width >= 768 && width < 1024)
      // sm 以下关闭移动端抽屉
      if (width >= 768) {
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

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/settings') return pathname === '/settings'
    return pathname === href || pathname?.startsWith(href + '/')
  }

  // Mailbox 分组
  const mailboxItems = [
    { id: 'dashboard', label: t('items.dashboard') || 'Dashboard', href: '/', icon: Home },
    { id: 'inbox', label: t('items.inbox') || 'All Memories', href: '/inbox', icon: Inbox },
    { id: 'starred', label: t('items.starred') || 'Starred', href: '/inbox?starred=true', icon: Sparkles },
    { id: 'archive', label: t('items.archive') || 'Archive', href: '/inbox?archived=true', icon: HardDrive },
  ]

  // Intents (AI Labels) 分组 - 基于 API 返回的 categories
  const intentItems = useMemo(() => {
    const activeCategories = categories.filter((category) => category.isActive)

    // 如果没有获取到 categories，使用默认配置
    if (activeCategories.length === 0) {
      return [
        { id: 'todo', label: 'Todo & Tasks', href: '/inbox?category=todo', icon: CheckCircle2, color: 'text-blue-500 bg-blue-500/10' },
        { id: 'expense', label: 'Finance', href: '/inbox?category=expense', icon: Wallet, color: 'text-orange-500 bg-orange-500/10' },
        { id: 'idea', label: 'Insights & Ideas', href: '/inbox?category=idea', icon: Lightbulb, color: 'text-yellow-500 bg-yellow-500/10' },
        { id: 'note', label: 'Daily Logs', href: '/inbox?category=note', icon: Type },
        { id: 'bookmark', label: 'Reading List', href: '/inbox?category=bookmark', icon: Link2, color: 'text-indigo-500 bg-indigo-500/10' },
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
      }
    })
  }, [categories])

  // Management 分组
  const managementItems = [
    { id: 'categories', label: t('items.categories') || 'Categories', href: '/category', icon: Cpu, color: 'text-purple-500 bg-purple-500/10' },
    { id: 'routing', label: t('items.routing') || 'Routing', href: '/routing', icon: GitBranch },
    { id: 'connections', label: t('items.connections') || 'Connections', href: '/mcp-adapters', icon: Plug },
  ]

  // Settings 分组
  const settingsItems = [
    { id: 'settings', label: t('items.settings') || 'Settings', href: '/settings', icon: Settings },
    { id: 'apiKeys', label: t('items.apiKeys') || 'API Keys', href: '/settings/api-keys', icon: Key },
    { id: 'logs', label: t('items.logs') || 'Logs', href: '/settings/logs', icon: Activity },
    { id: 'statistics', label: t('items.statistics') || 'Statistics', href: '/settings/statistics', icon: BarChart3 },
  ]

  return (
    <>
      {/* 移动端菜单按钮 - sm 以下显示 */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden h-10 w-10 rounded-xl bg-background/80 backdrop-blur-xl border border-black/[0.03] dark:border-white/[0.03]"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

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
          // md 到 lg 之间：图标栏模式 (w-16)
          isCollapsed && "w-16 min-w-16 max-w-16",
          // lg 以上：完整侧边栏
          !isCollapsed && "w-64 min-w-64 max-w-64",
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

        <SidebarContent className={cn("px-2 pt-4", isCollapsed && "px-1")}>
          {/* Mailbox Section */}
          <SidebarGroup className="p-0">
            {!isCollapsed && (
              <SidebarGroupLabel className="px-3 mb-2 opacity-20 font-black uppercase text-[10px] tracking-widest">
                {t('sections.mailbox')}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {/* 搜索按钮 */}
                <SearchTrigger onClick={handleSearchClick} collapsed={isCollapsed} />
                {mailboxItems.map((item) => (
                  <NavItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    href={item.href}
                    icon={item.icon}
                    isActive={isActive(item.href)}
                    collapsed={isCollapsed}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Intents Section */}
          <SidebarGroup className="p-0">
            {!isCollapsed && (
              <SidebarGroupLabel className="px-3 mb-2 opacity-20 font-black uppercase text-[10px] tracking-widest">
                {t('sections.intents')}
              </SidebarGroupLabel>
            )}
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
                    collapsed={isCollapsed}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Management Section */}
          <SidebarGroup className="p-0">
            {!isCollapsed && (
              <SidebarGroupLabel className="px-3 mb-2 opacity-20 font-black uppercase text-[10px] tracking-widest">
                {t('sections.management')}
              </SidebarGroupLabel>
            )}
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
                    collapsed={isCollapsed}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Settings Section */}
          <SidebarGroup className="mt-auto p-0">
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {settingsItems.map((item) => (
                  <NavItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    href={item.href}
                    icon={item.icon}
                    isActive={isActive(item.href)}
                    collapsed={isCollapsed}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter
          className={cn(
            "border-t border-black/[0.03] dark:border-white/[0.03]",
            isCollapsed ? "px-2 py-3" : "px-4 py-3"
          )}
        >
          {isCollapsed ? (
            <div className="flex justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">
              <p className="font-medium">{t('footer.version')}</p>
              <p className="mt-0.5 opacity-60">{t('footer.copyright')}</p>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
