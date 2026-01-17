'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { LogFilters, HttpMethod } from '@/types/logs'

interface AdvancedFiltersProps {
  filters: LogFilters
  apiKeys?: Array<{ id: string; name: string; keyPreview: string }>
  onUpdate: (key: keyof LogFilters, value: any) => void
  onReset: () => void
  onApply: () => void
}

export function AdvancedFilters({
  filters,
  apiKeys,
  onUpdate,
  onReset,
  onApply,
}: AdvancedFiltersProps) {
  const toggleMethod = (method: HttpMethod) => {
    const current = filters.methods || []
    const updated = current.includes(method)
      ? current.filter(m => m !== method)
      : [...current, method]
    onUpdate('methods', updated)
  }

  return (
    <div className="px-4 py-4 border-t bg-muted/30 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* HTTP methods */}
        <div className="space-y-2">
          <Label>HTTP 方法</Label>
          <div className="flex flex-wrap gap-3">
            {(['GET', 'POST', 'PUT', 'DELETE'] as HttpMethod[]).map((method) => (
              <label key={method} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.methods?.includes(method) || false}
                  onCheckedChange={() => toggleMethod(method)}
                />
                <span className="text-sm">{method}</span>
              </label>
            ))}
          </div>
        </div>

        {/* IP address */}
        <div className="space-y-2">
          <Label>IP 地址</Label>
          <Input
            placeholder="输入 IP 地址..."
            value={filters.ipAddress || ''}
            onChange={(e) => onUpdate('ipAddress', e.target.value)}
          />
        </div>

        {/* API Key (global logs only) */}
        {apiKeys && (
          <div className="space-y-2">
            <Label>API Key</Label>
            <Select
              value={filters.apiKeyId || ''}
              onValueChange={(value) => onUpdate('apiKeyId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择 API Key" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部 API Keys</SelectItem>
                {apiKeys.map((key) => (
                  <SelectItem key={key.id} value={key.id}>
                    {key.name || key.keyPreview}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onReset}>
          重置筛选
        </Button>
        <Button onClick={onApply}>
          应用筛选
        </Button>
      </div>
    </div>
  )
}
