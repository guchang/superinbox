'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Settings, Sparkles } from 'lucide-react'
import { RetroactiveMode, RetroactiveConfig } from '@/types'

interface RetroactiveModeSelectorProps {
  value: RetroactiveMode
  config?: RetroactiveConfig
  onChange: (mode: RetroactiveMode, config?: RetroactiveConfig) => void
  disabled?: boolean
}

export function RetroactiveModeSelector({
  value,
  config,
  onChange,
  disabled = false,
}: RetroactiveModeSelectorProps) {
  const t = useTranslations('routingPage.retroactive')
  const [showBatchConfig, setShowBatchConfig] = useState(false)
  const [tempConfig, setTempConfig] = useState<RetroactiveConfig>(
    config || {
      batchSize: 10,
      delayBetweenBatches: 2000,
      filters: {
        status: 'completed',
      },
    }
  )

  const handleModeChange = (newValue: RetroactiveMode) => {
    if (newValue === RetroactiveMode.NONE) {
      onChange(newValue, undefined)
    } else if (newValue === RetroactiveMode.APPLY) {
      // For apply mode, use default config
      onChange(newValue, {
        batchSize: 20,
        delayBetweenBatches: 1000,
      })
    } else if (newValue === RetroactiveMode.BATCH) {
      // Show batch config dialog
      setShowBatchConfig(true)
    }
  }

  const handleApplyConfirm = () => {
    onChange(RetroactiveMode.APPLY, {
      batchSize: 20,
      delayBetweenBatches: 1000,
    })
  }

  const handleBatchConfirm = () => {
    onChange(RetroactiveMode.BATCH, tempConfig)
    setShowBatchConfig(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="retroactive-mode">{t('label')}</Label>
        <Select
          value={value}
          onValueChange={(v) => handleModeChange(v as RetroactiveMode)}
          disabled={disabled}
        >
          <SelectTrigger id="retroactive-mode">
            <SelectValue placeholder={t('placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={RetroactiveMode.NONE}>
              <div className="flex items-center gap-2">
                <span>{t('modes.none.label')}</span>
                <Badge variant="secondary">{t('modes.none.badge')}</Badge>
              </div>
            </SelectItem>
            <SelectItem value={RetroactiveMode.APPLY}>
              <div className="flex items-center gap-2">
                <span>{t('modes.apply.label')}</span>
                <Badge variant="default">{t('modes.apply.badge')}</Badge>
              </div>
            </SelectItem>
            <SelectItem value={RetroactiveMode.BATCH}>
              <div className="flex items-center gap-2">
                <span>{t('modes.batch.label')}</span>
                <Badge className="bg-purple-500 hover:bg-purple-600">
                  {t('modes.batch.badge')}
                </Badge>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {value === RetroactiveMode.NONE && t('modes.none.description')}
          {value === RetroactiveMode.APPLY && t('modes.apply.description')}
          {value === RetroactiveMode.BATCH && t('modes.batch.description')}
        </p>
      </div>

      {/* Apply Mode Warning */}
      {value === RetroactiveMode.APPLY && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {t('applyWarning.title')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                {t('applyWarning.title')}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>{t('applyWarning.message')}</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{t('applyWarning.note1')}</li>
                  <li>{t('applyWarning.note2')}</li>
                  <li>{t('applyWarning.note3')}</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleModeChange(RetroactiveMode.NONE)}>
                {t('applyWarning.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleApplyConfirm}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {t('applyWarning.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Batch Mode Configuration */}
      {value === RetroactiveMode.BATCH && (
        <AlertDialog open={showBatchConfig} onOpenChange={setShowBatchConfig}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Settings className="mr-2 h-4 w-4" />
              {t('batchConfig.title')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                {t('batchConfig.title')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('batchConfig.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-4">
              {/* Batch Size */}
              <div className="space-y-2">
                <Label htmlFor="batch-size">{t('batchConfig.batchSize')}</Label>
                <Input
                  id="batch-size"
                  type="number"
                  min="1"
                  max="100"
                  value={tempConfig.batchSize}
                  onChange={(e) =>
                    setTempConfig({ ...tempConfig, batchSize: Number(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t('batchConfig.batchSizeHint')}
                </p>
              </div>

              {/* Delay Between Batches */}
              <div className="space-y-2">
                <Label htmlFor="delay">{t('batchConfig.delay')}</Label>
                <Input
                  id="delay"
                  type="number"
                  min="100"
                  max="10000"
                  step="100"
                  value={tempConfig.delayBetweenBatches}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      delayBetweenBatches: Number(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t('batchConfig.delayHint')}
                </p>
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <Label>{t('batchConfig.filters')}</Label>
                <div className="grid gap-3">
                  <div>
                    <Label htmlFor="filter-status" className="text-xs">
                      {t('batchConfig.filterStatus')}
                    </Label>
                    <Select
                      value={tempConfig.filters?.status}
                      onValueChange={(v) =>
                        setTempConfig({
                          ...tempConfig,
                          filters: { ...tempConfig.filters, status: v },
                        })
                      }
                    >
                      <SelectTrigger id="filter-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed">
                          {t('batchConfig.statusCompleted')}
                        </SelectItem>
                        <SelectItem value="pending">
                          {t('batchConfig.statusPending')}
                        </SelectItem>
                        <SelectItem value="failed">
                          {t('batchConfig.statusFailed')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="filter-category" className="text-xs">
                      {t('batchConfig.filterCategory')}
                    </Label>
                    <Input
                      id="filter-category"
                      placeholder={t('batchConfig.categoryPlaceholder')}
                      value={tempConfig.filters?.category || ''}
                      onChange={(e) =>
                        setTempConfig({
                          ...tempConfig,
                          filters: { ...tempConfig.filters, category: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-purple-50 p-3 border border-purple-200">
                <p className="text-sm text-purple-900">
                  <strong>{t('batchConfig.summaryLabel')}:</strong>{' '}
                  {t('batchConfig.summaryText', {
                    size: tempConfig.batchSize,
                    delay: tempConfig.delayBetweenBatches,
                  })}
                </p>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowBatchConfig(false)}>
                {t('batchConfig.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBatchConfirm}
                className="bg-purple-500 hover:bg-purple-600"
              >
                {t('batchConfig.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
