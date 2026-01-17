'use client'

import { Filter } from 'lucide-react'
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
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      {/* Time range */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">
          时间范围
        </Label>
        <Select
          value={filters.timeRange}
          onValueChange={(value) => onUpdate('timeRange', value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">今天</SelectItem>
            <SelectItem value="week">本周</SelectItem>
            <SelectItem value="month">本月</SelectItem>
            <SelectItem value="custom">自定义</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">
          状态
        </Label>
        <Select
          value={filters.status}
          onValueChange={(value) => onUpdate('status', value)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="error">失败</SelectItem>
            <SelectItem value="denied">拒绝</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1 flex-1 max-w-md">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">
          搜索
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            🔍
          </span>
          <Input
            placeholder="搜索接口路径..."
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
        高级筛选
        {hasAdvancedFilters && <Badge className="ml-2">已启用</Badge>}
      </Button>
    </div>
  )
}
