"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/hooks/use-toast'
import { Check, AlertCircle } from 'lucide-react'
import { settingsApi } from '@/lib/api/settings'
import { Link } from '@/i18n/navigation'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

export default function SettingsPage() {
  const t = useTranslations('settings')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const [apiKey, setApiKey] = useState('')
  const [currentKey, setCurrentKey] = useState('')
  const [timezoneInput, setTimezoneInput] = useState('')
  const [currentTimezone, setCurrentTimezone] = useState<string | null>(null)
  const [timezoneLoading, setTimezoneLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // 加载当前保存的 API Key
    const savedKey = localStorage.getItem('superinbox_api_key') || ''
    setCurrentKey(savedKey)

    // 加载用户时区设置
    settingsApi.getTimezone()
      .then((response) => {
        const timezone = response.data?.timezone ?? null
        setCurrentTimezone(timezone)
        setTimezoneInput(timezone ?? '')
      })
      .catch(() => {
        // Ignore when unauthenticated or endpoint is unavailable
      })
  }, [])

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast({
        title: t('toast.apiKeyEmpty.title'),
        description: t('toast.apiKeyEmpty.description'),
        variant: 'destructive',
      })
      return
    }

    localStorage.setItem('superinbox_api_key', apiKey.trim())
    setCurrentKey(apiKey.trim())
    toast({
      title: t('toast.apiKeySaved.title'),
      description: t('toast.apiKeySaved.description'),
    })
    setApiKey('')
  }

  const handleUseDefaultKey = () => {
    const defaultKey = 'dev-key-change-this-in-production'
    localStorage.setItem('superinbox_api_key', defaultKey)
    setCurrentKey(defaultKey)
    toast({
      title: t('toast.defaultKeyUsed.title'),
      description: t('toast.defaultKeyUsed.description'),
    })
  }

  const handleClearApiKey = () => {
    localStorage.removeItem('superinbox_api_key')
    setCurrentKey('')
    toast({
      title: t('toast.apiKeyCleared.title'),
      description: t('toast.apiKeyCleared.description'),
    })
  }

  const handleSaveTimezone = async () => {
    const trimmed = timezoneInput.trim()
    if (!trimmed) {
      toast({
        title: t('toast.timezoneEmpty.title'),
        description: t('toast.timezoneEmpty.description'),
        variant: 'destructive',
      })
      return
    }

    setTimezoneLoading(true)
    try {
      const response = await settingsApi.updateTimezone(trimmed)
      const timezone = response.data?.timezone ?? trimmed
      setCurrentTimezone(timezone)
      toast({
        title: t('toast.timezoneSaved.title'),
        description: t('toast.timezoneSaved.description', { timezone }),
      })
    } catch (error) {
      toast({
        title: t('toast.timezoneSaveFailure.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setTimezoneLoading(false)
    }
  }

  const handleUseBrowserTimezone = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    setTimezoneInput(detected)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t('apiConfig.title')}</CardTitle>
          <CardDescription>
            {t('apiConfig.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API 地址 */}
          <div className="space-y-2">
            <Label htmlFor="api-url">{t('apiConfig.apiUrl')}</Label>
            <Input
              id="api-url"
              value={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'}
              disabled
              className="bg-muted"
            />
          </div>

          {/* 当前 API Key 状态 */}
          <div className="space-y-2">
            <Label>{t('apiConfig.currentKey.label')}</Label>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {currentKey ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t('apiConfig.currentKey.configured')}</span>
                      <Badge variant="outline">{t('apiConfig.currentKey.storage')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Key: {currentKey.substring(0, 8)}...{currentKey.length > 12 ? currentKey.substring(currentKey.length - 4) : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearApiKey}>
                    {t('actions.clear')}
                  </Button>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{t('apiConfig.currentKey.notConfigured')}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('apiConfig.currentKey.defaultHint')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 设置新的 API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">{t('apiConfig.newKey.label')}</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type="password"
                placeholder={t('apiConfig.newKey.placeholder')}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveApiKey()
                }}
                className="flex-1"
              />
              <Button onClick={handleSaveApiKey}>{t('actions.save')}</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('apiConfig.newKey.helper')}
            </p>
          </div>

          {/* 快速操作 */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleUseDefaultKey}>
              {t('actions.useDefaultKey')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickLinks.title')}</CardTitle>
          <CardDescription>{t('quickLinks.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Button variant="outline" className="h-auto p-4" asChild>
            <Link href="/settings/api-keys">
              <div className="text-left">
                <div className="font-medium mb-1">{t('quickLinks.apiKeys.title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('quickLinks.apiKeys.description')}
                </div>
              </div>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto p-4" asChild>
            <Link href="/settings/logs">
              <div className="text-left">
                <div className="font-medium mb-1">{t('quickLinks.logs.title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('quickLinks.logs.description')}
                </div>
              </div>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto p-4" asChild>
            <Link href="/settings/statistics">
              <div className="text-left">
                <div className="font-medium mb-1">{t('quickLinks.statistics.title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('quickLinks.statistics.description')}
                </div>
              </div>
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Timezone Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t('timezone.title')}</CardTitle>
          <CardDescription>
            {t('timezone.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t('timezone.current.label')}</Label>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {currentTimezone ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{t('timezone.current.set')}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentTimezone}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{t('timezone.current.unset')}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('timezone.current.utcHint')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{t('timezone.new.label')}</Label>
            <div className="flex gap-2">
              <Input
                id="timezone"
                placeholder="Asia/Shanghai"
                value={timezoneInput}
                onChange={(e) => setTimezoneInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTimezone()
                }}
                className="flex-1"
              />
              <Button onClick={handleSaveTimezone} disabled={timezoneLoading}>
                {t('actions.save')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('timezone.new.helper')}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleUseBrowserTimezone}>
              {t('actions.useBrowserTimezone')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
