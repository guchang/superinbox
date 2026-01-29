"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ThemeSettings() {
  const t = useTranslations('settings.theme')
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null // Avoid hydration mismatch
  }

  const themes = [
    { value: "light", label: t('light'), icon: Sun },
    { value: "dark", label: t('dark'), icon: Moon },
    { value: "system", label: t('system'), icon: Monitor },
  ] as const

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {themes.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={theme === value ? "default" : "outline"}
              className="flex flex-col gap-2 h-24"
              onClick={() => setTheme(value)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm">{label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
