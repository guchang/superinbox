"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Inbox,
  BrainCircuit,
  GitBranch,
  Settings,
  Home,
  FileText,
} from 'lucide-react'

const navigation = [
  { name: '仪表板', href: '/', icon: Home },
  { name: '收件箱', href: '/inbox', icon: Inbox },
  { name: 'AI 引擎', href: '/ai', icon: BrainCircuit },
  { name: '路由规则', href: '/routing', icon: GitBranch },
  { name: '系统设置', href: '/settings', icon: Settings },
]

const aiNavigation = [
  { name: '分析概览', href: '/ai', icon: BrainCircuit },
  { name: 'Prompt 管理', href: '/ai/prompts', icon: FileText },
]

const settingsNavigation = [
  { name: '通用设置', href: '/settings', icon: Settings },
  { name: 'API 密钥', href: '/settings/api-keys', icon: FileText },
  { name: '访问日志', href: '/settings/logs', icon: FileText },
  { name: '使用统计', href: '/settings/statistics', icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href)
  }

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Inbox className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">SuperInbox</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* Main Navigation */}
        <div>
          <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
            主菜单
          </h3>
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* AI Navigation */}
        {pathname?.startsWith('/ai') && (
          <div>
            <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
              AI 引擎
            </h3>
            <ul className="space-y-1">
              {aiNavigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Settings Navigation */}
        {pathname?.startsWith('/settings') && (
          <div>
            <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
              设置
            </h3>
            <ul className="space-y-1">
              {settingsNavigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          <p>SuperInbox v0.1.0</p>
          <p className="mt-1">© 2024 SuperInbox</p>
        </div>
      </div>
    </div>
  )
}
