/**
 * 路由进度 SSE Hook
 * 监听收件箱条目的路由分发实时进度
 * 使用 Intersection Observer 懒加载连接
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { getBackendDirectUrl } from '@/lib/api/base-url'

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
  isConnected: boolean
  error: string | null
}

export function useRoutingProgress(itemId: string | null, options?: { disabled?: boolean }) {
  const { disabled = false } = options || {}
  const t = useTranslations('inbox')

  const [state, setState] = useState<RoutingProgressState>({
    status: 'pending',
    message: (itemId && !disabled) ? t('routingProgress.connecting') : t('routePending'),
    distributedTargets: [],
    ruleNames: [],
    totalSuccess: 0,
    totalFailed: 0,
    isConnected: false,
    error: null
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionIdRef = useRef<string | null>(null)

  // 断开连接
  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    setState(prev => ({
      ...prev,
      isConnected: false
    }))
  }, [])

  // 处理 SSE 事件
  const handleEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      const eventType = event.type

      console.log(`[SSE] Received event: ${eventType}`, data)

      switch (eventType) {
        case 'connected':
          setState(prev => ({
            ...prev,
            isConnected: true,
            error: null
          }))
          break

        case 'routing:start':
          setState(prev => ({
            ...prev,
            status: 'processing',
            message: typeof data?.totalRules === 'number'
              ? t('routingProgress.startWithRules', { count: data.totalRules })
              : t('routingProgress.start'),
            error: null
          }))
          break

        case 'routing:skipped':
          setState(prev => ({
            ...prev,
            status: 'skipped',
            message: t('routingProgress.skipped'),
            error: null
          }))
          // Auto-disconnect on skipped
          disconnect()
          break

        case 'routing:rule_match':
          setState(prev => ({
            ...prev,
            status: 'processing',
            message: t('routingProgress.ruleMatch', { ruleName: data.ruleName || '' })
          }))
          break

        case 'step:start':
          setState(prev => ({
            ...prev,
            status: 'processing',
            message: t('routingProgress.stepStart', { step: data.step ?? '-' })
          }))
          break

        case 'step:planned':
          setState(prev => ({
            ...prev,
            status: 'processing',
            message: t('routingProgress.stepPlanned', { step: data.step ?? '-' })
          }))
          break

        case 'step:executing':
          setState(prev => ({
            ...prev,
            status: 'processing',
            message: t('routingProgress.stepExecuting', {
              step: data.step ?? '-',
              toolName: data.toolName || t('routingProgress.unknownTool')
            })
          }))
          break

        case 'step:complete':
          const toolName = data.toolName || t('routingProgress.unknownTool')
          setState(prev => ({
            ...prev,
            status: 'processing',
            message: t('routingProgress.stepComplete', {
              step: data.step ?? '-',
              toolName
            })
          }))
          break

        case 'step:error':
          setState(prev => ({
            ...prev,
            status: 'processing',
            message: t('routingProgress.stepError', {
              step: data.step ?? '-',
              toolName: data.toolName || t('routingProgress.unknownTool'),
              error: data.error ? `: ${data.error}` : ''
            })
          }))
          break

        case 'complete':
          // All steps completed
          setState(prev => ({
            ...prev,
            status: 'completed',
            message: t('routingProgress.completed'),
            distributedTargets: data.distributedTargets || [],
            ruleNames: data.ruleNames || [],
            totalSuccess: data.totalSuccess || 0,
            totalFailed: data.totalFailed || 0
          }))
          // Auto-disconnect on completion
          disconnect()
          break

        case 'routing:complete':
          setState(prev => ({
            ...prev,
            status: 'completed',
            message: t('routingProgress.completed'),
            distributedTargets: data.distributedTargets || [],
            ruleNames: data.ruleNames || [],
            totalSuccess: data.totalSuccess || 0,
            totalFailed: data.totalFailed || 0
          }))
          // Auto-disconnect on completion
          disconnect()
          break

        case 'routing:error':
          setState(prev => ({
            ...prev,
            status: 'error',
            message: t('routingProgress.error'),
            error: data.error
          }))
          // Auto-disconnect on error
          disconnect()
          break

        default:
          console.log(`[SSE] Unknown event type: ${eventType}`)
      }
    } catch (error) {
      console.error('[SSE] Failed to parse event data:', error)
    }
  }, [t, disconnect])

  // 使用 fetch + ReadableStream 替代 EventSource（支持自定义 headers 和代理）
  const connect = useCallback(async (currentConnectionId: string) => {
    if (!itemId || disabled) return

    // 创建新的 AbortController（不中止旧连接，让它通过检查 connectionId 自然退出）
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    connectionIdRef.current = currentConnectionId

    try {
      const token = localStorage.getItem('superinbox_auth_token') || localStorage.getItem('token')

      if (!token) {
        console.warn('[useRoutingProgress] No authentication token found')
        return
      }

      setState(prev => ({ ...prev, isConnected: false }))

      // 直接连接后端（绕过 Next.js 代理，因为代理不支持 SSE）
      // 使用 fetch + ReadableStream 替代 EventSource，支持自定义 headers
      const backendUrl = getBackendDirectUrl()
      const response = await fetch(`${backendUrl}/v1/inbox/${itemId}/routing-progress`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        signal: abortControllerRef.current?.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      setState(prev => ({ ...prev, isConnected: true }))
      console.log(`[SSE] Connected for item: ${itemId}`)

      // 读取 SSE 流
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Response body is null')
      }

      let buffer = ''

      while (true) {
        // 检查是否仍然是当前连接实例
        if (connectionIdRef.current !== currentConnectionId) {
          console.log(`[SSE] Connection instance changed, aborting old connection for item: ${itemId}`)
          break
        }

        const { done, value } = await reader.read()

        if (done) {
          setState(prev => ({ ...prev, isConnected: false }))
          console.log(`[SSE] Connection closed for item: ${itemId}`)
          break
        }

        // 解码并处理数据
        buffer += decoder.decode(value, { stream: true })

        // 分割 SSE 消息（每个消息以 \n\n 分隔）
        const messages = buffer.split('\n\n')
        buffer = messages.pop() || '' // 保留最后一个不完整的消息

        for (const message of messages) {
          if (!message.trim()) continue

          // 再次检查连接实例（在处理每条消息前）
          if (connectionIdRef.current !== currentConnectionId) {
            console.log(`[SSE] Connection instance changed, stopping event processing for item: ${itemId}`)
            break
          }

          // 解析 SSE 格式
          let eventType = 'message'
          let eventData = ''

          for (const line of message.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7).trim()
            } else if (line.startsWith('data: ')) {
              eventData = line.substring(6).trim()
            }
          }

          if (eventData) {
            // 模拟 MessageEvent 对象
            const msgEvent = new MessageEvent(eventType, { data: eventData })
            handleEvent(msgEvent)
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[SSE] Connection aborted for item: ${itemId}`)
      } else {
        console.error(`[SSE] Connection error for item ${itemId}:`, error)
        setState(prev => ({
          ...prev,
          isConnected: false,
          error: error instanceof Error ? error.message : 'Connection error'
        }))
      }
    }
  }, [itemId, handleEvent, disabled, getBackendDirectUrl])

  // 手动重连
  const reconnect = useCallback(() => {
    // 生成新的连接 ID 并重新连接
    const newConnectionId = `${itemId}-${Date.now()}-${Math.random()}`
    disconnect()
    connect(newConnectionId)
  }, [disconnect, connect, itemId])

  // 监听 disabled 参数变化，立即断开连接并重置状态
  useEffect(() => {
    if (disabled) {
      disconnect()
      setState(prev => ({
        ...prev,
        status: 'pending',
        message: t('routePending'),
        isConnected: false,
        error: null
      }))
    }
  }, [disabled, disconnect, t])

  // 自动连接和清理
  useEffect(() => {
    // 为每次挂载生成唯一的连接 ID
    const currentConnectionId = `${itemId}-${Date.now()}-${Math.random()}`

    if (itemId && !disabled) {
      connect(currentConnectionId)
    } else {
      console.log(`[useRoutingProgress] No itemId provided or disabled`)
    }

    return () => {
      console.log(`[useRoutingProgress] Cleanup for item: ${itemId}`)
      disconnect()
    }
  }, [itemId, disabled, connect, disconnect])

  return {
    ...state,
    reconnect
  }
}
