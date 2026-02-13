"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, AlertCircle, ArrowUp, ArrowDown, Trash2, Plus, Loader2, Pencil, Globe } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useToast } from '@/hooks/use-toast'
import { settingsApi } from '@/lib/api/settings'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import { ThemeSettings } from '@/components/theme/theme-settings'
import type { LlmConfigItem } from '@/types'

interface LlmFormDraft {
  name: string
  provider: string
  model: string
  baseUrl: string
  timeout: string
  maxTokens: string
  apiKey: string
}


const emptyLlmFormDraft = (): LlmFormDraft => ({
  name: '',
  provider: '',
  model: '',
  baseUrl: '',
  timeout: '30000',
  maxTokens: '2000',
  apiKey: '',
})

const buildFormDraftFromConfig = (config: LlmConfigItem): LlmFormDraft => ({
  name: config.name || '',
  provider: config.provider || '',
  model: config.model || '',
  baseUrl: config.baseUrl || '',
  timeout: String(config.timeout ?? 30000),
  maxTokens: String(config.maxTokens ?? 2000),
  apiKey: '',
})

const parsePositiveIntOrNull = (value: string): number | null | 'invalid' => {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return 'invalid'
  }

  return parsed
}

const COMMON_TIMEZONE_CANDIDATES = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export default function SettingsPage() {
  const t = useTranslations('settings')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const { toast } = useToast()

  const [timezoneInput, setTimezoneInput] = useState('')
  const [browserTimezone, setBrowserTimezone] = useState<string | null>(null)
  const [timezoneOptions, setTimezoneOptions] = useState<string[]>([])
  const [currentTimezone, setCurrentTimezone] = useState<string | null>(null)
  const [timezoneLoading, setTimezoneLoading] = useState(false)

  const [llmConfigs, setLlmConfigs] = useState<LlmConfigItem[]>([])
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmBusyId, setLlmBusyId] = useState<string | null>(null)
  const [llmOrdering, setLlmOrdering] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [dialogDraft, setDialogDraft] = useState<LlmFormDraft>(emptyLlmFormDraft())
  const [dialogSubmitting, setDialogSubmitting] = useState(false)
  const [dialogTesting, setDialogTesting] = useState(false)
  const [dialogConnectionFeedback, setDialogConnectionFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const activeConfigCount = useMemo(
    () => llmConfigs.filter((config) => config.isActive).length,
    [llmConfigs]
  )
  const quickTimezoneOptions = useMemo(() => {
    if (timezoneOptions.length === 0) {
      return COMMON_TIMEZONE_CANDIDATES
    }

    const optionSet = new Set(timezoneOptions)
    const preferred = COMMON_TIMEZONE_CANDIDATES.filter((zone) => optionSet.has(zone))
    return preferred.length > 0 ? preferred : timezoneOptions.slice(0, 12)
  }, [timezoneOptions])

  const applyLlmConfigResponse = useCallback((configs: LlmConfigItem[] | undefined) => {
    setLlmConfigs(configs || [])
  }, [])

  const loadLlmConfigs = useCallback(async () => {
    setLlmLoading(true)
    try {
      const response = await settingsApi.getLlmConfigs()
      applyLlmConfigResponse(response.data?.configs)
    } catch {
      // Ignore when unauthenticated or endpoint is unavailable
    } finally {
      setLlmLoading(false)
    }
  }, [applyLlmConfigResponse])

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    setBrowserTimezone(detected || null)
    const intlWithSupportedValues = Intl as typeof Intl & {
      supportedValuesOf?: (key: 'timeZone') => string[]
    }
    setTimezoneOptions(intlWithSupportedValues.supportedValuesOf?.('timeZone') ?? COMMON_TIMEZONE_CANDIDATES)

    settingsApi.getTimezone()
      .then((response) => {
        const timezone = response.data?.timezone ?? null
        setCurrentTimezone(timezone)
        setTimezoneInput(timezone ?? '')
      })
      .catch(() => {
        // Ignore when unauthenticated or endpoint is unavailable
      })

    loadLlmConfigs()
  }, [loadLlmConfigs])

  useEffect(() => {
    if (!dialogOpen || !dialogConnectionFeedback) return

    const timer = window.setTimeout(() => {
      setDialogConnectionFeedback(null)
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [dialogOpen, dialogConnectionFeedback])

  const validateLlmFormNumbers = (draft: LlmFormDraft): {
    timeout: number | null
    maxTokens: number | null
  } | null => {
    const maxTokens = parsePositiveIntOrNull(draft.maxTokens)
    if (maxTokens === 'invalid') {
      toast({
        title: t('toast.llmMaxTokensInvalid.title'),
        description: t('toast.llmMaxTokensInvalid.description'),
        variant: 'destructive',
      })
      return null
    }

    const timeout = parsePositiveIntOrNull(draft.timeout)
    if (timeout === 'invalid') {
      toast({
        title: t('toast.llmTimeoutInvalid.title'),
        description: t('toast.llmTimeoutInvalid.description'),
        variant: 'destructive',
      })
      return null
    }

    return { timeout, maxTokens }
  }

  const openCreateDialog = () => {
    setDialogMode('create')
    setEditingConfigId(null)
    setDialogDraft(emptyLlmFormDraft())
    setDialogTesting(false)
    setDialogConnectionFeedback(null)
    setDialogOpen(true)
  }

  const openEditDialog = (config: LlmConfigItem) => {
    setDialogMode('edit')
    setEditingConfigId(config.id)
    setDialogDraft(buildFormDraftFromConfig(config))
    setDialogTesting(false)
    setDialogConnectionFeedback(null)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingConfigId(null)
    setDialogDraft(emptyLlmFormDraft())
    setDialogTesting(false)
    setDialogConnectionFeedback(null)
  }

  const handleSubmitDialog = async () => {
    const provider = dialogDraft.provider.trim()
    const model = dialogDraft.model.trim()
    const apiKey = dialogDraft.apiKey.trim()

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

    if (dialogMode === 'create' && !apiKey) {
      toast({
        title: t('toast.llmApiKeyEmpty.title'),
        description: t('toast.llmApiKeyEmpty.description'),
        variant: 'destructive',
      })
      return
    }

    const validatedNumbers = validateLlmFormNumbers(dialogDraft)
    if (!validatedNumbers) return

    setDialogSubmitting(true)
    try {
      if (dialogMode === 'create') {
        const response = await settingsApi.createLlmConfig({
          name: dialogDraft.name.trim() || null,
          provider,
          model,
          baseUrl: dialogDraft.baseUrl.trim() || null,
          apiKey,
          timeout: validatedNumbers.timeout,
          maxTokens: validatedNumbers.maxTokens,
          isActive: true,
        })
        applyLlmConfigResponse(response.data?.configs)
      } else {
        if (!editingConfigId) {
          throw new Error('Missing editing config id')
        }

        const response = await settingsApi.updateLlmConfig(editingConfigId, {
          name: dialogDraft.name.trim() || null,
          provider,
          model,
          baseUrl: dialogDraft.baseUrl.trim() || null,
          timeout: validatedNumbers.timeout,
          maxTokens: validatedNumbers.maxTokens,
          ...(apiKey ? { apiKey } : {}),
        })
        applyLlmConfigResponse(response.data?.configs)
      }

      toast({
        title: t('toast.llmConfigSaved.title'),
        description: t('toast.llmConfigSaved.description'),
      })
      closeDialog()
    } catch (error) {
      toast({
        title: t('toast.llmConfigSaveFailure.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setDialogSubmitting(false)
    }
  }

  const handleToggleActive = async (config: LlmConfigItem, checked: boolean) => {
    setLlmBusyId(config.id)
    try {
      const response = await settingsApi.updateLlmConfig(config.id, {
        isActive: checked,
      })
      applyLlmConfigResponse(response.data?.configs)
    } catch (error) {
      toast({
        title: t('toast.llmConfigSaveFailure.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setLlmBusyId(null)
    }
  }

  const handleDeleteConfig = async (id: string): Promise<boolean> => {
    setLlmBusyId(id)
    try {
      const response = await settingsApi.deleteLlmConfig(id)
      applyLlmConfigResponse(response.data?.configs)
      toast({
        title: t('toast.llmConfigDeleted.title'),
        description: t('toast.llmConfigDeleted.description'),
      })
      return true
    } catch (error) {
      toast({
        title: t('toast.llmConfigSaveFailure.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
      return false
    } finally {
      setLlmBusyId(null)
    }
  }

  const handleDeleteInDialog = async () => {
    if (!editingConfigId) return
    const deleted = await handleDeleteConfig(editingConfigId)
    if (deleted) {
      closeDialog()
    }
  }

  const handleTestDraftConnection = async () => {
    const provider = dialogDraft.provider.trim()
    const model = dialogDraft.model.trim()
    const apiKey = dialogDraft.apiKey.trim()

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

    if (!apiKey) {
      toast({
        title: t('toast.llmApiKeyEmpty.title'),
        description: t('toast.llmApiKeyEmpty.description'),
        variant: 'destructive',
      })
      return
    }

    const validatedNumbers = validateLlmFormNumbers(dialogDraft)
    if (!validatedNumbers) return

    setDialogTesting(true)
    setDialogConnectionFeedback(null)

    try {
      const response = await settingsApi.testLlmDraftConfig({
        provider,
        model,
        baseUrl: dialogDraft.baseUrl.trim() || null,
        apiKey,
        timeout: validatedNumbers.timeout,
        maxTokens: validatedNumbers.maxTokens,
      })

      const result = response.data
      if (!result) return

      const feedbackMessage = result.ok
        ? t('llmConfig.connection.ok')
        : `${t('llmConfig.connection.failed')}：${result.message || common('tryLater')}`

      setDialogConnectionFeedback({
        type: result.ok ? 'success' : 'error',
        message: feedbackMessage,
      })

      toast({
        title: result.ok ? t('toast.llmConnectionTestSuccess.title') : t('toast.llmConnectionTestFailed.title'),
        ...(result.message ? { description: result.message } : {}),
        variant: result.ok ? 'default' : 'destructive',
      })
    } catch (error) {
      const message = getApiErrorMessage(error, errors, common('tryLater'))
      setDialogConnectionFeedback({
        type: 'error',
        message: `${t('llmConfig.connection.failed')}：${message}`,
      })

      toast({
        title: t('toast.llmConnectionTestFailed.title'),
        description: message,
        variant: 'destructive',
      })
    } finally {
      setDialogTesting(false)
    }
  }

  const handleTestEditedConnection = async (id: string) => {
    const provider = dialogDraft.provider.trim()
    const model = dialogDraft.model.trim()
    const apiKey = dialogDraft.apiKey.trim()

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

    const validatedNumbers = validateLlmFormNumbers(dialogDraft)
    if (!validatedNumbers) return

    setLlmBusyId(id)
    setDialogTesting(true)
    setDialogConnectionFeedback(null)

    try {
      const response = await settingsApi.testLlmConfig(id, {
        provider,
        model,
        baseUrl: dialogDraft.baseUrl.trim() || null,
        timeout: validatedNumbers.timeout,
        maxTokens: validatedNumbers.maxTokens,
        ...(apiKey ? { apiKey } : {}),
      })

      const result = response.data
      if (!result) return

      const feedbackMessage = result.ok
        ? t('llmConfig.connection.ok')
        : `${t('llmConfig.connection.failed')}：${result.message || common('tryLater')}`

      setDialogConnectionFeedback({
        type: result.ok ? 'success' : 'error',
        message: feedbackMessage,
      })

      toast({
        title: result.ok ? t('toast.llmConnectionTestSuccess.title') : t('toast.llmConnectionTestFailed.title'),
        ...(result.message ? { description: result.message } : {}),
        variant: result.ok ? 'default' : 'destructive',
      })
    } catch (error) {
      const message = getApiErrorMessage(error, errors, common('tryLater'))
      setDialogConnectionFeedback({
        type: 'error',
        message: `${t('llmConfig.connection.failed')}：${message}`,
      })

      toast({
        title: t('toast.llmConnectionTestFailed.title'),
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLlmBusyId(null)
      setDialogTesting(false)
    }
  }

  const handleReorder = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= llmConfigs.length) return

    const previous = [...llmConfigs]
    const next = [...llmConfigs]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)

    setLlmConfigs(next)
    setLlmOrdering(true)

    try {
      const response = await settingsApi.reorderLlmConfigs(next.map((item) => item.id))
      applyLlmConfigResponse(response.data?.configs)
    } catch (error) {
      setLlmConfigs(previous)
      toast({
        title: t('toast.llmConfigSaveFailure.title'),
        description: getApiErrorMessage(error, errors, common('tryLater')),
        variant: 'destructive',
      })
    } finally {
      setLlmOrdering(false)
    }
  }

  const handleSaveTimezone = async (timezone?: string) => {
    const trimmed = (timezone ?? timezoneInput).trim()
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
      setTimezoneInput(timezone)
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
    const detected = browserTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    setTimezoneInput(detected || '')
    void handleSaveTimezone(detected)
  }

  const editingDialogBusy = dialogMode === 'edit' && editingConfigId
    ? llmBusyId === editingConfigId
    : false
  const dialogBusy = dialogSubmitting || dialogTesting || editingDialogBusy

  return (
    <div className="w-full space-y-6 px-4 md:px-6 py-6">
      <ThemeSettings />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{t('llmConfig.title')}</CardTitle>
          <CardDescription>{t('llmConfig.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t('llmConfig.activeCount', { count: activeConfigCount })} · {t('llmConfig.totalCount', { count: llmConfigs.length })}
            </p>

            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              {t('actions.addConfig')}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">{t('llmConfig.fallbackHint')}</p>

          {llmLoading ? (
            <div className="text-sm text-muted-foreground">{t('llmConfig.loading')}</div>
          ) : llmConfigs.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              {t('llmConfig.empty')}
            </div>
          ) : (
            <div className="space-y-2">
              {llmConfigs.map((config, index) => {
                const busy = llmBusyId === config.id
                const displayName = config.name?.trim() || config.provider?.trim() || `Config #${index + 1}`

                return (
                  <div key={config.id} className="group rounded-lg border px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">#{index + 1}</div>
                        <div className="font-medium truncate">{displayName}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(config)}
                            disabled={busy}
                            title={t('actions.edit')}
                            aria-label={t('actions.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleReorder(index, -1)}
                            disabled={index === 0 || llmOrdering || busy}
                            title={t('actions.moveUp')}
                            aria-label={t('actions.moveUp')}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleReorder(index, 1)}
                            disabled={index === llmConfigs.length - 1 || llmOrdering || busy}
                            title={t('actions.moveDown')}
                            aria-label={t('actions.moveDown')}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>

                        <Switch
                          checked={config.isActive}
                          onCheckedChange={(checked) => handleToggleActive(config, checked)}
                          disabled={busy}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? t('llmConfig.createDialog.title') : t('llmConfig.editDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'create' ? t('llmConfig.createDialog.description') : t('llmConfig.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>{t('llmConfig.name.label')}</Label>
              <Input
                placeholder={t('llmConfig.name.placeholder')}
                value={dialogDraft.name}
                onChange={(e) => setDialogDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('llmConfig.provider.label')}</Label>
              <Input
                placeholder={t('llmConfig.provider.placeholder')}
                value={dialogDraft.provider}
                onChange={(e) => setDialogDraft((prev) => ({ ...prev, provider: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('llmConfig.model.label')}</Label>
              <Input
                placeholder={t('llmConfig.model.placeholder')}
                value={dialogDraft.model}
                onChange={(e) => setDialogDraft((prev) => ({ ...prev, model: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('llmConfig.baseUrl.label')}</Label>
              <Input
                placeholder={t('llmConfig.baseUrl.placeholder')}
                value={dialogDraft.baseUrl}
                onChange={(e) => setDialogDraft((prev) => ({ ...prev, baseUrl: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('llmConfig.timeout.label')}</Label>
              <Input
                type="number"
                min={1}
                step={1}
                placeholder={t('llmConfig.timeout.placeholder')}
                value={dialogDraft.timeout}
                onChange={(e) => setDialogDraft((prev) => ({ ...prev, timeout: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('llmConfig.maxTokens.label')}</Label>
              <Input
                type="number"
                min={1}
                step={1}
                placeholder={t('llmConfig.maxTokens.placeholder')}
                value={dialogDraft.maxTokens}
                onChange={(e) => setDialogDraft((prev) => ({ ...prev, maxTokens: e.target.value }))}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>{t('llmConfig.apiKey.label')}</Label>
              <Input
                type="password"
                placeholder={dialogMode === 'create' ? t('llmConfig.apiKey.placeholder') : t('llmConfig.apiKey.updatePlaceholder')}
                value={dialogDraft.apiKey}
                onChange={(e) => setDialogDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
              />
            </div>
          </div>

          {dialogConnectionFeedback ? (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                dialogConnectionFeedback.type === 'success'
                  ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                  : 'border-red-500/40 text-red-600 dark:text-red-400'
              }`}
            >
              {dialogConnectionFeedback.type === 'success' ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{dialogConnectionFeedback.message}</span>
            </div>
          ) : null}

          <DialogFooter className="w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <div className="flex gap-2">
              {dialogMode === 'edit' && editingConfigId ? (
                <Button
                  variant="outline"
                  onClick={() => handleTestEditedConnection(editingConfigId)}
                  disabled={dialogBusy}
                >
                  {dialogTesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  {t('actions.testConnection')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleTestDraftConnection}
                  disabled={dialogBusy}
                >
                  {dialogTesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  {t('actions.testConnection')}
                </Button>
              )}

              {dialogMode === 'edit' && editingConfigId ? (
                <Button
                  variant="destructive"
                  onClick={handleDeleteInDialog}
                  disabled={dialogBusy}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('actions.delete')}
                </Button>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={closeDialog} disabled={dialogBusy}>
                {t('actions.cancel')}
              </Button>
              <Button onClick={handleSubmitDialog} disabled={dialogBusy}>
                {dialogSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {dialogMode === 'create' ? t('actions.add') : t('actions.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{t('timezone.title')}</CardTitle>
          <CardDescription>{t('timezone.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>{t('timezone.select.label')}</Label>
              <Select
                value={timezoneInput || ''}
                onValueChange={(value) => {
                  if (value === '__browser__') {
                    handleUseBrowserTimezone()
                  } else {
                    setTimezoneInput(value)
                  }
                }}
                disabled={timezoneLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('timezone.select.placeholder')} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {browserTimezone && (
                    <SelectGroup>
                      <SelectLabel className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        {t('timezone.select.browserGroup')}
                      </SelectLabel>
                      <SelectItem value="__browser__">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{browserTimezone}</span>
                          <span className="text-xs text-muted-foreground">({t('timezone.select.browserHint')})</span>
                        </div>
                      </SelectItem>
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>{t('timezone.select.commonGroup')}</SelectLabel>
                    {quickTimezoneOptions.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>{t('timezone.select.allGroup')}</SelectLabel>
                    {timezoneOptions
                      .filter((zone) => !quickTimezoneOptions.includes(zone))
                      .map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => void handleSaveTimezone()}
              disabled={timezoneLoading || !timezoneInput.trim()}
              className="shrink-0"
            >
              {timezoneLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {t('actions.save')}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {currentTimezone ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span>{t('timezone.current.status', { timezone: currentTimezone })}</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>{t('timezone.current.notSet')}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
