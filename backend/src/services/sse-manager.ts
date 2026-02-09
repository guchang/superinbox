/**
 * SSE 连接管理器
 * 管理收件箱条目路由进度的 SSE 连接
 */

import { Response } from 'express'
import { logger } from '../middleware/logger.js'
import type { RoutingProgressEventType } from '../types/routing-progress.js'

interface SSEConnection {
  id: string
  itemId: string
  userId: string
  response: Response
  createdAt: Date
}

class SSEManager {
  private connections = new Map<string, SSEConnection>()
  private itemConnections = new Map<string, Set<string>>() // itemId -> connectionIds

  /**
   * 创建新的 SSE 连接
   */
  createConnection(itemId: string, userId: string, res: Response): string {
    const connectionId = `${itemId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // 设置 SSE 头部
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    // 发送初始连接事件
    this.sendSSEEvent(res, 'connected', {
      connectionId,
      itemId,
      timestamp: new Date().toISOString()
    })

    // 存储连接
    const connection: SSEConnection = {
      id: connectionId,
      itemId,
      userId,
      response: res,
      createdAt: new Date()
    }

    this.connections.set(connectionId, connection)

    // 建立 itemId 到连接的映射
    if (!this.itemConnections.has(itemId)) {
      this.itemConnections.set(itemId, new Set())
    }
    this.itemConnections.get(itemId)!.add(connectionId)

    // 处理连接关闭
    res.on('close', () => {
      this.removeConnection(connectionId)
    })

    res.on('error', (error) => {
      logger.error(`SSE connection error for ${connectionId}:`, error)
      this.removeConnection(connectionId)
    })

    logger.info(`SSE connection created: ${connectionId} for item ${itemId}`)
    return connectionId
  }

  /**
   * 移除连接
   */
  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    const { itemId } = connection

    // 从连接映射中移除
    this.connections.delete(connectionId)

    // 从 item 映射中移除
    const itemConnections = this.itemConnections.get(itemId)
    if (itemConnections) {
      itemConnections.delete(connectionId)
      if (itemConnections.size === 0) {
        this.itemConnections.delete(itemId)
      }
    }

    logger.info(`SSE connection removed: ${connectionId}`)
  }

  /**
   * 向特定条目的所有连接发送事件
   */
  sendToItem(itemId: string, event: RoutingProgressEventType): void {
    const connectionIds = this.itemConnections.get(itemId)
    if (!connectionIds || connectionIds.size === 0) {
      logger.debug(`No SSE connections for item ${itemId}`)
      return
    }

    logger.info(`Sending SSE event ${event.type} to ${connectionIds.size} connections for item ${itemId}`)

    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId)
      if (connection) {
        try {
          this.sendSSEEvent(connection.response, event.type, event.data)
        } catch (error) {
          logger.error(`Failed to send SSE event to ${connectionId}:`, error)
          this.removeConnection(connectionId)
        }
      }
    }

    // Auto-close connections after completion or error
    if (event.type === 'routing:complete' || event.type === 'routing:error') {
      logger.info(`Auto-closing ${connectionIds.size} SSE connections for item ${itemId} after ${event.type}`)
      this.closeConnectionsForItem(itemId)
    }
  }

  /**
   * 关闭特定条目的所有SSE连接
   */
  closeConnectionsForItem(itemId: string): void {
    const connectionIds = this.itemConnections.get(itemId)
    if (!connectionIds || connectionIds.size === 0) {
      return
    }

    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId)
      if (connection) {
        try {
          // End the SSE connection
          connection.response.end()
        } catch (error) {
          logger.error(`Failed to close SSE connection ${connectionId}:`, error)
        }
      }
    }

    logger.info(`Closed ${connectionIds.size} SSE connections for item ${itemId}`)
  }

  /**
   * 发送 SSE 事件
   */
  private sendSSEEvent(res: Response, event: string, data: any): void {
    const eventData = JSON.stringify(data)
    res.write(`event: ${event}\n`)
    res.write(`data: ${eventData}\n\n`)
  }

  /**
   * 获取连接统计
   */
  getStats(): { totalConnections: number; itemsWithConnections: number } {
    return {
      totalConnections: this.connections.size,
      itemsWithConnections: this.itemConnections.size
    }
  }

  /**
   * 清理过期连接（可选，用于定期清理）
   */
  cleanupExpiredConnections(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = new Date()
    const expiredConnections: string[] = []

    for (const [connectionId, connection] of this.connections) {
      if (now.getTime() - connection.createdAt.getTime() > maxAgeMs) {
        expiredConnections.push(connectionId)
      }
    }

    for (const connectionId of expiredConnections) {
      this.removeConnection(connectionId)
    }

    if (expiredConnections.length > 0) {
      logger.info(`Cleaned up ${expiredConnections.length} expired SSE connections`)
    }
  }
}

// 单例实例
export const sseManager = new SSEManager()

// 定期清理过期连接（每5分钟）
setInterval(() => {
  sseManager.cleanupExpiredConnections()
}, 5 * 60 * 1000)
