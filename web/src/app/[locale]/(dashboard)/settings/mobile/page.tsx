"use client"

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Settings,
  Key,
  Shield,
  BarChart3,
  Moon,
  Sun,
  Monitor,
  Languages,
  Check,
  ChevronRight,
  LogOut,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

export default function MobileSettingsPage() {
  const t = useTranslations('settings.mobileMenu')
  const sidebarT = useTranslations('sidebar')
  const headerT = useTranslations('header')
  const settingsThemeT = useTranslations('settings.theme')
  const pathname = usePathname()
  const locale = useLocale()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { logout } = useAuth()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const navigationItems = useMemo(
    () => [
      { href: '/dashboard', icon: LayoutDashboard, label: sidebarT('items.dashboard') },
      { href: '/settings', icon: Settings, label: sidebarT('items.settings') },
      { href: '/settings/api-keys', icon: Key, label: sidebarT('items.apiKeys') },
      { href: '/settings/logs', icon: Shield, label: sidebarT('items.logs') },
      { href: '/settings/statistics', icon: BarChart3, label: sidebarT('items.statistics') },
    ],
    [sidebarT]
  )

  const themeOptions = useMemo(
    () => [
      { value: 'light', icon: Sun, label: headerT('theme.light') },
      { value: 'dark', icon: Moon, label: headerT('theme.dark') },
      { value: 'system', icon: Monitor, label: settingsThemeT('system') },
    ],
    [headerT, settingsThemeT]
  )

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/settings') return pathname === '/settings'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const handleNavigate = (path: string) => {
    router.push(`${path}?from=mobile-settings`)
  }

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === locale) return
    const localePattern = new RegExp(`^/(${['zh-CN', 'en'].join('|')})(?=/|$)`)
    const currentPath = window.location.pathname.replace(localePattern, '') || '/'
    window.location.href = `/${nextLocale}${currentPath}`
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast({
        title: headerT('logout.success'),
      })
    } catch (error) {
      toast({
        title: headerT('logout.failure'),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="w-full space-y-4 px-4 py-5 md:px-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">
            {t('sections.account')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {navigationItems.map((item) => (
            <Button
              key={item.href}
              type="button"
              variant="ghost"
              className={cn('h-11 w-full justify-start rounded-xl', isActive(item.href) && 'bg-accent')}
              onClick={() => handleNavigate(item.href)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">
            {t('sections.preferences')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {themeOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              className={cn('h-11 w-full justify-start rounded-xl', mounted && theme === option.value && 'bg-accent')}
              onClick={() => setTheme(option.value)}
            >
              <option.icon className="mr-2 h-4 w-4" />
              <span>{option.label}</span>
              {mounted && theme === option.value ? <Check className="ml-auto h-4 w-4" /> : null}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">
            {t('sections.language')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            className={cn('h-11 w-full justify-start rounded-xl', locale === 'zh-CN' && 'bg-accent')}
            onClick={() => handleLocaleChange('zh-CN')}
            disabled={locale === 'zh-CN'}
          >
            <Languages className="mr-2 h-4 w-4" />
            <span>{headerT('language.zh')}</span>
            {locale === 'zh-CN' ? <Check className="ml-auto h-4 w-4" /> : null}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn('h-11 w-full justify-start rounded-xl', locale === 'en' && 'bg-accent')}
            onClick={() => handleLocaleChange('en')}
            disabled={locale === 'en'}
          >
            <Languages className="mr-2 h-4 w-4" />
            <span>{headerT('language.en')}</span>
            {locale === 'en' ? <Check className="ml-auto h-4 w-4" /> : null}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">
            {t('sections.session')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full justify-start rounded-xl text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>{headerT('logout.action')}</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
