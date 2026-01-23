"use client"

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
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

export function AppSidebar() {
  const t = useTranslations('sidebar')
  const pathname = usePathname()

  const navigationData = [
    {
      title: t('sections.main'),
      items: [
        { name: t('items.dashboard'), href: '/', icon: Home },
        { name: t('items.inbox'), href: '/inbox', icon: Inbox },
      ]
    },
    {
      title: t('sections.ai'),
      items: [
        { name: t('items.categories'), href: '/ai', icon: BrainCircuit },
        { name: t('items.routing'), href: '/routing', icon: GitBranch },
        { name: t('items.connections'), href: '/mcp-adapters', icon: Plug },
      ]
    },
    {
      title: t('sections.settings'),
      items: [
        { name: t('items.settings'), href: '/settings', icon: Settings },
        { name: t('items.apiKeys'), href: '/settings/api-keys', icon: Key },
        { name: t('items.logs'), href: '/settings/logs', icon: Activity },
        { name: t('items.statistics'), href: '/settings/statistics', icon: BarChart3 },
      ]
    }
  ]

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
          <p>{t('footer.version')}</p>
          <p className="mt-1">{t('footer.copyright')}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
