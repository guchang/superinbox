/**
 * MCPConnectorCard Component
 *
 * Individual connector card with expand/collapse functionality
 * Shows logo, name, status, and expanded tools list
 */

"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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

export function MCPConnectorCard({ connector, onEdit, onDelete, onTest, onAuthorize, isTesting }: MCPConnectorCardProps) {
  const t = useTranslations('mcpAdapters')
  const common = useTranslations('common')

  const [expanded, setExpanded] = useState(false)
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [loadingTools, setLoadingTools] = useState(false)

  // Get logo color (assign if not exists)
  const logoColor = connector.logoColor || getRandomLogoColor()

  // Get status badge
  const getStatusBadge = () => {
    if (!connector.lastHealthCheckStatus) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          {t('status.pending')}
        </Badge>
      )
    }

    if (connector.lastHealthCheckStatus === 'healthy') {
      return (
        <Badge variant="default" className="gap-1 bg-green-50 text-green-700 hover:bg-green-100">
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

  // Fetch tools when expanded
  const handleToggleExpand = async () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)

    // Skip fetching tools if connector is not healthy (including pending/unhealthy)
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

  const getTransportIcon = () => {
    return connector.transportType === 'stdio' ? '📡' : '🌐'
  }

  const getTransportLabel = () => {
    return connector.transportType === 'stdio' ? t('transport.stdio') : t('transport.http')
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Main Card - Always Visible */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={handleToggleExpand}
      >
        {/* Expand/Collapse Arrow */}
        <div className="text-muted-foreground transition-transform duration-200">
          <ChevronRight className={cn('h-4 w-4', expanded && 'rotate-90')} />
        </div>

        {/* Logo */}
        <MCPConnectorLogo
          serverType={connector.serverType}
          name={connector.name}
          logoColor={logoColor}
        />

        {/* Name & Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium truncate">{connector.name}</h3>
            {getStatusBadge()}
          </div>

        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {onAuthorize && connector.authType === 'oauth' && ['todoist', 'notion'].includes(connector.serverType.toLowerCase()) && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onAuthorize(connector)
              }}
              className="h-8 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 mr-1"
            >
              Authorize
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onTest(connector.id)
            }}
            disabled={isTesting}
            title={t('actions.test')}
          >
            <RefreshCw className={cn('h-4 w-4', isTesting && 'animate-spin')} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(connector)
            }}
            title={t('actions.edit')}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(connector.id)
            }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title={t('actions.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t bg-muted/30 px-4 py-4 space-y-4">
          {/* Tools List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                🔧 {t('tools.title', { count: tools.length })}
              </h4>
              {isTesting && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {connector.lastHealthCheckStatus !== 'healthy' ? (
              <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>{connector.lastHealthCheckStatus === 'unhealthy' ? t('tools.unavailable') : t('tools.notTested')}</span>
              </div>
            ) : loadingTools ? (
              <div className="text-xs text-muted-foreground py-2">
                {common('loading')}
              </div>
            ) : tools.length > 0 ? (
              <div className="space-y-2">
                {tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="rounded-md border bg-card p-3 text-sm"
                  >
                    <div className="font-medium text-foreground">{tool.name}</div>
                    {tool.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {tool.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-2">
                {t('tools.noTools')}
              </div>
            )}
          </div>

          {/* Configuration Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">⚙️ {t('config.title')}</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-muted-foreground">{t('config.type')}:</div>
              <div className="font-medium">{connector.serverType}</div>

              <div className="text-muted-foreground">{t('config.transport')}:</div>
              <div className="font-medium">
                {getTransportIcon()} {getTransportLabel()}
              </div>

              {connector.command && (
                <>
                  <div className="text-muted-foreground">{t('config.command')}:</div>
                  <div className="font-medium truncate" title={connector.command}>
                    {connector.command}
                  </div>
                </>
              )}
            </div>
          </div>


        </div>
      )}
    </div>
  )
}
