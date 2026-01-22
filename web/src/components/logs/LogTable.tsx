'use client'

import { useState, Fragment } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Code } from '@/components/ui/code'
import { AccessLog } from '@/types/logs'
import { MethodBadge, StatusBadge, LatencyBadge } from './LogBadges'
import { LogDetailRow } from './LogDetailRow'

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

  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

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
            <Fragment key={log.id}>
              <TableRow className="cursor-pointer hover:bg-muted/50">
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
            </Fragment>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
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

          <span className="text-sm">
            第 {page} / {totalPages} 页
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            下一页
          </Button>

          {onPageSizeChange && (
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="ml-4 border rounded px-2 py-1 text-sm"
            >
              <option value="20">20/页</option>
              <option value="50">50/页</option>
              <option value="100">100/页</option>
            </select>
          )}
        </div>
      </div>
    </div>
  )
}
