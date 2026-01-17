# 访问日志与审计系统实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 为 SuperInbox Web 管理后台构建完整的访问日志与审计系统，支持查看全局和单个 API Key 的访问记录、多维度筛选、详情查看和日志导出功能。

**架构:** 使用 Next.js 15 App Router + TanStack Query 构建客户端数据获取，URLSearchParams 管理筛选状态，shadcn/ui 组件库构建 UI。权限控制基于 JWT Token 中的 `admin:full` scope。

**技术栈:** Next.js 15, React 19, TypeScript, TanStack Query, shadcn/ui, Tailwind CSS, sonner, date-fns

---

## 前置准备

### 开始前确认

**必要环境检查：**
- Node.js >= 18.0.0
- 后端 API 已实现日志相关接口（`/backend/src/auth/controllers/logs.controller.ts`）
- 后端运行在 `http://localhost:3001` 或配置的 `API_BASE_URL`

**相关文档：**
- 设计文档: `/docs/designs/2026-01-17-access-logs-system-design.md`
- 视觉原型: `/docs/designs/access-logs-wireframe.html`
- API 文档: `/SuperInbox-Core-API文档.md` (第 8 章：API 访问日志与审计)

**权限要求：**
- 需要登录用户的 JWT Token 包含 `admin:full` scope
- 测试时使用管理员账号或手动修改 Token 的 scopes

---

## Phase 1: 基础架构与类型定义 (2-3 hours)

### Task 1: 创建日志类型定义

**文件：**
- Create: `web/src/types/logs.ts`

**Step 1: 定义访问日志类型**

```typescript
// web/src/types/logs.ts

import { ApiResponse } from '.'

// 访问日志状态
export type LogStatus = 'success' | 'error' | 'denied'

// HTTP 方法
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// 访问日志实体
export interface AccessLog {
  id: string
  timestamp: string
  method: HttpMethod
  endpoint: string
  fullUrl: string
  statusCode: number
  status: LogStatus
  duration: number // 响应时间（毫秒）
  ip: string
  userAgent: string
  apiKeyId?: string
  apiKeyName?: string
  requestHeaders?: Record<string, string>
  requestBody?: unknown
  responseSize: number
  error?: {
    code: string
    message: string
    details?: unknown
  }
  queryParams?: Record<string, string>
}

// 筛选条件
export interface LogFilters {
  timeRange: 'today' | 'week' | 'month' | 'custom'
  startDate?: string
  endDate?: string
  status?: LogStatus | 'all'
  searchQuery?: string
  methods?: HttpMethod[]
  ipAddress?: string
  apiKeyId?: string
  page: number
  pageSize: number
}

// 日志列表响应
export interface LogsResponse {
  data: AccessLog[]
  total: number
  page: number
  limit: number
}

// 导出格式
export type ExportFormat = 'csv' | 'json' | 'xlsx'

// 导出请求
export interface ExportRequest {
  format: ExportFormat
  fields: string[]
  startDate: string
  endDate: string
  filters?: Partial<LogFilters>
}

// 导出任务状态
export type ExportStatus = 'processing' | 'completed' | 'failed'

// 导出任务
export interface ExportTask {
  id: string
  format: ExportFormat
  status: ExportStatus
  fileName: string
  fileSize: number
  recordCount: number
  createdAt: string
  completedAt?: string
  expiresAt: string
  downloadUrl: string
  error?: string
}

// 导出响应
export interface ExportResponse {
  data: {
    exportId: string
    status: ExportStatus
    message?: string
  }
}
```

**Step 2: 提交类型定义**

```bash
cd web
git add src/types/logs.ts
git commit -m "feat(logs): add access log type definitions"
```

---

### Task 2: 创建日志 API 客户端

**文件：**
- Create: `web/src/lib/api/logs.ts`

**Step 1: 实现 API 客户端函数**

