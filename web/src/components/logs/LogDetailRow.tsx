'use client'

import { AccessLog } from '@/types/logs'
import { Card } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
      {/* Request details */}
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

      {/* Response details */}
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

      {/* Error information */}
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

      {/* Metadata */}
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
