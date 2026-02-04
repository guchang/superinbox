/**
 * 路由进度轮询 Hook
 * 使用轮询方式监听收件箱条目的路由分发状态
 *
 * 实现方式：每 3 秒通过 API 获取条目最新状态
 * 不使用 SSE，避免连接管理复杂性和浏览器兼容性 issues
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { inboxApi } from '@/lib/api/inbox'
import { ItemStatus } from '@/types'

// 路由进度状态
export type RoutingStatus =
  | 'pending'      // 待配置
  | 'skipped'      // 跳过（无规则配置）
  | 'processing'   // 处理中
  | 'completed'    // 已完成
  | 'error'        // 出错

// Hook 返回的状态
export interface RoutingProgressState {
  status: RoutingStatus
  message: string
  distributedTargets: string[]
  ruleNames: string[]
  totalSuccess: number
  totalFailed: number
  isPolling: boolean  // 是否正在轮询中
  error: string | null
}

export function useRoutingProgress(itemId: string | null, options?: { disabled?: boolean }) {
  const { disabled = false } = options || {}
  const t = useTranslations('inbox')

  const [state, setState] = useState<RoutingProgressState>({
    status: 'pending',
    message: t('routePending'),
    distributedTargets: [],
    ruleNames: [],
    totalSuccess: 0,
    totalFailed: 0,
    isPolling: false,
    error: null
  })

  // 获取条目状态
  const fetchItemStatus = useCallback(async () => {
    if (!itemId || disabled) return

    try {
      const response = await inboxApi.getItem(itemId)
      const item = response.data

      if (!item) return

      // 根据条目状态更新
      if (item.status === ItemStatus.PROCESSING) {
        setState(prev => ({
          ...prev,
          status: 'processing',
          message: t('routingStatus.processing'),
          isPolling: true
        }))
      } else if (item.status === ItemStatus.FAILED) {
        setState(prev => ({
          ...prev,
          status: 'error',
          message: t('routingStatus.failed'),
          isPolling: false
        }))
      } else if (item.status === ItemStatus.COMPLETED) {
        // 已完成，检查分发结果
        const distributedTargets = item.distributedTargets || []
        const ruleNames = item.distributedRuleNames || []

        setState(prev => ({
          ...prev,
          status: distributedTargets.length > 0 ? 'completed' : 'skipped',
          message: distributedTargets.length > 0
            ? t('routingStatus.completed')
            : t('routingStatus.skipped'),
          distributedTargets,
          ruleNames,
          totalSuccess: item.distributionResults?.filter((r: any) => r.success).length || 0,
          totalFailed: item.distributionResults?.filter((r: any) => !r.success).length || 0,
          isPolling: false
        }))
      } else {
        // 其他状态（如 PENDING）
        setState(prev => ({
          ...prev,
          status: 'pending',
          message: t('routingStatus.pending'),
          isPolling: true
        }))
      }
    } catch (error) {
      const typedError = error as Error & { status?: number; code?: string }
      if (typedError?.status === 404 || typedError?.code === 'INBOX.NOT_FOUND') {
        setState(prev => ({
          ...prev,
          status: 'skipped',
          message: t('routingStatus.skipped'),
          isPolling: false,
          error: null
        }))
        return
      }

      console.error(`[useRoutingProgress] Failed to fetch item ${itemId}:`, error)
      setState(prev => ({
        ...prev,
        isPolling: false,
        error: error instanceof Error ? error.message : 'Fetch error'
      }))
    }
  }, [itemId, disabled, t])

  // 手动刷新
  const reconnect = useCallback(() => {
    fetchItemStatus()
  }, [fetchItemStatus])

  // 轮询逻辑
  useEffect(() => {
    if (!itemId || disabled) {
      setState(prev => ({
        ...prev,
        status: 'pending',
        message: t('routePending'),
        isPolling: false
      }))
      return
    }

    // 初始获取
    fetchItemStatus()

    // 如果状态是 processing 或 pending，启动轮询
    const shouldPoll = state.status === 'processing' || state.status === 'pending'
    if (!shouldPoll) return

    // 每 3 秒轮询一次
    const intervalId = setInterval(() => {
      fetchItemStatus()
    }, 3000)

    return () => {
      clearInterval(intervalId)
    }
  }, [itemId, disabled, fetchItemStatus, t, state.status])

  // 监听 disabled 参数变化
  useEffect(() => {
    if (disabled) {
      setState(prev => ({
        ...prev,
        status: 'pending',
        message: t('routePending'),
        isPolling: false,
        error: null
      }))
    }
  }, [disabled, t])

  return {
    ...state,
    reconnect
  }
}
