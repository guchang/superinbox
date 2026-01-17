'use client'

import { useState } from 'react'
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

const DEFAULT_FIELDS = [
  'timestamp',
  'method',
  'endpoint',
  'statusCode',
  'duration',
]

const ALL_FIELDS = [
  { key: 'timestamp', label: '时间戳' },
  { key: 'method', label: 'HTTP 方法' },
  { key: 'endpoint', label: '接口路径' },
  { key: 'statusCode', label: '状态码' },
  { key: 'duration', label: '耗时' },
  { key: 'ip', label: 'IP 地址' },
  { key: 'userAgent', label: 'User-Agent' },
  { key: 'requestBody', label: '请求体' },
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
  const [isExporting, setIsExporting] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [fields, setFields] = useState<string[]>(DEFAULT_FIELDS)

  const isAsyncExport = logCount >= 1000

  const handleExport = async () => {
    if (fields.length === 0) {
      toast.error('请至少选择一个字段')
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

        toast.success('导出任务已创建', {
          description: '完成后将自动下载',
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

        toast.success('导出成功')
        onClose()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
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
          <DialogTitle>导出访问日志</DialogTitle>
          <DialogDescription>
            选择导出格式和要包含的字段
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format selection */}
          <div className="space-y-2">
            <Label>导出格式</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal cursor-pointer">
                  CSV - 适合 Excel
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="font-normal cursor-pointer">
                  JSON - 适合程序处理
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="font-normal cursor-pointer">
                  XLSX - Excel 原生格式
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Field selection */}
          <div className="space-y-2">
            <Label>包含字段</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_FIELDS.map(field => (
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
              <strong>时间范围：</strong> 将导出当前筛选器设定的时间范围
              （约 {logCount.toLocaleString()} 条记录）
            </AlertDescription>
          </Alert>

          {/* Large dataset warning */}
          {isAsyncExport && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                由于数据量较大（超过 1000 条），将使用异步导出。
                完成后会通过通知提示，您可以继续其他操作。
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={isExporting || fields.length === 0}>
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isExporting ? '准备中...' : '开始导出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
