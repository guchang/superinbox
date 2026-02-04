"use client"

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
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
import { useMemo } from 'react'

// Gmail 风格的导航项组件
interface NavItemProps {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
  href: string
  color?: string
  isActive: boolean
  count?: number
}

function NavItem({ label, icon: Icon, href, color, isActive, count }: NavItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} className="group">
        <Link href={href} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg transition-colors ${isActive ? color || 'bg-primary/10' : 'group-hover:bg-muted'}`}>
              <Icon className={`h-4 w-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            </div>
            <span className="text-sm tracking-tight">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {count !== undefined && count > 0 && (
              <span className="text-xs font-medium text-muted-foreground">{count}</span>
            )}
            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </div>
        </Link>
      </SidebarMenuButton>
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

export function AppSidebar() {
  const t = useTranslations('sidebar')
  const pathname = usePathname()

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
    <Sidebar className="border-r border-border/60">
      <SidebarHeader className="px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
            <Inbox className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm tracking-tight">SuperInbox</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Mailbox Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest opacity-40">
            {t('sections.mailbox')}
          </SidebarGroupLabel>
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
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Intents Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest opacity-40">
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
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest opacity-40">
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

        {/* Settings Section */}
        <SidebarGroup className="mt-auto">
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
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-border/60">
        <div className="text-[10px] text-muted-foreground">
          <p className="font-medium">{t('footer.version')}</p>
          <p className="mt-0.5 opacity-60">{t('footer.copyright')}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
