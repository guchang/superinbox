'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Activity,
  FileInput,
  FileOutput,
  Zap,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  MessageSquare,
  User,
  Bot,
  MoreHorizontal,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { getLlmStatistics, getLlmLogs, getLlmSessions } from '@/lib/api/llm'
import { useAuth } from '@/lib/hooks/use-auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import type { LlmUsageLog, LlmSession } from '@/types'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'

type TimeRange = 'today' | 'week' | 'month' | 'all'

function getDateRange(timeRange: TimeRange): { startDate?: string; endDate?: string } {
  const now = new Date()
  const endDate = now.toISOString()

  let startDate: string | undefined
  if (timeRange === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    startDate = start.toISOString()
  } else if (timeRange === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - 7)
    startDate = start.toISOString()
  } else if (timeRange === 'month') {
    const start = new Date(now)
    start.setMonth(now.getMonth() - 1)
    startDate = start.toISOString()
  }

  return { startDate, endDate }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分`
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`
  } else {
    return `${seconds}秒`
  }
}

export default function LlmStatisticsPage() {
  const t = useTranslations('llmStatistics')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const time = useTranslations('time')
  const { authState } = useAuth()
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [sessionPage, setSessionPage] = useState(1)
  const [sessionPageSize, setSessionPageSize] = useState(10)

  // 会话展开状态
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  // 会话对话详情弹窗
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<LlmSession | null>(null)
  const [sessionLogs, setSessionLogs] = useState<LlmUsageLog[]>([])
  // 对话消息展开状态（key: logId-messageIndex）
  const [conversationExpanded, setConversationExpanded] = useState<Set<string>>(new Set())
  const [copiedConversationMessage, setCopiedConversationMessage] = useState(false)
  const [copiedAllConversation, setCopiedAllConversation] = useState(false)

  // 单条日志详情弹窗（保留用于查看单条详情）
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<LlmUsageLog | null>(null)
  const [copiedRequest, setCopiedRequest] = useState(false)
  const [copiedResponse, setCopiedResponse] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set())
  const [responseExpanded, setResponseExpanded] = useState(false)

  useEffect(() => {
    setSessionPage(1)
  }, [timeRange])

  const copyToClipboard = async (text: string, type: 'request' | 'response') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'request') {
        setCopiedRequest(true)
        setTimeout(() => setCopiedRequest(false), 2000)
      } else {
        setCopiedResponse(true)
        setTimeout(() => setCopiedResponse(false), 2000)
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const toggleMessageExpanded = (index: number) => {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const copyAllJson = async () => {
    if (!selectedLog) return
    const allData = {
      meta: {
        id: selectedLog.id,
        model: selectedLog.model,
        provider: selectedLog.provider,
        status: selectedLog.status,
        createdAt: selectedLog.createdAt,
      },
      request: selectedLog.requestMessages,
      response: selectedLog.responseContent,
      tokens: {
        prompt: selectedLog.promptTokens,
        completion: selectedLog.completionTokens,
        total: selectedLog.totalTokens,
      },
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(allData, null, 2))
      setCopiedResponse(true)
      setTimeout(() => setCopiedResponse(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  // Toggle conversation message expand/collapse
  const toggleConversationExpanded = (key: string) => {
    setConversationExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Copy conversation message
  const copyConversationMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedConversationMessage(true)
      setTimeout(() => setCopiedConversationMessage(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  // Copy all conversation
  const copyAllConversation = async () => {
    if (sessionLogs.length === 0) return

    let fullText = `会话类型: ${selectedSession?.sessionType}\n`
    fullText += `开始时间: ${new Date(selectedSession?.startedAt || '').toLocaleString()}\n`
    fullText += `总 Tokens: ${selectedSession?.totalTokens?.toLocaleString()}\n`
    fullText += `\n${'='.repeat(50)}\n\n`

    for (const log of sessionLogs) {
      // User messages
      for (const msg of log.requestMessages) {
        if (msg.role === 'user') {
          fullText += `[用户] ${new Date(log.createdAt).toLocaleString()}\n`
          fullText += `${msg.content}\n\n`
        }
      }
      // Assistant response
      if (log.responseContent) {
        fullText += `[助手] ${new Date(log.createdAt).toLocaleString()}\n`
        fullText += `${log.responseContent}\n\n`
      }
      fullText += `${'-'.repeat(30)}\n\n`
    }

    try {
      await navigator.clipboard.writeText(fullText)
      setCopiedAllConversation(true)
      setTimeout(() => setCopiedAllConversation(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  // Check if content should show toggle
  const shouldShowConversationToggle = (content: string) => {
    const lineCount = content.split('\n').length
    const charCount = content.length
    return lineCount > 6 || charCount > 300
  }

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: 'today', label: t('timeRange.today') },
    { value: 'week', label: t('timeRange.week') },
    { value: 'month', label: t('timeRange.month') },
    { value: 'all', label: t('timeRange.all') },
  ]

  // Check admin permission
  const hasPermission = authState.user?.scopes?.includes('admin:full') ?? false
  const dateRange = getDateRange(timeRange)

  // Fetch statistics data
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['llm-statistics', timeRange],
    queryFn: () => getLlmStatistics(dateRange),
    enabled: hasPermission && !authState.isLoading,
  })

  // Fetch sessions data
  const { data: sessionsData, isLoading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useQuery({
    queryKey: ['llm-sessions', timeRange, sessionPage, sessionPageSize],
    queryFn: () => getLlmSessions({ ...dateRange, page: sessionPage, pageSize: sessionPageSize }),
    enabled: hasPermission && !authState.isLoading,
  })

  // Toggle session expansion
  const toggleSessionExpanded = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  // Simple hash function for content
  const hashContent = (content: string) => {
    return content.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  }

  // Open conversation dialog
  const openConversationDialog = async (session: LlmSession) => {
    setSelectedSession(session)
    setDialogOpen(true)

    // Fetch all logs for this session
    try {
      const { getLlmLogs } = await import('@/lib/api/llm')
      const logsData = await getLlmLogs({
        ...dateRange,
        sessionId: session.sessionId,
        page: 1,
        pageSize: 100,
      })
      // Sort by time (oldest first)
      const sortedLogs = (logsData.data || []).sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      // Deduplicate messages - only show each unique message once
      const seenMessages = new Set<number>()
      const uniqueLogs: typeof sortedLogs = []

      for (const log of sortedLogs) {
        const filteredMessages = log.requestMessages.filter(msg => {
          const hash = hashContent(msg.content)
          if (seenMessages.has(hash)) {
            return false
          }
          seenMessages.add(hash)
          return true
        })

        if (filteredMessages.length > 0 || log.responseContent) {
          uniqueLogs.push({
            ...log,
            requestMessages: filteredMessages
          })
        }
      }

      setSessionLogs(uniqueLogs)
    } catch (error) {
      console.error('Failed to fetch session logs:', error)
      setSessionLogs([])
    }
  }

  const openDetail = (log: LlmUsageLog) => {
    setSelectedLog(log)
    setDetailOpen(true)
  }

  const sessions = sessionsData?.data || []
  const sessionsTotal = sessionsData?.total ?? 0

  const sessionColumns = useMemo<ColumnDef<LlmSession>[]>(() => [
    {
      accessorKey: 'sessionId',
      header: () => t('sessions.table.sessionId'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-[220px]">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm truncate">{row.original.sessionId}</span>
        </div>
      ),
    },
    {
      accessorKey: 'sessionType',
      header: () => t('sessions.table.type'),
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.sessionType}
        </Badge>
      ),
    },
    {
      id: 'calls',
      header: () => (
        <div className="text-right">{t('sessions.table.calls')}</div>
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.calls.toLocaleString()}
        </div>
      ),
    },
    {
      id: 'tokens',
      header: () => (
        <div className="text-right">{t('sessions.table.tokens')}</div>
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.totalTokens.toLocaleString()}
        </div>
      ),
    },
    {
      id: 'duration',
      header: () => (
        <div className="text-right">{t('sessions.table.duration')}</div>
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatDuration(row.original.duration)}
        </div>
      ),
    },
    {
      id: 'time',
      header: () => (
        <div className="text-right">{t('sessions.table.time')}</div>
      ),
      cell: ({ row }) => (
        <div className="text-right text-xs text-muted-foreground min-w-[220px]">
          {new Date(row.original.startedAt).toLocaleString()} → {new Date(row.original.endedAt).toLocaleString()}
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openConversationDialog(row.original)}
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            {t('session.viewConversation')}
          </Button>
          {hasPermission && row.original.calls > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSessionExpanded(row.original.sessionId)}
            >
              {expandedSessions.has(row.original.sessionId) ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  {t('session.collapse')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  {t('session.expand')}
                </>
              )}
            </Button>
          )}
        </div>
      ),
    },
  ], [expandedSessions, hasPermission, openConversationDialog, t, toggleSessionExpanded])

  const sessionTable = useReactTable({
    data: sessions,
    columns: sessionColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.max(Math.ceil(sessionsTotal / sessionPageSize), 1),
    state: {
      pagination: {
        pageIndex: sessionPage - 1,
        pageSize: sessionPageSize,
      },
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex: sessionPage - 1, pageSize: sessionPageSize })
        : updater
      setSessionPage(next.pageIndex + 1)
      setSessionPageSize(next.pageSize)
    },
  })

  const sessionColumnCount = sessionTable.getVisibleLeafColumns().length
  const sessionPaginationLabels = useMemo(() => ({
    summary: (start: number, end: number, total: number) =>
      t('pagination.summary', { start, end, total: total.toLocaleString() }),
    page: (page: number, totalPages: number) =>
      t('pagination.page', { page, totalPages }),
    previous: t('pagination.prev'),
    next: t('pagination.next'),
    rowsPerPage: t('pagination.rowsPerPage'),
    pageSize: (size: number) => t('pagination.pageSize', { size }),
  }), [t])

  // Show loading while checking auth
  if (authState.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{common('loading')}</div>
      </div>
    )
  }

  // Permission check
  if (!hasPermission) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{common('permissionDenied.title')}</AlertTitle>
        <AlertDescription>
          {common('permissionDenied.description')}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="w-full space-y-6 px-4 md:px-6 py-6">
      {/* Page header */}
      <div className="flex items-center justify-end">
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeRangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error display */}
      {(statsError || sessionsError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{common('loadFailure.title')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{getApiErrorMessage(statsError || sessionsError, errors, common('unknownError'))}</span>
            <Button variant="outline" size="sm" onClick={() => { refetchStats(); refetchSessions(); }}>
              {common('reload')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats overview cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.totalCalls')}
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-2xl font-bold">{stats.totalCalls.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.totalTokens')}
              </CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.promptTokens')}
              </CardTitle>
              <FileInput className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-2xl font-bold">{stats.promptTokens.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('summary.completionTokens')}
              </CardTitle>
              <FileOutput className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-2xl font-bold">{stats.completionTokens.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions list */}
      <div className="space-y-4">
        {sessionsLoading ? (
          <div className="text-center py-8 text-muted-foreground">{common('loading')}</div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              {common('noData')}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {sessionTable.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {sessionTable.getRowModel().rows.map((row) => (
                    <Fragment key={row.id}>
                      <TableRow className="hover:bg-muted/50">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                      {expandedSessions.has(row.original.sessionId) && (
                        <TableRow>
                          <TableCell colSpan={sessionColumnCount} className="bg-muted/30">
                            <div className="p-4">
                              <SessionLogsContent
                                session={row.original}
                                dateRange={dateRange}
                                hasPermission={hasPermission}
                                onOpenDetail={openDetail}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                  {sessionTable.getRowModel().rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={sessionColumnCount} className="h-24 text-center text-muted-foreground">
                        {common('noData')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination
              table={sessionTable}
              labels={sessionPaginationLabels}
              totalRows={sessionsTotal}
            />
          </div>
        )}
      </div>

      {/* Conversation dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('conversation.title') || '对话历史'}
              </DialogTitle>
              <DialogDescription>
                {selectedSession && (
                  <span className="flex items-center gap-4 text-sm">
                    <span>{selectedSession.sessionType}</span>
                    <span>•</span>
                    <span>{selectedSession.calls} 次调用</span>
                    <span>•</span>
                    <span>{selectedSession.totalTokens.toLocaleString()} tokens</span>
                  </span>
                )}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyAllConversation}
              className="shrink-0"
            >
              {copiedAllConversation ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {common('copied') || '已复制'}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  复制全部
                </>
              )}
            </Button>
          </DialogHeader>
          {selectedSession && sessionLogs.length > 0 && (
            <div className="w-full">
              <div className="space-y-4">
                {sessionLogs.map((log, index) => (
                  <div key={log.id} className="space-y-3">
                    {/* System message */}
                    {log.requestMessages
                      .filter(m => m.role === 'system')
                      .map((msg, msgIndex) => {
                        const messageKey = `system-${log.id}-${msgIndex}`
                        const isExpanded = conversationExpanded.has(messageKey)
                        const showToggle = shouldShowConversationToggle(msg.content)

                        return (
                          <div key={messageKey} className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                                <span>{new Date(log.createdAt).toLocaleString()}</span>
                                <span>•</span>
                                <span>系统</span>
                                <span className="flex-1"></span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => copyConversationMessage(msg.content)}
                                >
                                  {copiedConversationMessage ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                                {showToggle && (
                                  <button
                                    onClick={() => toggleConversationExpanded(messageKey)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-3 w-3" />
                                        收起
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-3 w-3" />
                                        展开
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              <div
                                className={`text-sm bg-orange-50/50 dark:bg-orange-950/20 rounded-lg p-3 break-words break-all ${
                                  !isExpanded && showToggle ? 'max-h-[120px] overflow-hidden' : ''
                                }`}
                              >
                                {msg.content}
                              </div>
                            </div>
                          </div>
                        )
                      })}

                    {/* User message */}
                    {log.requestMessages
                      .filter(m => m.role === 'user')
                      .map((msg, msgIndex) => {
                        const messageKey = `user-${log.id}-${msgIndex}`
                        const isExpanded = conversationExpanded.has(messageKey)
                        const showToggle = shouldShowConversationToggle(msg.content)

                        return (
                          <div key={messageKey} className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                                <span>{new Date(log.createdAt).toLocaleString()}</span>
                                <span>•</span>
                                <span>{t('conversation.user') || '用户'}</span>
                                <span className="flex-1"></span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => copyConversationMessage(msg.content)}
                                >
                                  {copiedConversationMessage ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                                {showToggle && (
                                  <button
                                    onClick={() => toggleConversationExpanded(messageKey)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-3 w-3" />
                                        收起
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-3 w-3" />
                                        展开
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              <div
                                className={`text-sm bg-muted/50 rounded-lg p-3 break-words break-all ${
                                  !isExpanded && showToggle ? 'max-h-[120px] overflow-hidden' : ''
                                }`}
                              >
                                {msg.content}
                              </div>
                            </div>
                          </div>
                        )
                      })}

                    {/* Assistant message */}
                    {log.responseContent && (
                      <div key={`assistant-${log.id}`} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2 flex-wrap">
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                            <span>•</span>
                            <span>{t('conversation.assistant') || '助手'}</span>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              {log.completionTokens.toLocaleString()} tokens
                            </Badge>
                            <span className="flex-1"></span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => copyConversationMessage(log.responseContent!)}
                            >
                              {copiedConversationMessage ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                            {shouldShowConversationToggle(log.responseContent) && (
                              <button
                                onClick={() => toggleConversationExpanded(`assistant-${log.id}`)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {conversationExpanded.has(`assistant-${log.id}`) ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    收起
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    展开
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          <div
                            className={`text-sm bg-muted/50 rounded-lg p-3 break-words break-all whitespace-pre-wrap overflow-x-auto ${
                              !conversationExpanded.has(`assistant-${log.id}`) && shouldShowConversationToggle(log.responseContent)
                                ? 'max-h-[120px] overflow-hidden'
                                : ''
                            }`}
                          >
                            {log.responseContent}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Separator between conversations */}
                    {index < sessionLogs.length - 1 && (
                      <div className="border-t border-muted/200 my-4" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single log detail dialog (legacy, for viewing individual log details) */}
      <Dialog open={detailOpen} onOpenChange={(open) => setDetailOpen(open)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <DialogTitle>{t('logs.detail.title')}</DialogTitle>
              <DialogDescription>{t('logs.detail.description')}</DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyAllJson}
              className="shrink-0"
            >
              {copiedResponse ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {common('copied') || '已复制'}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('logs.detail.copyAll') || '复制全部'}
                </>
              )}
            </Button>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6">
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('logs.detail.meta.time')}</span>
                  <span>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('logs.detail.meta.model')}</span>
                  <span className="font-medium">{selectedLog.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('logs.detail.meta.provider')}</span>
                  <span className="uppercase">{selectedLog.provider}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('logs.detail.meta.status')}</span>
                  <Badge variant={selectedLog.status === 'success' ? 'default' : 'destructive'}>
                    {selectedLog.status === 'success' ? t('logs.status.success') : t('logs.status.error')}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold">{t('logs.detail.requestTitle')}</h4>
                {selectedLog.requestMessages?.length ? (
                  <div className="space-y-2">
                    {selectedLog.requestMessages.map((message, index) => {
                      const isExpanded = expandedMessages.has(index)
                      const lineCount = message.content.split('\n').length
                      const charCount = message.content.length
                      const shouldShowToggle = lineCount > 6 || charCount > 500

                      return (
                        <div key={`${message.role}-${index}`} className="rounded-md border bg-muted/40">
                          <div className="flex items-center justify-between p-3 pb-2">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              {message.role}
                            </div>
                            <div className="flex items-center gap-2">
                              {shouldShowToggle && (
                                <button
                                  onClick={() => toggleMessageExpanded(index)}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="h-3 w-3" />
                                      收起
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3" />
                                      展开
                                    </>
                                  )}
                                </button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(message.content, 'request')}
                                className="h-7 px-2"
                              >
                                {copiedRequest ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <pre
                            className={`whitespace-pre-wrap text-sm break-words max-w-[600px] overflow-x-auto px-3 pb-3 ${
                              !isExpanded && shouldShowToggle ? 'max-h-[120px] overflow-hidden' : ''
                            }`}
                          >
                            {message.content}
                          </pre>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{common('noData')}</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{t('logs.detail.responseTitle')}</h4>
                  <div className="flex items-center gap-2">
                    {selectedLog.responseContent && (
                      (selectedLog.responseContent.split('\n').length > 6 || selectedLog.responseContent.length > 500)
                    ) && (
                      <button
                        onClick={() => setResponseExpanded(!responseExpanded)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {responseExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            收起
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            展开
                          </>
                        )}
                      </button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedLog.responseContent || '', 'response')}
                      className="h-7 px-2"
                      disabled={!selectedLog.responseContent}
                    >
                      {copiedResponse ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                {selectedLog.responseContent ? (
                  <div className="rounded-md border bg-muted/40">
                    <pre
                      className={`whitespace-pre-wrap text-sm break-words max-w-[600px] overflow-x-auto p-3 ${
                        !responseExpanded &&
                        (selectedLog.responseContent.split('\n').length > 6 || selectedLog.responseContent.length > 500)
                          ? 'max-h-[120px] overflow-hidden'
                          : ''
                      }`}
                    >
                      {selectedLog.responseContent}
                    </pre>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{common('noData')}</div>
                )}
                {selectedLog.errorMessage && (
                  <div className="text-sm text-destructive">
                    {t('logs.detail.errorTitle')}: {selectedLog.errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Session Logs Content Component
function SessionLogsContent({
  session,
  dateRange,
  hasPermission,
  onOpenDetail
}: {
  session: LlmSession
  dateRange: { startDate?: string; endDate?: string }
  hasPermission: boolean
  onOpenDetail: (log: LlmUsageLog) => void
}) {
  const t = useTranslations('llmStatistics')
  const common = useTranslations('common')

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['llm-logs', session.sessionId, dateRange.startDate, dateRange.endDate],
    queryFn: () => getLlmLogs({
      ...dateRange,
      sessionId: session.sessionId,
      page: 1,
      pageSize: 100,
    }),
    enabled: hasPermission,
  })

  const logs = logsData?.data || []

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">{common('loading')}</div>
    )
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-4 text-sm flex-1 min-w-0">
            <span className="text-muted-foreground tabular-nums">
              {new Date(log.createdAt).toLocaleTimeString()}
            </span>
            <span className="font-medium text-muted-foreground">|</span>
            <span className="flex items-center gap-1">
              <FileInput className="h-3 w-3 text-blue-500" />
              <span className="tabular-nums">{log.promptTokens.toLocaleString()}</span>
            </span>
            <span className="font-medium text-muted-foreground">|</span>
            <span className="flex items-center gap-1">
              <FileOutput className="h-3 w-3 text-purple-500" />
              <span className="tabular-nums">{log.completionTokens.toLocaleString()}</span>
            </span>
            <span className="font-medium text-muted-foreground">|</span>
            <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
              {log.status === 'success' ? t('logs.status.success') : t('logs.status.error')}
            </Badge>
          </div>
        </div>
      ))}
      {logs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">{common('noData')}</div>
      )}
    </div>
  )
}
