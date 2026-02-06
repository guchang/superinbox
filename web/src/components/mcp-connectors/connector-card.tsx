"use client"

import { useState, type KeyboardEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronRight, CheckCircle, XCircle, Clock, Loader2, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MCPConnectorLogo } from './mcp-connector-logo'
import { getRandomLogoColor } from '@/lib/constants/mcp-colors'
import { mcpConnectorsApi } from '@/lib/api/mcp-connectors'
import { cn } from '@/lib/utils'
import type { MCPConnectorListItem } from '@/types'

interface MCPConnectorCardProps {
  connector: MCPConnectorListItem
  onEdit: (connector: MCPConnectorListItem) => void
  onDelete: (id: string) => void
  onTest: (id: string) => void
  onAuthorize?: (connector: MCPConnectorListItem) => void
  isTesting: boolean
}

interface ToolInfo {
  name: string
  description?: string
}

type HealthStatus = 'healthy' | 'unhealthy' | 'pending'

export function MCPConnectorCard({ connector, onEdit, onDelete, onTest, onAuthorize, isTesting }: MCPConnectorCardProps) {
  const t = useTranslations('mcpAdapters')
  const common = useTranslations('common')
  const locale = useLocale()

  const [expanded, setExpanded] = useState(false)
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [loadingTools, setLoadingTools] = useState(false)

  const logoColor = connector.logoColor || getRandomLogoColor()

  const healthStatus: HealthStatus = !connector.lastHealthCheckStatus
    ? 'pending'
    : connector.lastHealthCheckStatus === 'healthy'
      ? 'healthy'
      : 'unhealthy'

  const getStatusBadge = () => {
    if (healthStatus === 'pending') {
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {t('status.pending')}
        </Badge>
      )
    }

    if (healthStatus === 'healthy') {
      return (
        <Badge
          variant="default"
          className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300"
        >
          <CheckCircle className="h-3 w-3" />
          {t('status.healthy')}
        </Badge>
      )
    }

    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        {t('status.unhealthy')}
      </Badge>
    )
  }

  const handleToggleExpand = async () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)

    if (connector.lastHealthCheckStatus !== 'healthy') {
      return
    }

    if (newExpanded && tools.length === 0 && !loadingTools) {
      setLoadingTools(true)
      try {
        const response = await mcpConnectorsApi.getTools(connector.id)
        if (response.data?.tools) {
          setTools(response.data.tools)
        }
      } catch (error) {
        console.error('Failed to fetch tools:', error)
      } finally {
        setLoadingTools(false)
      }
    }
  }

  const handleKeyToggle = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleToggleExpand()
    }
  }

  const transportLabel = connector.transportType === 'stdio' ? t('transport.stdio') : t('transport.http')
  const authLabel = connector.authType === 'oauth'
    ? t('authTypes.oauth')
    : connector.authType === 'api_key'
      ? t('authTypes.apiKey')
      : t('card.unknownAuth')
  const lastChecked = connector.lastHealthCheck
    ? new Date(connector.lastHealthCheck).toLocaleString(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : t('card.neverChecked')

  return (
    <div className="border-b last:border-b-0">
      <div className="group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] md:flex-row md:items-center md:justify-between">
        <div
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-1 py-1"
          onClick={handleToggleExpand}
          onKeyDown={handleKeyToggle}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
        >
          <div className="mt-1 text-muted-foreground transition-all duration-200 group-hover:text-foreground/70">
            <ChevronRight className={cn('h-4 w-4', expanded && 'rotate-90')} />
          </div>

          <MCPConnectorLogo
            serverType={connector.serverType}
            name={connector.name}
            logoColor={logoColor}
            className="mt-0.5"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-medium text-foreground md:text-base">{connector.name}</h3>
              {getStatusBadge()}
              {!connector.enabled && (
                <Badge variant="outline" className="text-[11px]">
                  {t('status.disabled')}
                </Badge>
              )}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              {transportLabel}
              <span className="px-1">·</span>
              {authLabel}
              <span className="px-1">·</span>
              {t('card.lastChecked', { time: lastChecked })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 self-end md:self-auto">
          {onAuthorize && connector.authType === 'oauth' && !connector.hasOAuthToken && ['todoist', 'notion'].includes(connector.serverType.toLowerCase()) && (
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                onAuthorize(connector)
              }}
              className="h-8"
            >
              {t('actions.authorize')}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onTest(connector.id)
            }}
            disabled={isTesting}
            className="h-8"
            title={t('actions.test')}
          >
            <RefreshCw className={cn('h-4 w-4', isTesting && 'animate-spin')} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onEdit(connector)
            }}
            className="h-8"
            title={t('actions.edit')}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(connector.id)
            }}
            className="h-8 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
            title={t('actions.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{t('tools.title', { count: tools.length })}</h4>
                {isTesting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {connector.lastHealthCheckStatus !== 'healthy' ? (
                <div className="rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
                  {connector.lastHealthCheckStatus === 'unhealthy' ? t('tools.unavailable') : t('tools.notTested')}
                </div>
              ) : loadingTools ? (
                <div className="rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
                  {common('loading')}
                </div>
              ) : tools.length > 0 ? (
                <div className="space-y-2">
                  {tools.map((tool) => (
                    <div key={tool.name} className="rounded-md border bg-background px-3 py-2 text-sm">
                      <div className="font-medium text-foreground">{tool.name}</div>
                      {tool.description && (
                        <div className="mt-1 text-xs text-muted-foreground">{tool.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
                  {t('tools.noTools')}
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-md border bg-background p-3">
              <h4 className="text-sm font-medium">{t('config.title')}</h4>
              <div className="space-y-2 text-xs">
                <InfoRow label={t('config.type')} value={connector.serverType} />
                <InfoRow label={t('config.transport')} value={transportLabel} />
                <InfoRow label={t('config.auth')} value={authLabel} />
                {connector.command && (
                  <div className="space-y-1">
                    <div className="text-muted-foreground">{t('config.command')}</div>
                    <code className="block truncate rounded bg-muted px-2 py-1 font-mono text-[11px]" title={connector.command}>
                      {connector.command}
                    </code>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-start gap-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  )
}
