import type { Item } from '../../types/index.js'
import type { RoutingProgressEventType } from '../../types/routing-progress.js'

type RoutingProgressItemSnapshot = Pick<
  Item,
  'id' | 'routingStatus' | 'distributedTargets' | 'distributionResults'
>

/**
 * Build the initial routing progress SSE event for an item.
 *
 * Important: do NOT emit routing:start for pending/skipped/failed states, otherwise
 * the frontend will interpret it as "processing" and appear stuck forever.
 */
export function buildRoutingProgressInitialEvent(item: RoutingProgressItemSnapshot): RoutingProgressEventType {
  const now = new Date().toISOString()
  const status = item.routingStatus ?? 'pending'

  if (status === 'processing') {
    return {
      type: 'routing:start',
      itemId: item.id,
      timestamp: now,
      data: {
        totalRules: 0,
        message: '正在分析路由规则...'
      }
    }
  }

  if (status === 'skipped') {
    return {
      type: 'routing:skipped',
      itemId: item.id,
      timestamp: now,
      data: {
        message: '路由分发已跳过'
      }
    }
  }

  if (status === 'failed') {
    return {
      type: 'routing:error',
      itemId: item.id,
      timestamp: now,
      data: {
        message: '路由分发失败',
        error: 'Routing failed'
      }
    }
  }

  // Only treat as completed when Core state says so. Also allow empty targets:
  // some setups may complete with only failures (targets array empty).
  if (status === 'completed') {
    const distributedTargets = Array.isArray(item.distributedTargets) ? item.distributedTargets : []
    const results = Array.isArray(item.distributionResults) ? item.distributionResults : []

    const ruleNames = results
      .filter((r: any) => r && typeof r.ruleName === 'string' && r.ruleName.length > 0)
      .filter((r: any) => r.status === 'success' || r.status === 'completed')
      .map((r: any) => r.ruleName)

    const totalFailed = results.filter((r: any) => r && r.status === 'failed').length

    return {
      type: 'routing:complete',
      itemId: item.id,
      timestamp: now,
      data: {
        distributedTargets,
        ruleNames,
        totalSuccess: distributedTargets.length,
        totalFailed,
        message: ruleNames.length > 0
          ? `已分发: ${ruleNames.join(', ')}`
          : (distributedTargets.length > 0 ? `已分发到 ${distributedTargets.length} 个目标` : '路由分发完成')
      }
    }
  }

  // Default: pending
  return {
    type: 'routing:pending',
    itemId: item.id,
    timestamp: now,
    data: {
      message: '分发规则待配置'
    }
  }
}

