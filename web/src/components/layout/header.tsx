"use client"

import * as React from "react"
import {
  User,
  LogOut,
  Languages,
  Moon,
  Sun,
  LayoutDashboard,
  Settings,
  Key,
  Shield,
  BarChart3
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { usePathname, useRouter } from 'next/navigation'
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
import { routing } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export function Header() {
  const t = useTranslations('header')
  const sidebarT = useTranslations('sidebar.items')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const { authState, logout } = useAuth()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      toast({
        title: t('logout.success'),
      })
    } catch (error) {
      toast({
        title: t('logout.failure'),
        variant: "destructive",
      })
    }
  }

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === locale) return
    const localePattern = new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`)
    const currentPath = window.location.pathname.replace(localePattern, '') || '/'
    const search = window.location.search
    const nextPath = currentPath === '/' ? '' : currentPath
    window.location.href = `/${nextLocale}${nextPath}${search}`
  }

  const handleNavigate = (path: string) => {
    router.push(`/${locale}${path}`)
  }

  const isDark = mounted && theme === "dark"

  // Check if current path matches the given path
  const isActivePath = (path: string) => {
    return pathname === `/${locale}${path}` || pathname.startsWith(`/${locale}${path}/`)
  }

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-black/10 bg-black/5 text-black/40 dark:border-white/10 dark:bg-white/5 dark:text-white/40"
          >
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {authState.user?.username || t('userFallback')}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {authState.user?.email || ""}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Navigation Menu */}
          <DropdownMenuItem
            onClick={() => handleNavigate('/')}
            className={cn("cursor-pointer", isActivePath('/') && "bg-accent")}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>{sidebarT('dashboard')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleNavigate('/settings')}
            className={cn("cursor-pointer", isActivePath('/settings') && "bg-accent")}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>{sidebarT('settings')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleNavigate('/settings/api-keys')}
            className={cn("cursor-pointer", isActivePath('/settings/api-keys') && "bg-accent")}
          >
            <Key className="mr-2 h-4 w-4" />
            <span>{sidebarT('apiKeys')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleNavigate('/settings/logs')}
            className={cn("cursor-pointer", isActivePath('/settings/logs') && "bg-accent")}
          >
            <Shield className="mr-2 h-4 w-4" />
            <span>{sidebarT('logs')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleNavigate('/settings/statistics')}
            className={cn("cursor-pointer", isActivePath('/settings/statistics') && "bg-accent")}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>{sidebarT('statistics')}</span>
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
            <span>{isDark ? t('theme.light') : t('theme.dark')}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Language Selection */}
          <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleLocaleChange('zh-CN')}
            className="cursor-pointer"
            disabled={locale === 'zh-CN'}
          >
            <Languages className="mr-2 h-4 w-4" />
            <span>{t('language.zh')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleLocaleChange('en')}
            className="cursor-pointer"
            disabled={locale === 'en'}
          >
            <Languages className="mr-2 h-4 w-4" />
            <span>{t('language.en')}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Logout */}
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('logout.action')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