```typescript
// web/src/lib/api/logs.ts

import { apiClient } from './client'
import type {
  AccessLog,
  LogFilters,
  LogsResponse,
  ExportRequest,
  ExportTask,
  ExportResponse,
} from '@/types/logs'

/**
 * 获取全局访问日志
 */
export async function getAccessLogs(filters: LogFilters): Promise<LogsResponse> {
  const params = new URLSearchParams()

  // 基础分页
  params.append('page', String(filters.page))
  params.append('limit', String(filters.pageSize))

  // 时间范围
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)

  // 状态筛选
  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status)
  }

  // 搜索
  if (filters.searchQuery) {
    params.append('endpoint', filters.searchQuery)
  }

  // HTTP 方法
  if (filters.methods && filters.methods.length > 0) {
    filters.methods.forEach(method => params.append('method', method))
  }

  // IP 地址
  if (filters.ipAddress) {
    params.append('ip', filters.ipAddress)
  }

  // API Key 筛选（全局日志专用）
  if (filters.apiKeyId) {
    params.append('apiKeyId', filters.apiKeyId)
  }

  return apiClient.get<LogsResponse>(`/auth/logs?${params.toString()}`)
}

/**
 * 获取单个 API Key 的访问日志
 */
export async function getApiKeyLogs(
  keyId: string,
  filters: LogFilters
): Promise<LogsResponse> {
  const params = new URLSearchParams()

  params.append('page', String(filters.page))
  params.append('limit', String(filters.pageSize))

  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)

  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status)
  }

  if (filters.searchQuery) {
    params.append('endpoint', filters.searchQuery)
  }

  if (filters.methods && filters.methods.length > 0) {
    filters.methods.forEach(method => params.append('method', method))
  }

  return apiClient.get<LogsResponse>(`/auth/api-keys/${keyId}/logs?${params.toString()}`)
}

/**
 * 创建导出任务（异步导出）
 */
export async function createExportTask(
  request: ExportRequest
): Promise<ExportResponse> {
  return apiClient.post<ExportResponse>('/auth/logs/export', request)
}

/**
 * 获取导出任务状态
 */
export async function getExportStatus(exportId: string): Promise<{ data: ExportTask }> {
  return apiClient.get<{ data: ExportTask }>(`/auth/logs/exports/${exportId}`)
}

/**
 * 下载导出文件
 */
export async function downloadExportFile(exportId: string): Promise<Blob> {
  const token = localStorage.getItem('superinbox_auth_token')
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

  const response = await fetch(`${API_BASE_URL}/auth/logs/exports/${exportId}/download`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to download export file')
  }

  return response.blob()
}

/**
 * 同步导出（小数据集）
 */
export async function exportLogsSync(filters: LogFilters, format: string): Promise<Blob> {
  const params = new URLSearchParams()

  // 构建查询参数（与 getAccessLogs 相同）
  params.append('page', String(filters.page))
  params.append('limit', String(filters.pageSize))

  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)
  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status)
  }
  if (filters.searchQuery) {
    params.append('endpoint', filters.searchQuery)
  }

  const token = localStorage.getItem('superinbox_auth_token')
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

  const response = await fetch(`${API_BASE_URL}/auth/logs/export?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to export logs')
  }

  return response.blob()
}
```

**Step 2: 提交 API 客户端**

```bash
cd web
git add src/lib/api/logs.ts
git commit -m "feat(logs): add logs API client functions"
```

---

### Task 3: 创建筛选器管理 Hook

**文件：**
- Create: `web/src/lib/hooks/use-log-filters.ts`

**Step 1: 实现 useLogFilters Hook**

```typescript
// web/src/lib/hooks/use-log-filters.ts

'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useMemo, useCallback } from 'react'
import type { LogFilters } from '@/types/logs'

const DEFAULT_FILTERS: LogFilters = {
  timeRange: 'today',
  status: 'all',
  searchQuery: '',
  methods: [],
  page: 1,
  pageSize: 20,
}

export function useLogFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // 从 URL 读取筛选条件
  const filters = useMemo((): LogFilters => {
    return {
      timeRange: (searchParams.get('timeRange') as LogFilters['timeRange']) || DEFAULT_FILTERS.timeRange,
      status: (searchParams.get('status') as LogFilters['status']) || DEFAULT_FILTERS.status,
      searchQuery: searchParams.get('q') || '',
      methods: searchParams.get('methods')?.split(',') as LogFilters['methods'] || [],
      ipAddress: searchParams.get('ip') || undefined,
      apiKeyId: searchParams.get('apiKey') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    }
  }, [searchParams])

  // 计算实际的时间范围（用于 API 调用）
  const dateRange = useMemo(() => {
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    switch (filters.timeRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        startDate = new Date(now.setDate(now.getDate() - 30))
        break
      case 'custom':
        startDate = filters.startDate ? new Date(filters.startDate) : new Date(now.setDate(now.getDate() - 7))
        if (filters.endDate) {
          endDate = new Date(filters.endDate)
        }
        break
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0))
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  }, [filters])

  // 更新单个筛选条件
  const updateFilter = useCallback(<K extends keyof LogFilters>(key: K, value: LogFilters[K]) => {
    const newParams = new URLSearchParams(searchParams)

    if (value === undefined || value === '' || value === DEFAULT_FILTERS[key]) {
      newParams.delete(key)
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        newParams.delete(key)
      } else {
        newParams.set(key, value.join(','))
      }
    } else {
      newParams.set(key, String(value))
    }

    // 重置页码（除了更新 page 本身）
    if (key !== 'page') {
      newParams.set('page', '1')
    }

    router.push(`?${newParams.toString()}`)
  }, [searchParams, router])

  // 重置所有筛选条件
  const resetFilters = useCallback(() => {
    router.push('/settings/logs')
  }, [router])

  return {
    filters,
    dateRange,
    updateFilter,
    resetFilters,
  }
}
```

**Step 2: 提交 Hook**

```bash
cd web
git add src/lib/hooks/use-log-filters.ts
git commit -m "feat(logs): add useLogFilters hook for URL state management"
```

---

## Phase 2: UI 组件实现 (4-5 hours)

### Task 4: 创建日志筛选器组件

**文件：**
- Create: `web/src/components/logs/LogFilters.tsx`
- Create: `web/src/components/logs/QuickFilters.tsx`
- Create: `web/src/components/logs/AdvancedFilters.tsx`
- Create: `web/src/components/logs/FilterTags.tsx`

**Step 1: 实现快速筛选器**

```typescript
// web/src/components/logs/QuickFilters.tsx

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
      {/* 时间范围 */}
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

      {/* 状态 */}
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

      {/* 搜索 */}
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

      {/* 高级筛选切换 */}
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
```

**Step 2: 实现高级筛选器**

```typescript
// web/src/components/logs/AdvancedFilters.tsx

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
        {/* HTTP 方法 */}
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

        {/* IP 地址 */}
        <div className="space-y-2">
          <Label>IP 地址</Label>
          <Input
            placeholder="输入 IP 地址..."
            value={filters.ipAddress || ''}
            onChange={(e) => onUpdate('ipAddress', e.target.value)}
          />
        </div>

        {/* API Key（仅全局日志） */}
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

      {/* 操作按钮 */}
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
```

**Step 3: 实现筛选标签**

```typescript
// web/src/components/logs/FilterTags.tsx

