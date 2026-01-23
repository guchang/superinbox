'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { LogFilters, ExportFormat } from '@/types/logs'
import { exportLogsSync, createExportTask } from '@/lib/api/logs'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

const DEFAULT_FIELDS = [
  'timestamp',
  'method',
  'endpoint',
  'statusCode',
  'duration',
]

interface LogExportDialogProps {
  open: boolean
  onClose: () => void
  filters: LogFilters
  logCount: number
}

export function LogExportDialog({
  open,
  onClose,
  filters,
  logCount,
}: LogExportDialogProps) {
  const t = useTranslations('logs')
  const errors = useTranslations('errors')
  const [isExporting, setIsExporting] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [fields, setFields] = useState<string[]>(DEFAULT_FIELDS)
  const allFields = [
    { key: 'timestamp', label: t('export.fields.timestamp') },
    { key: 'method', label: t('export.fields.method') },
    { key: 'endpoint', label: t('export.fields.endpoint') },
    { key: 'statusCode', label: t('export.fields.statusCode') },
    { key: 'duration', label: t('export.fields.duration') },
    { key: 'ip', label: t('export.fields.ip') },
    { key: 'userAgent', label: t('export.fields.userAgent') },
    { key: 'requestBody', label: t('export.fields.requestBody') },
  ]

  const isAsyncExport = logCount >= 1000

  const handleExport = async () => {
    if (fields.length === 0) {
      toast.error(t('export.validation'))
      return
    }

    setIsExporting(true)

    try {
      if (isAsyncExport) {
        // Async export
        const { data } = await createExportTask({
          format,
          fields,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          filters,
        })

        toast.success(t('export.asyncSuccess.title'), {
          description: t('export.asyncSuccess.description'),
        })

        onClose()
      } else {
        // Sync export
        const blob = await exportLogsSync(filters, format)

        // Trigger download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs-${Date.now()}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast.success(t('export.success'))
        onClose()
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, errors, t('export.failure')))
    } finally {
      setIsExporting(false)
    }
  }

  const toggleField = (field: string) => {
    setFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('export.title')}</DialogTitle>
          <DialogDescription>
            {t('export.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format selection */}
          <div className="space-y-2">
            <Label>{t('export.format')}</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal cursor-pointer">
                  {t('export.formats.csv')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="font-normal cursor-pointer">
                  {t('export.formats.json')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="font-normal cursor-pointer">
                  {t('export.formats.xlsx')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Field selection */}
          <div className="space-y-2">
            <Label>{t('export.fieldsLabel')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {allFields.map(field => (
                <label key={field.key} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={fields.includes(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  <span className="text-sm">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Time range hint */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>{t('export.hint.title')}</strong> {t('export.hint.description', { count: logCount.toLocaleString() })}
            </AlertDescription>
          </Alert>

          {/* Large dataset warning */}
          {isAsyncExport && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('export.asyncWarning')}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            {t('export.actions.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={isExporting || fields.length === 0}>
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isExporting ? t('export.actions.preparing') : t('export.actions.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
