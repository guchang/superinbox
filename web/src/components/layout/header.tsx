"use client"

import { Bell, User, LogOut, Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
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
import { ThemeSwitcher } from '@/components/theme/theme-switcher'

export function Header() {
  const t = useTranslations('header')
  const locale = useLocale()
  const { authState, logout } = useAuth()
  const { toast } = useToast()

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

  return (
    <div className="flex items-center gap-2 ml-auto">
      <ThemeSwitcher />
      <Button variant="ghost" size="icon">
        <Bell className="h-5 w-5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Languages className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleLocaleChange('zh-CN')}
            className="cursor-pointer"
            disabled={locale === 'zh-CN'}
          >
            {t('language.zh')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleLocaleChange('en')}
            className="cursor-pointer"
            disabled={locale === 'en'}
          >
            {t('language.en')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
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
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('logout.action')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
