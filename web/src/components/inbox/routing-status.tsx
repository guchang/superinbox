/**
 * 路由状态组件
 * 显示收件箱条目的实时路由分发状态
 */

import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Clock, Zap, MinusCircle } from 'lucide-react'
import { useRoutingProgress, type RoutingStatus } from '@/hooks/use-routing-progress'
import { useTranslations } from 'next-intl'

interface RoutingStatusProps {
  itemId: string
  initialDistributedTargets?: any[]
  initialRuleNames?: string[]
  routingStatus?: string  // 从数据库获取的路由状态
  className?: string
  disabled?: boolean  // 禁用 SSE 连接
  showAnimation?: boolean  // 是否显示动画效果
}

export function RoutingStatus({ itemId, initialDistributedTargets = [], initialRuleNames = [], routingStatus, className, disabled = false, showAnimation = true }: RoutingStatusProps) {
  const t = useTranslations('inbox')
  const progress = useRoutingProgress(itemId, { disabled })

  // 对于禁用 SSE 的条目，使用数据库中的 routingStatus
  // 这些数据会通过 useAutoRefetch 定期更新
  const hasStaticData = initialDistributedTargets && initialDistributedTargets.length > 0

  // 如果禁用了 SSE，使用数据库状态
  const useStatic = disabled

  const effectiveStatus = useStatic 
    ? (routingStatus as RoutingStatus || 'pending')  // 使用数据库中的状态
    : progress.status
  const effectiveTargets = useStatic ? initialDistributedTargets : progress.distributedTargets
  const effectiveRuleNames = useStatic ? initialRuleNames : (progress.ruleNames || [])
  const effectiveMessage = useStatic
    ? (initialRuleNames.length > 0 
        ? t('routingStatus.distributedWithRules', { rules: initialRuleNames.join(', ') })
        : hasStaticData 
          ? t('routeDistributed', { count: initialDistributedTargets.length })
          : routingStatus === 'skipped'
            ? t('routingStatus.skipped')
            : t('routingStatus.pending')
      )
    : progress.message

  // Debug logging in development
  if (process.env.NODE_ENV === 'development' && disabled) {
    console.log(`[RoutingStatus] itemId: ${itemId}, disabled: ${disabled}, routingStatus: ${routingStatus}, ruleNames:`, initialRuleNames)
  }

  // 只在允许动画且 SSE 活跃连接时显示状态指示器（正在处理中）
  const showIndicator = showAnimation && !disabled && progress.status === 'processing'

  return (
    <RoutingStatusBadge
      className={className}
      status={effectiveStatus}
      message={effectiveMessage}
      distributedTargets={effectiveTargets}
      ruleNames={effectiveRuleNames}
      isConnected={progress.isConnected}
      error={progress.error}
      showIndicator={showIndicator}
      showAnimation={showAnimation}
    />
  )
}

interface RoutingStatusBadgeProps {
  status: RoutingStatus
  message: string
  distributedTargets: string[]
  ruleNames: string[]
  isConnected: boolean
  error: string | null
  showIndicator?: boolean
  showAnimation?: boolean  // 是否显示动画效果
}

function RoutingStatusBadge({
  status,
  message,
  distributedTargets,
  ruleNames,
  isConnected,
  error,
  showIndicator = false,
  showAnimation = true
}: RoutingStatusBadgeProps) {
  const t = useTranslations('inbox')
  
  // 根据状态返回不同的徽章样式和图标
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-gray-200 text-gray-600 bg-gray-50',
          icon: <Clock className="h-3 w-3 mr-1" />,
          text: message || t('routingStatus.pending')
        }

      case 'skipped':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-gray-300 text-gray-500 bg-gray-50',
          icon: <MinusCircle className="h-3 w-3 mr-1" />,
          text: message || t('routingStatus.skipped')
        }

      case 'processing':
        return {
          variant: 'outline' as const,
          className: `text-xs border-blue-200 text-blue-700 bg-blue-50 ${showAnimation ? 'animate-pulse' : ''}`,
          icon: <Loader2 className={`h-3 w-3 mr-1 ${showAnimation ? 'animate-spin' : ''}`} />,
          text: message || t('routingStatus.processing')
        }

      case 'completed':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300',
          icon: <CheckCircle className="h-3 w-3 mr-1" />,
          text: ruleNames.length > 0
            ? t('routingStatus.distributedWithRules', { rules: ruleNames.join(', ') })
            : t('routingStatus.completed')
        }

      case 'error':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-red-200 text-red-700 bg-red-50',
          icon: <XCircle className="h-3 w-3 mr-1" />,
          text: message || t('routingStatus.failed')
        }

      default:
        return {
          variant: 'outline' as const,
          className: 'text-xs border-gray-200 text-gray-600 bg-gray-50',
          icon: <Clock className="h-3 w-3 mr-1" />,
          text: '未知状态'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`flex items-center gap-2 ${showIndicator ? 'pr-1' : ''}`}>
      <Badge
        variant={config.variant}
        className={`${config.className} max-w-[200px] sm:max-w-none truncate`}
        title={error ? `错误: ${error}` : message}
      >
        {config.icon}
        <span className="truncate">{config.text}</span>
      </Badge>

      {/* 连接状态指示器（仅开发模式 + SSE 活跃时显示） */}
      {process.env.NODE_ENV === 'development' && showIndicator && (
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isConnected ? 'bg-green-400' : 'bg-gray-400'
          }`}
          title={isConnected ? 'SSE 已连接' : 'SSE 连接中'}
        />
      )}
    </div>
  )
}

// 导出类型供其他组件使用
export type { RoutingStatus }
