'use client'

import { Filter } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { LogFilters } from '@/types/logs'

interface QuickFiltersProps {
  filters: LogFilters
  hasAdvancedFilters: boolean
  onShowAdvanced: () => void
  onUpdate: (key: keyof LogFilters, value: any) => void
}

export function QuickFilters({
  filters,
  hasAdvancedFilters,
  onShowAdvanced,
  onUpdate,
}: QuickFiltersProps) {
  const t = useTranslations('logs')

  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      {/* Time range */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">
          {t('quickFilters.timeRange')}
        </Label>
        <Select
          value={filters.timeRange}
          onValueChange={(value) => onUpdate('timeRange', value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t('timeRange.today')}</SelectItem>
            <SelectItem value="week">{t('timeRange.week')}</SelectItem>
            <SelectItem value="month">{t('timeRange.month')}</SelectItem>
            <SelectItem value="custom">{t('timeRange.custom')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">
          {t('quickFilters.status')}
        </Label>
        <Select
          value={filters.status}
          onValueChange={(value) => onUpdate('status', value)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('quickFilters.statusAll')}</SelectItem>
            <SelectItem value="success">{t('status.success')}</SelectItem>
            <SelectItem value="error">{t('status.error')}</SelectItem>
            <SelectItem value="denied">{t('status.denied')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1 flex-1 max-w-md">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">
          {t('quickFilters.search')}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            🔍
          </span>
          <Input
            placeholder={t('quickFilters.searchPlaceholder')}
            value={filters.searchQuery}
            onChange={(e) => onUpdate('searchQuery', e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Advanced filters toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={onShowAdvanced}
        className="self-end"
      >
        <Filter className="h-4 w-4 mr-2" />
        {t('quickFilters.advanced')}
        {hasAdvancedFilters && <Badge className="ml-2">{t('quickFilters.enabled')}</Badge>}
      </Button>
    </div>
  )
}
