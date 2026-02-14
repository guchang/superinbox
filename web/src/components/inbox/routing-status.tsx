/**
 * 路由状态组件
 * 显示收件箱条目的实时路由分发状态
 */

import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, MinusCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRoutingProgress, type RoutingStatus as RoutingProgressStatus } from '@/hooks/use-routing-progress'
import type { CSSProperties } from 'react'
import { useTranslations } from 'next-intl'

const createProcessingTintStyle = (accentColor: string): CSSProperties => ({
  backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
  borderColor: `color-mix(in srgb, ${accentColor} 36%, transparent)`,
  color: accentColor,
})

interface ProcessingBlocksProps {
  active: boolean
  blockClassName: string
  blockStyle?: { backgroundColor?: string }
}

function ProcessingBlocks({ active, blockClassName, blockStyle }: ProcessingBlocksProps) {
  return (
    <div className="flex gap-0.5 ml-1">
      {Array.from({ length: 20 }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0.1, scale: 0.8 }}
          animate={active
            ? {
                opacity: [0.1, 0.6, 0.1],
                scale: [0.8, 1, 0.8],
              }
            : { opacity: 0.05 }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: index * 0.1,
            ease: 'easeInOut',
          }}
          className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-[1px] md:rounded-[2px] ${index >= 12 ? 'hidden md:block' : ''} ${blockClassName}`}
          style={blockStyle}
        />
      ))}
    </div>
  )
}

interface RoutingStatusProps {
  itemId: string
  initialDistributedTargets?: any[]
  initialRuleNames?: string[]
  routingStatus?: string  // 从数据库获取的路由状态
  className?: string
  disabled?: boolean  // 禁用 SSE 连接
  showAnimation?: boolean  // 是否显示动画效果
  processingAccentColor?: string
}

export function RoutingStatus({ itemId, initialDistributedTargets = [], initialRuleNames = [], routingStatus, className, disabled = false, showAnimation = true, processingAccentColor }: RoutingStatusProps) {
  const t = useTranslations('inbox')
  const progress = useRoutingProgress(itemId, { disabled })

  // 对于禁用 SSE 的条目，使用数据库中的 routingStatus
  // 这些数据会通过 useAutoRefetch 定期更新
  const hasStaticData = initialDistributedTargets && initialDistributedTargets.length > 0

  // 如果禁用了 SSE，使用数据库状态
  const useStatic = disabled

  // 优先使用传入的 routingStatus prop（支持乐观更新）
  // 当 SSE 连接建立并收到事件后，progress.status 会反映真实状态
  const effectiveStatus = useStatic
    ? (routingStatus as RoutingProgressStatus || 'pending')
    : (routingStatus as RoutingProgressStatus) || progress.status
  const effectiveTargets = useStatic ? initialDistributedTargets : progress.distributedTargets
  const effectiveRuleNames = useStatic ? initialRuleNames : (progress.ruleNames || [])
  // SSE 消息后备逻辑：如果 progress.message 为空，根据状态提供默认消息
  const getFallbackMessage = (status: RoutingProgressStatus): string => {
    switch (status) {
      case 'processing':
        return t('routingStatus.processing')
      case 'completed':
        return ruleNames.length > 0
          ? t('routingStatus.distributedWithRules', { rules: ruleNames.join(', ') })
          : t('routingStatus.completed')
      case 'skipped':
        return t('routingStatus.skipped')
      case 'error':
        return t('routingStatus.failed')
      case 'pending':
      default:
        return t('routingStatus.pending')
    }
  }

  const effectiveMessage = useStatic
    ? (initialRuleNames.length > 0
        ? t('routingStatus.distributedWithRules', { rules: initialRuleNames.join(', ') })
        : hasStaticData
          ? t('routeDistributed', { count: initialDistributedTargets.length })
          : routingStatus === 'skipped'
            ? t('routingStatus.skipped')
            : t('routingStatus.pending')
      )
    : (progress.message || getFallbackMessage(effectiveStatus))

  // 只在允许动画且正在处理中时显示状态指示器
  // 使用 effectiveStatus 确保乐观更新时也能显示
  const showIndicator = showAnimation && !disabled && effectiveStatus === 'processing'

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
      processingAccentColor={processingAccentColor}
    />
  )
}

interface RoutingStatusBadgeProps {
  status: RoutingProgressStatus
  message: string
  distributedTargets: string[]
  ruleNames: string[]
  isConnected: boolean
  error: string | null
  showIndicator?: boolean
  showAnimation?: boolean  // 是否显示动画效果
  processingAccentColor?: string
  className?: string
}

function RoutingStatusBadge({
  status,
  message,
  distributedTargets,
  ruleNames,
  isConnected,
  error,
  showIndicator = false,
  showAnimation = true,
  processingAccentColor,
  className
}: RoutingStatusBadgeProps) {
  const t = useTranslations('inbox')
  
  // 根据状态返回不同的徽章样式和图标
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-amber-400/30 bg-amber-100/10 text-amber-700/80 dark:border-amber-300/18 dark:bg-amber-300/6 dark:text-amber-200/75',
          icon: <Clock className="h-2.5 w-2.5 mr-1 opacity-65" />,
          text: message || t('routingStatus.pending'),
          processingBlockClassName: ''
        }

      case 'skipped':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-zinc-400/30 bg-zinc-500/5 text-zinc-600/78 dark:border-zinc-200/16 dark:bg-white/4 dark:text-zinc-300/65',
          icon: <MinusCircle className="h-2.5 w-2.5 mr-1 opacity-60" />,
          text: message || t('routingStatus.skipped'),
          processingBlockClassName: ''
        }

      case 'processing':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-blue-300/80 bg-blue-50 text-blue-800 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200',
          icon: null,
          text: message || t('routingStatus.processing'),
          processingBlockClassName: 'bg-blue-600/70 dark:bg-blue-300/80'
        }

      case 'completed':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-emerald-400/30 bg-emerald-100/10 text-emerald-700/80 dark:border-emerald-300/18 dark:bg-emerald-300/6 dark:text-emerald-200/75',
          icon: <CheckCircle className="h-2.5 w-2.5 mr-1 opacity-65" />,
          text: ruleNames.length > 0
            ? t('routingStatus.distributedWithRules', { rules: ruleNames.join(', ') })
            : t('routingStatus.completed'),
          processingBlockClassName: ''
        }

      case 'error':
        return {
          variant: 'outline' as const,
          className: 'text-xs border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200',
          icon: <XCircle className="h-3 w-3 mr-1" />,
          text: message || t('routingStatus.failed'),
          processingBlockClassName: ''
        }

      default:
        return {
          variant: 'outline' as const,
          className: 'text-xs border-gray-200/80 bg-gray-50 text-gray-600 dark:border-white/15 dark:bg-white/5 dark:text-white/55',
          icon: <Clock className="h-3 w-3 mr-1" />,
          text: '未知状态',
          processingBlockClassName: ''
        }
    }
  }

  const config = getStatusConfig()
  const normalizedProcessingAccent = processingAccentColor?.trim()
  const hasProcessingAccent = status === 'processing' && Boolean(normalizedProcessingAccent)
  const processingBadgeStyle = hasProcessingAccent && normalizedProcessingAccent
    ? createProcessingTintStyle(normalizedProcessingAccent)
    : undefined
  const processingBlockStyle = hasProcessingAccent && normalizedProcessingAccent
    ? { backgroundColor: normalizedProcessingAccent }
    : undefined
  const processingBlockClassName = hasProcessingAccent ? '' : config.processingBlockClassName

  return (
    <div className={`flex items-center gap-2 ${showIndicator ? 'pr-1' : ''} ${className ?? ''}`.trim()}>
      <Badge
        variant={config.variant}
        className={`${config.className} max-w-full truncate`}
        style={processingBadgeStyle}
        title={error ? `错误: ${error}` : message}
      >
        {config.icon}
        <span className="truncate">{config.text}</span>
        {status === 'processing' && (
          <ProcessingBlocks
            active={showAnimation}
            blockClassName={processingBlockClassName}
            blockStyle={processingBlockStyle}
          />
        )}
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

