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
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { ThemeSettings } from '@/components/theme/theme-settings'

export default function SettingsPage() {
  const t = useTranslations('settings')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const [timezoneInput, setTimezoneInput] = useState('')
  const [currentTimezone, setCurrentTimezone] = useState<string | null>(null)
  const [timezoneLoading, setTimezoneLoading] = useState(false)
  const [llmProvider, setLlmProvider] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmMaxTokens, setLlmMaxTokens] = useState('')
  const [llmApiKeyConfigured, setLlmApiKeyConfigured] = useState(false)
  const [llmSaving, setLlmSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
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

    settingsApi.getLlmConfig()
      .then((response) => {
        const config = response.data
        if (!config) return
        setLlmProvider(config.provider || '')
        setLlmModel(config.model || '')
        setLlmBaseUrl(config.baseUrl || '')
        setLlmMaxTokens(config.maxTokens ? String(config.maxTokens) : '')
        setLlmApiKeyConfigured(Boolean(config.apiKeyConfigured))
      })
      .catch(() => {
        // Ignore when unauthenticated or endpoint is unavailable
      })
  }, [])

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

  const handleSaveLlmConfig = async () => {
    const provider = llmProvider.trim()
    const model = llmModel.trim()

    if (!provider) {
      toast({
        title: t('toast.llmProviderEmpty.title'),
        description: t('toast.llmProviderEmpty.description'),
        variant: 'destructive',
      })
      return
    }

    if (!model) {
      toast({
        title: t('toast.llmModelEmpty.title'),
        description: t('toast.llmModelEmpty.description'),
        variant: 'destructive',
      })
      return
    }

    const maxTokensInput = llmMaxTokens.trim()
    let maxTokensValue: number | null

    if (!maxTokensInput) {
      maxTokensValue = null
    } else {
      const parsed = Number(maxTokensInput)
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        toast({
          title: t('toast.llmMaxTokensInvalid.title'),
          description: t('toast.llmMaxTokensInvalid.description'),
          variant: 'destructive',
        })
        return
      }
      maxTokensValue = parsed
    }

    setLlmSaving(true)
    try {
      const payload = {
        provider,
        model,
        baseUrl: llmBaseUrl.trim() || null,
        maxTokens: maxTokensValue,
        ...(llmApiKey.trim() ? { apiKey: llmApiKey.trim() } : {}),
      }
      const response = await settingsApi.updateLlmConfig(payload)
      const config = response.data
      if (config) {
        setLlmProvider(config.provider || '')
        setLlmModel(config.model || '')
        setLlmBaseUrl(config.baseUrl || '')
        setLlmMaxTokens(config.maxTokens ? String(config.maxTokens) : '')
        setLlmApiKeyConfigured(Boolean(config.apiKeyConfigured))
      }
      setLlmApiKey('')
      toast({
        title: t('toast.llmConfigSaved.title'),
        description: t('toast.llmConfigSaved.description'),
      })
    } catch (error) {
      toast({
        title: t('toast.llmConfigSaveFailure.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setLlmSaving(false)
    }
  }

  const handleClearLlmApiKey = async () => {
    setLlmSaving(true)
    try {
      const response = await settingsApi.updateLlmConfig({ apiKey: null })
      const config = response.data
      if (config) {
        setLlmApiKeyConfigured(Boolean(config.apiKeyConfigured))
      }
      setLlmApiKey('')
      toast({
        title: t('toast.llmApiKeyCleared.title'),
        description: t('toast.llmApiKeyCleared.description'),
      })
    } catch (error) {
      toast({
        title: t('toast.llmConfigSaveFailure.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setLlmSaving(false)
    }
  }

  const handleUseBrowserTimezone = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    setTimezoneInput(detected)
  }

  return (
    <div className="space-y-6">
      {/* Theme Settings */}
      <ThemeSettings />

      {/* LLM Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t('llmConfig.title')}</CardTitle>
          <CardDescription>{t('llmConfig.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="llm-provider">{t('llmConfig.provider.label')}</Label>
            <Input
              id="llm-provider"
              placeholder={t('llmConfig.provider.placeholder')}
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="llm-model">{t('llmConfig.model.label')}</Label>
            <Input
              id="llm-model"
              placeholder={t('llmConfig.model.placeholder')}
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="llm-base-url">{t('llmConfig.baseUrl.label')}</Label>
            <Input
              id="llm-base-url"
              placeholder={t('llmConfig.baseUrl.placeholder')}
              value={llmBaseUrl}
              onChange={(e) => setLlmBaseUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="llm-max-tokens">{t('llmConfig.maxTokens.label')}</Label>
            <Input
              id="llm-max-tokens"
              type="number"
              min={1}
              step={1}
              placeholder={t('llmConfig.maxTokens.placeholder')}
              value={llmMaxTokens}
              onChange={(e) => setLlmMaxTokens(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('llmConfig.maxTokens.helper')}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="llm-api-key">{t('llmConfig.apiKey.label')}</Label>
              <Badge variant="outline">
                {llmApiKeyConfigured ? t('llmConfig.apiKey.configured') : t('llmConfig.apiKey.default')}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Input
                id="llm-api-key"
                type="password"
                placeholder={t('llmConfig.apiKey.placeholder')}
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                className="flex-1"
              />
              {llmApiKeyConfigured && (
                <Button variant="ghost" size="sm" onClick={handleClearLlmApiKey} disabled={llmSaving}>
                  {t('actions.clear')}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('llmConfig.apiKey.helper')}</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveLlmConfig} disabled={llmSaving}>
              {t('actions.save')}
            </Button>
          </div>
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
