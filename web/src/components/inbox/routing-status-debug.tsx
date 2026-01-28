/**
 * 路由状态调试组件
 * 用于开发和测试 SSE 功能
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRoutingProgress } from '@/hooks/use-routing-progress'

interface RoutingStatusDebugProps {
  itemId: string
}

export function RoutingStatusDebug({ itemId }: RoutingStatusDebugProps) {
  const [isVisible, setIsVisible] = useState(false)
  const progress = useRoutingProgress(itemId)

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="mt-4">
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setIsVisible(!isVisible)}
      >
        {isVisible ? '隐藏' : '显示'} SSE 调试信息
      </Button>

      {isVisible && (
        <Card className="mt-2">
          <CardHeader>
            <CardTitle className="text-sm">路由进度调试信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">连接状态:</span>
              <Badge variant={progress.isConnected ? 'default' : 'secondary'}>
                {progress.isConnected ? '已连接' : '未连接'}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">当前状态:</span>
              <Badge variant="outline">{progress.status}</Badge>
            </div>
            
            <div>
              <span className="font-medium">消息:</span>
              <span className="ml-2">{progress.message}</span>
            </div>
            
            {progress.distributedTargets.length > 0 && (
              <div>
                <span className="font-medium">分发目标:</span>
                <div className="ml-2 flex flex-wrap gap-1 mt-1">
                  {progress.distributedTargets.map((target, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {target}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-4">
              <span>成功: <Badge variant="default">{progress.totalSuccess}</Badge></span>
              <span>失败: <Badge variant="destructive">{progress.totalFailed}</Badge></span>
            </div>
            
            {progress.error && (
              <div className="text-red-600">
                <span className="font-medium">错误:</span>
                <span className="ml-2">{progress.error}</span>
              </div>
            )}
            
            <div className="pt-2 border-t">
              <Button 
                variant="outline" 
                size="sm"
                onClick={progress.reconnect}
                disabled={progress.isConnected}
              >
                重新连接
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}