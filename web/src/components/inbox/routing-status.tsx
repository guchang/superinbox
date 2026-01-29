/**
 * 路由状态组件
 * 显示收件箱条目的实时路由分发状态
 */

import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'
import { useRoutingProgress, type RoutingStatus } from '@/hooks/use-routing-progress'
import { useTranslations } from 'next-intl'

interface RoutingStatusProps {
  itemId: string
  initialDistributedTargets?: any[]
  initialRuleNames?: string[]
  className?: string
  disabled?: boolean  // 新增：禁用 SSE 连接
}

export function RoutingStatus({ itemId, initialDistributedTargets = [], initialRuleNames = [], className, disabled = false }: RoutingStatusProps) {
  const t = useTranslations('inbox')
  const progress = useRoutingProgress(itemId, { disabled })  // 传递 disabled 参数

  // 优先使用SSE实时状态，只有在SSE完全未连接时才使用静态数据
  // SSE连接中（包括正在连接）：使用SSE状态
  // SSE完全未连接（disabled=true 或 连接失败）：使用静态数据
  const hasStaticData = initialDistributedTargets && initialDistributedTargets.length > 0

  // 如果SSE已连接或正在连接（status不是pending），使用SSE状态
  // 如果SSE未连接（disabled=true）且有静态数据，使用静态数据
  const useStatic = disabled && hasStaticData

  const effectiveStatus = useStatic ? 'completed' : progress.status
  const effectiveTargets = useStatic ? initialDistributedTargets : progress.distributedTargets
  const effectiveRuleNames = useStatic ? initialRuleNames : (progress.ruleNames || [])
  const effectiveMessage = useStatic
    ? (initialRuleNames.length > 0 ? `已分发: ${initialRuleNames.join(', ')}` : `已分发到 ${initialDistributedTargets.length} 个目标`)
    : progress.message

  // 只在 SSE 活跃连接时显示状态指示器（正在处理中）
  const showIndicator = progress.status === 'starting' ||
                        progress.status === 'matching' ||
                        progress.status === 'distributing'

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
}

function RoutingStatusBadge({
  status,
  message,
  distributedTargets,
  ruleNames,
  isConnected,
  error,
  showIndicator = false
}: RoutingStatusBadgeProps) {
  
  // 根据状态返回不同的徽章样式和图标
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-gray-200 text-gray-600 bg-gray-50',
          icon: <Clock className="h-3 w-3 mr-1" />,
          text: message || '分发规则待配置'
        }

      case 'starting':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-blue-200 text-blue-700 bg-blue-50 animate-pulse',
          icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
          text: message || '后台路由分发中...'
        }

      case 'matching':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-yellow-200 text-yellow-700 bg-yellow-50 animate-pulse',
          icon: <Zap className="h-3 w-3 mr-1" />,
          text: message || '后台匹配规则中...'
        }

      case 'distributing':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-blue-200 text-blue-700 bg-blue-50 animate-pulse',
          icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
          text: message || '后台分发中...'
        }

      case 'completed':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300',
          icon: <CheckCircle className="h-3 w-3 mr-1" />,
          text: ruleNames.length > 0
            ? `已分发: ${ruleNames.join(', ')}`
            : '路由分发完成'
        }

      case 'error':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-red-200 text-red-700 bg-red-50',
          icon: <XCircle className="h-3 w-3 mr-1" />,
          text: message || '路由分发失败'
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