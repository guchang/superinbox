/**
 * 路由状态组件
 * 显示收件箱条目的实时路由分发状态
 *
 * 使用轮询方式：通过 useRoutingProgress Hook 每 3 秒查询一次状态
 * 不使用 SSE，简化连接管理并避免浏览器兼容性问题
 */

import { CheckCircle2, XCircle, Clock, MinusCircle } from 'lucide-react'
import { useRoutingProgress, type RoutingStatus as RoutingProgressStatus } from '@/hooks/use-routing-progress'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface RoutingStatusProps {
  itemId: string
  initialDistributedTargets?: any[]
  initialRuleNames?: string[]
  routingStatus?: string  // 从数据库获取的路由状态
  className?: string
  disabled?: boolean  // 禁用轮询
  showAnimation?: boolean  // 是否显示动画效果
}

export function RoutingStatus({ itemId, initialDistributedTargets = [], initialRuleNames = [], routingStatus, className, disabled = false, showAnimation = true }: RoutingStatusProps) {
  const t = useTranslations('inbox')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const progress = useRoutingProgress(itemId, { disabled })

  // 禁用时使用数据库中的静态状态（通过 useAutoRefetch 定期更新）
  const hasStaticData = initialDistributedTargets && initialDistributedTargets.length > 0
  const useStatic = disabled

  const effectiveStatus = useStatic
    ? (routingStatus as RoutingProgressStatus || 'pending')  // 使用数据库中的状态
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

  // 只在允许动画且正在轮询时显示状态指示器
  const showIndicator = showAnimation && !disabled && progress.isPolling

  return (
    <RoutingStatusBadge
      className={className}
      status={effectiveStatus}
      message={effectiveMessage}
      distributedTargets={effectiveTargets}
      ruleNames={effectiveRuleNames}
      isPolling={progress.isPolling}
      error={progress.error}
      showIndicator={showIndicator}
      showAnimation={showAnimation}
      isDark={isDark}
    />
  )
}

interface RoutingStatusBadgeProps {
  className?: string
  status: RoutingProgressStatus
  message: string
  distributedTargets: string[]
  ruleNames: string[]
  isPolling: boolean
  error: string | null
  showIndicator?: boolean
  showAnimation?: boolean
  isDark: boolean
}

function RoutingStatusBadge({
  status,
  message,
  distributedTargets,
  ruleNames,
  isPolling,
  error,
  showIndicator = false,
  showAnimation = true,
  isDark
}: RoutingStatusBadgeProps) {
  const t = useTranslations('inbox')

  // 根据状态返回不同的徽章样式和图标
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          wrapper: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
          icon: <CheckCircle2 size={12} className="shrink-0" />,
          text: ruleNames.length > 0
            ? t('routingStatus.distributedWithRules', { rules: ruleNames.join(', ') })
            : t('routingStatus.completed'),
          showDots: false
        }

      case 'processing':
        return {
          wrapper: isDark ? 'bg-white/5 border-white/10 text-white/30' : 'bg-black/5 border-black/5 text-black/30',
          icon: null,
          text: message || t('routingStatus.processing'),
          showDots: showAnimation
        }

      case 'skipped':
        return {
          wrapper: isDark ? 'bg-white/5 border-white/10 text-white/30' : 'bg-black/5 border-black/5 text-black/30',
          icon: <MinusCircle size={12} className="shrink-0" />,
          text: message || t('routingStatus.skipped'),
          showDots: false
        }

      case 'error':
        return {
          wrapper: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
          icon: <XCircle size={12} className="shrink-0" />,
          text: message || t('routingStatus.failed'),
          showDots: false
        }

      case 'pending':
      default:
        return {
          wrapper: isDark ? 'bg-white/5 border-white/10 text-white/30' : 'bg-black/5 border-black/5 text-black/30',
          icon: <Clock size={12} className="shrink-0" />,
          text: message || t('routingStatus.pending'),
          showDots: false
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`flex items-center gap-2 ${showIndicator ? 'pr-1' : ''}`}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black border truncate transition-colors",
          config.wrapper
        )}
        title={error ? `错误: ${error}` : message}
      >
        {config.icon}
        <span className="truncate whitespace-nowrap">{config.text}</span>
        {config.showDots && (
          <div className="flex gap-1 shrink-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                className="w-1.5 h-1.5 rounded-[2px] bg-current"
              />
            ))}
          </div>
        )}
      </div>

      {/* 轮询状态指示器（仅开发模式显示） */}
      {process.env.NODE_ENV === 'development' && showIndicator && (
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isPolling ? 'bg-green-400' : 'bg-gray-400'
          }`}
          title={isPolling ? '轮询中' : '轮询暂停'}
        />
      )}
    </div>
  )
}

// 导出类型供其他组件使用
export type { RoutingProgressStatus }
