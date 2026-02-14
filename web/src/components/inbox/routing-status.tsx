/**
 * 路由状态组件
 * 显示收件箱条目的实时路由分发状态
 */

import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, MinusCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRoutingProgress, type RoutingStatus as RoutingProgressStatus } from '@/hooks/use-routing-progress'
import { useEffect, type CSSProperties } from 'react'
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

  // 避免线上/演示污染 UI：
  // 仅在 NODE_ENV=development 且访问域名为 localhost/127.0.0.1 时显示调试 UI。
  // 这样在局域网 IP 访问时（常见演示场景）不会展示调试信息。
  const showDebugUI =
    process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  // 对于禁用 SSE 的条目，使用数据库中的 routingStatus
  // 这些数据会通过 useAutoRefetch 定期更新
  const hasStaticData = initialDistributedTargets && initialDistributedTargets.length > 0

  // 如果禁用了 SSE，使用数据库状态
  const useStatic = disabled

  // 状态优先级：SSE 最终状态 > 传入的 routingStatus prop > SSE 进度状态
  // 当 SSE 已连接并有明确状态时，优先使用 SSE 状态
  // 当 SSE 已断开但已达到最终状态（completed/error/skipped），优先使用 SSE 状态
  const isFinalSSEStatus = ['completed', 'error', 'skipped'].includes(progress.status)
  const shouldPreferSSE = !useStatic && (
    progress.isConnected || // SSE 连接中，使用实时状态
    isFinalSSEStatus        // SSE 已断开但已达到最终状态
  )
  const effectiveStatus = shouldPreferSSE
    ? progress.status
    : useStatic
      ? (routingStatus as RoutingProgressStatus || 'pending')
      : (routingStatus as RoutingProgressStatus) || progress.status
  // 根据是否优先使用 SSE 状态，选择正确的数据源
  const effectiveTargets = shouldPreferSSE
    ? progress.distributedTargets
    : (useStatic ? initialDistributedTargets : progress.distributedTargets)
  const effectiveRuleNames = shouldPreferSSE
    ? (progress.ruleNames || [])
    : (useStatic ? initialRuleNames : (progress.ruleNames || []))

  // SSE 消息后备逻辑：如果 progress.message 为空，根据状态提供默认消息
  const getFallbackMessage = (status: RoutingProgressStatus, names: string[]): string => {
    switch (status) {
      case 'processing':
        return t('routingStatus.processing')
      case 'completed':
        return names.length > 0
          ? t('routingStatus.distributedWithRules', { rules: names.join(', ') })
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

  // 消息优先级：优先使用 SSE 的消息，特别是当 SSE 已达到最终状态时
  const effectiveMessage = shouldPreferSSE
    ? (progress.message || getFallbackMessage(progress.status, progress.ruleNames || []))
    : useStatic
      ? (initialRuleNames.length > 0
          ? t('routingStatus.distributedWithRules', { rules: initialRuleNames.join(', ') })
          : hasStaticData
            ? t('routeDistributed', { count: initialDistributedTargets.length })
            : routingStatus === 'skipped'
              ? t('routingStatus.skipped')
              : t('routingStatus.pending')
        )
      : (progress.message || getFallbackMessage(effectiveStatus, effectiveRuleNames))

  // 只在允许动画且正在处理中时显示状态指示器
  // 使用 effectiveStatus 确保乐观更新时也能显示
  const showIndicator = showAnimation && !disabled && effectiveStatus === 'processing'

  // 当 routingStatus 变为 processing 时，强制重新连接 SSE
  useEffect(() => {
    if (routingStatus === 'processing' && !progress.isConnected) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[RoutingStatus] Status changed to processing, reconnecting SSE...')
      }
      progress.reconnect()
    }
  }, [routingStatus, progress.isConnected, progress.reconnect])

  // 添加 SSE 调试日志到 console
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    console.log('[RoutingStatus Debug]', {
      itemId,
      routingStatus,
      effectiveStatus,
      progressStatus: progress.status,
      progressMessage: progress.message,
      isConnected: progress.isConnected,
      effectiveMessage,
      timestamp: new Date().toISOString()
    })
  }, [itemId, routingStatus, effectiveStatus, progress.status, progress.message, progress.isConnected, effectiveMessage])

  return (
    <div className="flex flex-col gap-1">
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
      {/* 调试日志显示 */}
      {showDebugUI && (
        <div className="text-[10px] text-gray-400 font-mono bg-gray-900/5 p-2 rounded">
          <div>SSE: {progress.isConnected ? '🟢' : '🔴'} | Status: {progress.status} | Prop: {routingStatus}</div>
          <div>Msg: {progress.message || '(empty)'}</div>
        </div>
      )}
    </div>
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
  const showDebugUI =
    process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  
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
      {showDebugUI && showIndicator && (
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