'use client'

import type { LogFilters } from '@/types/logs'

interface FilterTagsProps {
  filters: LogFilters
  onRemove: (key: keyof LogFilters) => void
}

export function FilterTags({ filters, onRemove }: FilterTagsProps) {
  const tags = []

  if (filters.timeRange !== 'today') {
    const labels = { week: '本周', month: '本月', custom: '自定义' }
    tags.push({
      label: `时间: ${labels[filters.timeRange as keyof typeof labels] || filters.timeRange}`,
      key: 'timeRange' as const,
    })
  }

  if (filters.status && filters.status !== 'all') {
    const labels = { success: '成功', error: '失败', denied: '拒绝' }
    tags.push({
      label: `状态: ${labels[filters.status] || filters.status}`,
      key: 'status' as const,
    })
  }

  if (filters.searchQuery) {
    tags.push({
      label: `搜索: ${filters.searchQuery}`,
      key: 'searchQuery' as const,
    })
  }

  if (filters.methods && filters.methods.length > 0) {
    tags.push({
      label: `方法: ${filters.methods.join(', ')}`,
      key: 'methods' as const,
    })
  }

  if (filters.ipAddress) {
    tags.push({
      label: `IP: ${filters.ipAddress}`,
      key: 'ipAddress' as const,
    })
  }

  if (tags.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-4 py-3 flex-wrap bg-muted/50 rounded-lg">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="inline-flex items-center gap-1 px-3 py-1 bg-white border rounded-md text-sm"
        >
          {tag.label}
          <button
            onClick={() => onRemove(tag.key)}
            className="text-muted-foreground hover:text-destructive"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}
```

**Step 4: 实现主筛选器组件**

```typescript
// web/src/components/logs/LogFilters.tsx

'use client'

import { useState } from 'react'
import { QuickFilters } from './QuickFilters'
import { AdvancedFilters } from './AdvancedFilters'
import { FilterTags } from './FilterTags'
import type { LogFilters } from '@/types/logs'

interface LogFiltersProps {
  filters: LogFilters
  apiKeys?: Array<{ id: string; name: string; keyPreview: string }>
  onUpdate: (key: keyof LogFilters, value: any) => void
  onReset: () => void
}

export function LogFilters({ filters, apiKeys, onUpdate, onReset }: LogFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const hasAdvancedFilters =
    (filters.methods && filters.methods.length > 0) ||
    !!filters.ipAddress ||
    !!filters.apiKeyId

  return (
    <div className="bg-card rounded-lg border">
      <QuickFilters
        filters={filters}
        hasAdvancedFilters={hasAdvancedFilters}
        onShowAdvanced={() => setShowAdvanced(!showAdvanced)}
        onUpdate={onUpdate}
      />

      {showAdvanced && (
        <AdvancedFilters
          filters={filters}
          apiKeys={apiKeys}
          onUpdate={onUpdate}
          onReset={onReset}
          onApply={() => setShowAdvanced(false)}
        />
      )}

      <FilterTags filters={filters} onRemove={onUpdate} />
    </div>
  )
}
```

**Step 5: 提交筛选器组件**

```bash
cd web
git add src/components/logs/
git commit -m "feat(logs): add LogFilters component with quick and advanced filters"
```

---

### Task 5: 创建日志表格组件

**文件：**
- Create: `web/src/components/logs/LogTable.tsx`
- Create: `web/src/components/logs/LogDetailRow.tsx`
- Create: `web/src/components/logs/LogBadges.tsx`

**Step 1: 创建徽章组件**

```typescript
// web/src/components/logs/LogBadges.tsx

'use client'

import { Badge } from '@/components/ui/badge'
import type { LogStatus, HttpMethod } from '@/types/logs'

// HTTP 方法徽章
export function MethodBadge({ method }: { method: HttpMethod }) {
  const variants = {
    GET: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    POST: 'bg-green-100 text-green-800 hover:bg-green-200',
    PUT: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
    DELETE: 'bg-red-100 text-red-800 hover:bg-red-200',
    PATCH: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  }

  return (
    <Badge className={variants[method] || 'bg-gray-100'} variant="secondary">
      {method}
    </Badge>
  )
}

// 状态徽章
export function StatusBadge({ status, statusCode }: { status: LogStatus; statusCode: number }) {
  const variants = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    denied: 'bg-yellow-100 text-yellow-800',
  }

  const labels = {
    success: '成功',
    error: '失败',
    denied: '拒绝',
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={variants[status]} variant="secondary">
        {labels[status]}
      </Badge>
      <span className="text-xs text-muted-foreground">{statusCode}</span>
    </div>
  )
}

