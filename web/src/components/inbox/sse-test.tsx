/**
 * SSE 连接测试组件
 * 用于测试和调试 SSE 功能
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useRoutingProgress } from '@/hooks/use-routing-progress'

export function SSETest() {
  const [testItemId, setTestItemId] = useState('7b3ff4ac-57eb-4978-9250-ef8b1d6b883a') // 从日志中获取的最新 item ID
  const [isActive, setIsActive] = useState(false)
  
  const progress = useRoutingProgress(isActive ? testItemId : null)

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">SSE 连接测试</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={testItemId}
            onChange={(e) => setTestItemId(e.target.value)}
            placeholder="输入 Item ID"
            className="text-sm"
          />
          <Button
            variant={isActive ? "destructive" : "default"}
            size="sm"
            onClick={() => setIsActive(!isActive)}
          >
            {isActive ? '断开' : '连接'}
          </Button>
        </div>

        {isActive && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">连接状态:</span>
              <div className={`w-3 h-3 rounded-full ${progress.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{progress.isConnected ? '已连接' : '未连接'}</span>
            </div>
            
            <div>
              <span className="font-medium">状态:</span>
              <span className="ml-2">{progress.status}</span>
            </div>
            
            <div>
              <span className="font-medium">消息:</span>
              <span className="ml-2">{progress.message}</span>
            </div>
            
            {progress.error && (
              <div className="text-red-600">
                <span className="font-medium">错误:</span>
                <span className="ml-2">{progress.error}</span>
              </div>
            )}
            
            {progress.distributedTargets.length > 0 && (
              <div>
                <span className="font-medium">分发目标:</span>
                <span className="ml-2">{progress.distributedTargets.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}