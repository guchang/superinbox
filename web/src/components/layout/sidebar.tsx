"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Inbox,
  BrainCircuit,
  GitBranch,
  Settings,
  Home,
  Key,
  Activity,
  BarChart3,
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

const navigationData = [
  {
    title: '主导航',
    items: [
      { name: '仪表板', href: '/', icon: Home },
      { name: '收件箱', href: '/inbox', icon: Inbox },
    ]
  },
  {
    title: 'AI 引擎',
    items: [
      { name: '分类管理', href: '/ai', icon: BrainCircuit },
      { name: '分发规则', href: '/routing', icon: GitBranch },
    ]
  },
  {
    title: '系统设置',
    items: [
      { name: '通用设置', href: '/settings', icon: Settings },
      { name: 'API 密钥', href: '/settings/api-keys', icon: Key },
      { name: '访问日志', href: '/settings/logs', icon: Activity },
      { name: '使用统计', href: '/settings/statistics', icon: BarChart3 },
    ]
  }
]

export function AppSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href)
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Inbox className="h-4 w-4" />
          </div>
          <span className="font-semibold">SuperInbox</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {navigationData.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-2 text-xs text-muted-foreground">
          <p>SuperInbox v0.1.0</p>
          <p className="mt-1">© 2024 SuperInbox</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