// 耗时徽章
export function LatencyBadge({ duration }: { duration: number }) {
  const getColor = () => {
    if (duration < 100) return 'text-green-600'
    if (duration < 500) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <span className={`text-sm font-medium ${getColor()}`}>
      {duration}ms
    </span>
  )
}
```

**Step 2: 实现详情展开行**

```typescript
// web/src/components/logs/LogDetailRow.tsx

'use client'

import { AccessLog } from '@/types/logs'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { formatDate, formatBytes } from '@/lib/utils'

interface LogDetailRowProps {
  log: AccessLog
}

export function LogDetailRow({ log }: LogDetailRowProps) {
  const [showHeaders, setShowHeaders] = useState(false)
  const [showError, setShowError] = useState(false)

  return (
    <div className="p-6 bg-muted/30 space-y-6">
      {/* 请求详情 */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          📤 请求详情
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">完整 URL</div>
            <code className="text-xs break-all">{log.fullUrl}</code>
          </Card>

          {log.requestBody && (
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">请求体</div>
              <pre className="text-xs overflow-auto max-h-32">
                {JSON.stringify(log.requestBody, null, 2)}
              </pre>
            </Card>
          )}
        </div>

        {log.requestHeaders && (
          <Collapsible open={showHeaders} onOpenChange={setShowHeaders}>
            <CollapsibleTrigger className="text-xs text-primary hover:underline">
              查看请求头
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <Card className="p-3">
                {Object.entries(log.requestHeaders).map(([key, value]) => (
                  <div key={key} className="text-xs mb-1">
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className="font-mono">{value as string}</span>
                  </div>
                ))}
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* 响应详情 */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">📥 响应详情</h4>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">状态码:</span>{' '}
            <span className="font-medium">{log.statusCode}</span>
          </div>
          <div>
            <span className="text-muted-foreground">响应大小:</span>{' '}
            <span>{formatBytes(log.responseSize)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">响应时间:</span>{' '}
            <span>{log.duration}ms</span>
          </div>
        </div>
      </div>

      {/* 错误信息 */}
      {log.status === 'error' && log.error && (
        <div className="space-y-3">
          <Collapsible open={showError} onOpenChange={setShowError}>
            <CollapsibleTrigger className="text-sm font-semibold text-destructive flex items-center gap-2">
              ❌ 错误信息 <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <Card className="p-4 border-destructive/50 bg-destructive/10">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">错误码:</span>{' '}
                    <code className="text-destructive">{log.error.code}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">错误消息:</span>{' '}
                    <span>{log.error.message}</span>
                  </div>
                  {log.error.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        查看详细信息
                      </summary>
                      <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto">
                        {JSON.stringify(log.error.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* 元数据 */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div>
          <span>User-Agent:</span>{' '}
          <span className="truncate max-w-md inline-block align-bottom">
            {log.userAgent}
          </span>
        </div>
        <div>
          <span>IP:</span>{' '}
          <span>{log.ip}</span>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: 实现主表格组件**

```typescript
// web/src/components/logs/LogTable.tsx

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Code } from '@/components/ui/code'
import { AccessLog } from '@/types/logs'
import { MethodBadge, StatusBadge, LatencyBadge } from './LogBadges'
import { LogDetailRow } from './LogDetailRow'
import { Pagination } from './Pagination'

interface LogTableProps {
  logs: AccessLog[]
  total: number
  page: number
  pageSize: number
  loading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  isGlobalView?: boolean
}

export function LogTable({
  logs,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
  isGlobalView = false,
}: LogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(logs.map(log => log.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">
        暂无日志记录
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedIds.size === logs.length && logs.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead className="w-[180px]">时间</TableHead>
            <TableHead>接口路径</TableHead>
            <TableHead className="w-[100px]">方法</TableHead>
            <TableHead className="w-[120px]">状态</TableHead>
            <TableHead className="w-[100px]">耗时</TableHead>
            <TableHead className="w-[150px]">IP 地址</TableHead>
            {isGlobalView && (
              <TableHead className="w-[180px]">API Key</TableHead>
            )}
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <>
              <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(log.id)}
                    onCheckedChange={() => toggleSelect(log.id)}
                  />
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-col">
                    <span>{format(new Date(log.timestamp), 'yyyy-MM-dd')}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Code className="text-sm">{log.endpoint}</Code>
                </TableCell>
                <TableCell>
                  <MethodBadge method={log.method} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={log.status} statusCode={log.statusCode} />
                </TableCell>
                <TableCell>
                  <LatencyBadge duration={log.duration} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.ip}
                </TableCell>
                {isGlobalView && (
                  <TableCell className="text-sm">
                    {log.apiKeyName || 'N/A'}
                  </TableCell>
                )}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleExpand(log.id)}
                  >
                    {expandedId === log.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>

              {expandedId === log.id && (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <LogDetailRow log={log} />
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>

      <Pagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  )
}
```

**Step 4: 提交表格组件**

```bash
cd web
git add src/components/logs/
git commit -m "feat(logs): add LogTable component with expandable details"
```

---

### Task 6: 创建分页组件

**文件：**
- Create: `web/src/components/logs/Pagination.tsx`

**Step 1: 实现分页组件**

```typescript
// web/src/components/logs/Pagination.tsx

'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaginationProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 7

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    pages.push(1)

    if (page > 3) {
      pages.push('...')
    }

    const startPage = Math.max(2, page - 1)
    const endPage = Math.min(totalPages - 1, page + 1)

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    if (page < totalPages - 2) {
      pages.push('...')
    }

    pages.push(totalPages)

    return pages
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/50">
      <div className="text-sm text-muted-foreground">
        显示 {start}-{end} 条，共 {total.toLocaleString()} 条
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          上一页
        </Button>

        {getPageNumbers().map((p, i) => (
          typeof p === 'number' ? (
            <Button
              key={i}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              className="w-9"
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ) : (
            <span key={i} className="px-2 text-muted-foreground">
              {p}
            </span>
          )
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
        >
          下一页
        </Button>

        {onPageSizeChange && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20/页</SelectItem>
              <SelectItem value="50">50/页</SelectItem>
              <SelectItem value="100">100/页</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
```

**Step 2: 提交分页组件**

```bash
cd web
git add src/components/logs/Pagination.tsx
git commit -m "feat(logs): add Pagination component"
```

---

## Phase 3: 页面实现 (2-3 hours)

### Task 7: 创建全局日志页面

**文件：**
- Create: `web/src/app/(dashboard)/settings/logs/page.tsx`

**Step 1: 实现全局日志页面**

```typescript
// web/src/app/(dashboard)/settings/logs/page.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowLeftToLine } from 'lucide-react'
import Link from 'next/link'
import { getAccessLogs } from '@/lib/api/logs'
import { useLogFilters } from '@/lib/hooks/use-log-filters'
import { useAuth } from '@/lib/hooks/use-auth'
import { LogTable } from '@/components/logs/LogTable'
import { LogFilters } from '@/components/logs/LogFilters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from '@/components/ui/alert'

export default function GlobalLogsPage() {
  const { authState } = useAuth()
  const { filters, dateRange, updateFilter, resetFilters } = useLogFilters()

  // 权限检查
  if (!authState.user?.scopes.includes('admin:full')) {
    return (
      <AlertCircle>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>权限不足</AlertTitle>
        <AlertDescription>
          您需要 admin:full 权限才能访问此页面
        </AlertDescription>
      </AlertCircle>
    )
  }

  // 获取日志数据
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['logs', 'global', filters, dateRange],
    queryFn: () => getAccessLogs({
      ...filters,
      ...dateRange,
    }),
  })

  const logs = data?.data || []
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">访问日志审计</h1>
          <p className="text-muted-foreground">
            查看和分析所有 API Key 的访问记录
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/settings/statistics">
              📊 查看统计
            </Link>
          </Button>
          <Button>
            📥 导出日志
          </Button>
        </div>
      </div>

      {/* 筛选器 */}
      <LogFilters
        filters={filters}
        onUpdate={updateFilter}
        onReset={resetFilters}
      />

      {/* 日志表格 */}
      <LogTable
        logs={logs}
        total={total}
        page={filters.page}
        pageSize={filters.pageSize}
        loading={isLoading}
        onPageChange={(page) => updateFilter('page', page)}
        onPageSizeChange={(pageSize) => updateFilter('pageSize', pageSize)}
        isGlobalView={true}
      />
    </div>
  )
}
```

**Step 2: 提交全局日志页面**

```bash
cd web
git add src/app/\(dashboard\)/settings/logs/page.tsx
git commit -m "feat(logs): add global access logs page"
```

---

### Task 8: 创建单个 Key 的日志页面

**文件：**
- Create: `web/src/app/(dashboard)/settings/api-keys/[id]/logs/page.tsx`

**Step 1: 实现单个 Key 日志页面**

```typescript
// web/src/app/(dashboard)/settings/api-keys/[id]/logs/page.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getApiKeyLogs, getAccessLogs } from '@/lib/api/logs'
import { useLogFilters } from '@/lib/hooks/use-log-filters'
import { useAuth } from '@/lib/hooks/use-auth'
import { LogTable } from '@/components/logs/LogTable'
import { LogFilters } from '@/components/logs/LogFilters'
import { Button } from '@/components/ui/button'

export default function ApiKeyLogsPage() {
  const params = useParams()
  const keyId = params.id as string
  const { authState } = useAuth()
  const { filters, dateRange, updateFilter, resetFilters } = useLogFilters()

  // 权限检查
  if (!authState.user?.scopes.includes('admin:full')) {
    return (
      <div className="text-center py-8 text-destructive">
        权限不足：需要 admin:full 权限
      </div>
    )
  }

  // 获取该 Key 的信息
  const { data: apiKey } = useQuery({
    queryKey: ['apiKey', keyId],
    queryFn: async () => {
      // 复用现有的 getApiKey 函数
      const { getApiKey } = await import('@/lib/api/api-keys')
      return getApiKey(keyId)
    },
  })

  // 获取日志（默认筛选该 Key）
  const { data, isLoading, error } = useQuery({
    queryKey: ['logs', 'apiKey', keyId, filters, dateRange],
    queryFn: () => getApiKeyLogs(keyId, {
      ...filters,
      ...dateRange,
    }),
  })

  const logs = data?.data || []
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      {/* Key 信息头部 */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <Link
          href="/settings/api-keys"
          className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          返回 API Keys
        </Link>
        <h1 className="text-2xl font-bold mb-2">
          {apiKey?.name || '未命名 Key'}
        </h1>
        <div className="flex gap-6 text-sm opacity-90">
          <span>Key: {apiKey?.keyPreview || 'N/A'}</span>
          <span>•</span>
          <span>创建于: {apiKey?.createdAt ? new Date(apiKey.createdAt).toLocaleDateString() : 'N/A'}</span>
          <span>•</span>
          <span>共 {total.toLocaleString()} 次调用</span>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
            📊 查看统计
          </Button>
          <Button variant="outline" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
            ✏️ 编辑 Key
          </Button>
        </div>
      </div>

      {/* 筛选器 */}
      <LogFilters
        filters={filters}
        onUpdate={updateFilter}
        onReset={resetFilters}
      />

      {/* 日志表格 */}
      <LogTable
        logs={logs}
        total={total}
        page={filters.page}
        pageSize={filters.pageSize}
        loading={isLoading}
        onPageChange={(page) => updateFilter('page', page)}
        onPageSizeChange={(pageSize) => updateFilter('pageSize', pageSize)}
        isGlobalView={false}
      />
    </div>
  )
}
```

**Step 2: 提交单个 Key 日志页面**

```bash
cd web
git add src/app/\(dashboard\)/settings/api-keys/\[id\]/logs/page.tsx
git commit -m "feat(logs): add individual API key logs page"
```

---

## Phase 4: 导出功能 (2 hours)

### Task 9: 创建导出对话框组件

**文件：**
- Create: `web/src/components/logs/LogExportDialog.tsx`

**Step 1: 实现导出对话框**

```typescript
// web/src/components/logs/LogExportDialog.tsx

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info, AlertTriangle } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { LogFilters, ExportFormat } from '@/types/logs'
import { exportLogsSync, createExportTask } from '@/lib/api/logs'

const exportSchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx'] as const),
  fields: z.array(z.string()).min(1, '请至少选择一个字段'),
})

type ExportFormData = z.infer<typeof exportSchema>

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
        // 异步导出
        const { data } = await createExportTask({
          format,
          fields,
          startDate: new Date().toISOString(), // 从 filters 计算
          endDate: new Date().toISOString(),
          filters,
        })

        toast.success('导出任务已创建', {
          description: '完成后将自动下载',
        })

        // TODO: 开始轮询导出状态
        onClose()
      } else {
        // 同步导出
        const blob = await exportLogsSync(filters, format)

        // 触发下载
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
          {/* 格式选择 */}
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

          {/* 字段选择 */}
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

          {/* 时间范围提示 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>时间范围：</strong> 将导出当前筛选器设定的时间范围
              （约 {logCount.toLocaleString()} 条记录）
            </AlertDescription>
          </Alert>

          {/* 大数据集警告 */}
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
```

**Step 2: 提交导出对话框**

```bash
cd web
git add src/components/logs/LogExportDialog.tsx
git commit -m "feat(logs): add export dialog with sync/async support"
```

---

## Phase 5: 集成与优化 (1-2 hours)

### Task 10: 更新侧边栏导航

**文件：**
- Modify: `web/src/components/layout/sidebar.tsx`

**Step 1: 添加访问日志菜单项（权限控制）**

找到侧边栏菜单配置，在设置部分添加：

```typescript
// 在设置菜单组中添加
{authState.user?.scopes.includes('admin:full') && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild>
      <a href="/settings/logs">
        <FileText className="h-4 w-4" />
        <span>访问日志</span>
      </a>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

**Step 2: 提交导航更新**

```bash
cd web
git add src/components/layout/sidebar.tsx
git commit -m "feat(logs): add access logs navigation menu item with permission check"
```

---

### Task 11: 添加工具函数

**文件：**
- Modify: `web/src/lib/utils.ts`

**Step 1: 添加日志相关的工具函数**

```typescript
// 在 web/src/lib/utils.ts 中添加

/**
 * 格式化字节大小
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
```

**Step 2: 提交工具函数**

```bash
cd web
git add src/lib/utils.ts
git commit -m "feat(logs): add formatBytes utility function"
```

---

### Task 12: 错误处理和加载状态

**文件：**
- Modify: `web/src/app/(dashboard)/settings/logs/page.tsx`
- Modify: `web/src/app/(dashboard)/settings/api-keys/[id]/logs/page.tsx`

**Step 1: 改进错误处理**

在页面组件中添加错误状态显示：

```typescript
// 在 GlobalLogsPage 和 ApiKeyLogsPage 中添加

{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>加载失败</AlertTitle>
    <AlertDescription>
      {error instanceof Error ? error.message : '未知错误'}
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => refetch()}
      >
        重新加载
      </Button>
    </AlertDescription>
  </Alert>
)}
```

**Step 2: 提交错误处理**

```bash
cd web
git add src/app/\(dashboard\)/settings/logs/page.tsx src/app/\(dashboard\)/settings/api-keys/\[id\]/logs/page.tsx
git commit -m "feat(logs): add error handling and retry buttons"
```

---

## Phase 6: 测试与验证 (1-2 hours)

### Task 13: 手动测试清单

**测试文件：**
- 无（手动测试）

**Step 1: 功能测试**

按照以下清单进行手动测试：

**权限控制：**
- [ ] 没有 `admin:full` 权限的用户无法访问日志页面
- [ ] 有权限的用户可以正常访问

**全局日志页面 (`/settings/logs`)：**
- [ ] 页面正常加载，显示日志列表
- [ ] 筛选器功能正常（时间、状态、搜索）
- [ ] 高级筛选器功能正常（方法、IP）
- [ ] 筛选条件同步到 URL
- [ ] 分页功能正常
- [ ] 点击展开显示详情
- [ ] 详情内容完整显示

**单个 Key 日志页面 (`/settings/api-keys/[id]/logs`)：**
- [ ] Key 信息头部正确显示
- [ ] 日志列表只显示该 Key 的记录
- [ ] 返回按钮正常工作

**导出功能：**
- [ ] 小数据集（< 1000 条）同步导出成功
- [ ] 大数据集（≥ 1000 条）创建异步任务
- [ ] Toast 通知正确显示

**性能：**
- [ ] 首屏加载时间合理（< 2 秒）
- [ ] 筛选响应迅速（< 500ms）
- [ ] 滚动流畅

**Step 2: 记录测试结果**

创建测试报告：

```bash
cat > /tmp/logs-testing-report.md << 'EOF'
# 访问日志系统测试报告

**测试日期：** $(date +%Y-%m-%d)
**测试环境：** 开发环境

## 测试结果

### 功能测试
- 权限控制: ✅ 通过 / ❌ 失败
- 全局日志页面: ✅ 通过 / ❌ 失败
- 筛选器: ✅ 通过 / ❌ 失败
- 分页: ✅ 通过 / ❌ 失败
- 详情展开: ✅ 通过 / ❌ 失败
- 导出功能: ✅ 通过 / ❌ 失败

### 性能测试
- 首屏加载: ✅ 通过 / ❌ 失败
- 筛选响应: ✅ 通过 / ❌ 失败

### 发现的问题
1. [记录发现的问题]
2. [...]

### 建议
[改进建议]
EOF
```

**Step 3: 提交测试报告（如有）**

```bash
# 如果测试过程中发现问题并修复，提交修复
git add .
git commit -m "fix(logs): fix issues found during testing"
```

---

## Phase 7: 文档与收尾 (30 minutes)

### Task 14: 更新项目文档

**文件：**
- Modify: `web/README.md`（如果存在）
- Modify: `CLAUDE.md`

**Step 1: 更新主文档**

在 `CLAUDE.md` 的 Web 模块部分添加：

```markdown
### 访问日志与审计

**页面路由：**
- `/settings/logs` - 全局访问日志（需要 `admin:full` 权限）
- `/settings/api-keys/[id]/logs` - 单个 API Key 的日志

**功能特性：**
- 多维度筛选（时间、状态、方法、IP）
- 日志详情查看（请求/响应/错误信息）
- 日志导出（CSV/JSON/XLSX）
- 分页和搜索

**技术实现：**
- TanStack Query 数据获取
- URLSearchParams 状态管理
- shadcn/ui 组件库
```

**Step 2: 提交文档更新**

```bash
git add CLAUDE.md
git commit -m "docs(logs): document access logs feature in CLAUDE.md"
```

---

### Task 15: 创建功能总结

**文件：**
- Create: `web/docs/features/access-logs.md`

**Step 1: 编写功能总结文档**

```markdown
# 访问日志与审计系统

**版本：** 1.0.0
**发布日期：** 2026-01-17
**状态：** ✅ 已实现

## 功能概述

访问日志与审计系统为管理员提供了完整的 API 访问记录查看和分析功能，支持：
- 全局日志查看（所有 API Key）
- 单个 Key 的日志查看
- 多维度筛选和搜索
- 日志详情查看
- 日志导出

## 使用指南

### 权限要求

需要 JWT Token 包含 `admin:full` scope。

### 访问地址

- 全局日志：`/settings/logs`
- 单个 Key 日志：`/settings/api-keys/[id]/logs`

### 筛选功能

**快速筛选：**
- 时间范围：今天/本周/本月/自定义
- 状态：全部/成功/失败/拒绝
- 搜索：接口路径关键词

**高级筛选：**
- HTTP 方法：GET/POST/PUT/DELETE
- IP 地址：精确匹配
- API Key：下拉选择（全局日志）

### 导出功能

支持导出为 CSV、JSON、XLSX 格式：
- 小数据集（< 1000 条）：同步导出，立即下载
- 大数据集（≥ 1000 条）：异步导出，完成后通知

## 技术实现

**前端技术栈：**
- Next.js 15 (App Router)
- React 19
- TypeScript
- TanStack Query
- shadcn/ui

**关键文件：**
- `/src/types/logs.ts` - 类型定义
- `/src/lib/api/logs.ts` - API 客户端
- `/src/lib/hooks/use-log-filters.ts` - 筛选器 Hook
- `/src/components/logs/` - UI 组件
- `/src/app/(dashboard)/settings/logs/page.tsx` - 全局日志页面

## 已知限制

1. 导出文件有效期：导出文件在服务器上保存 7 天
2. 最大导出记录数：单次导出最多 10,000 条
3. 日志保留期限：默认保留 90 天

## 未来改进

- [ ] 日志统计图表
- [ ] 实时日志流（WebSocket）
- [ ] 日志告警规则
- [ ] 更高级的搜索语法
- [ ] 日志数据可视化仪表板
```

**Step 2: 提交功能文档**

```bash
git add web/docs/features/access-logs.md
git commit -m "docs(logs): add access logs feature documentation"
```

---

## 最终检查清单

在完成所有任务后，运行以下检查：

### 代码质量

```bash
cd web

# TypeScript 类型检查
npm run type-check

# ESLint 检查
npm run lint

# 格式检查（如果有）
npm run format:check
```

### 构建验证

```bash
# 生产构建
npm run build

# 检查构建输出
ls -la .next/
```

### Git 提交

```bash
# 查看所有提交
git log --oneline --graph --all

# 确认所有更改已提交
git status
```

---

## 完成

恭喜！访问日志与审计系统已全部实现。

**已交付内容：**
- ✅ 完整的类型定义
- ✅ API 客户端函数
- ✅ 筛选器状态管理 Hook
- ✅ 日志筛选器组件
- ✅ 日志表格组件（含详情展开）
- ✅ 分页组件
- ✅ 导出对话框
- ✅ 全局日志页面
- ✅ 单个 Key 日志页面
- ✅ 权限控制集成
- ✅ 错误处理和加载状态

**下一步建议：**
1. 进行手动测试验证
2. 根据测试结果进行优化
3. 添加单元测试（可选）
4. 部署到测试环境进行集成测试
5. 收集用户反馈并迭代改进

**相关文档：**
- 设计文档：`/docs/designs/2026-01-17-access-logs-system-design.md`
- 视觉原型：`/docs/designs/access-logs-wireframe.html`
- 实施计划：`/docs/plans/2026-01-17-access-logs-implementation.md`
