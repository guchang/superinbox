"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Check, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [currentKey, setCurrentKey] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    // 加载当前保存的 API Key
    const savedKey = localStorage.getItem('superinbox_api_key') || ''
    setCurrentKey(savedKey)
  }, [])

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast({
        title: 'API Key 不能为空',
        description: '请输入有效的 API Key',
        variant: 'destructive',
      })
      return
    }

    localStorage.setItem('superinbox_api_key', apiKey.trim())
    setCurrentKey(apiKey.trim())
    toast({
      title: 'API Key 已保存',
      description: 'API Key 已成功保存到本地存储',
    })
    setApiKey('')
  }

  const handleUseDefaultKey = () => {
    const defaultKey = 'dev-key-change-this-in-production'
    localStorage.setItem('superinbox_api_key', defaultKey)
    setCurrentKey(defaultKey)
    toast({
      title: '已使用默认开发密钥',
      description: '默认密钥仅用于开发环境，生产环境请更换',
    })
  }

  const handleClearApiKey = () => {
    localStorage.removeItem('superinbox_api_key')
    setCurrentKey('')
    toast({
      title: 'API Key 已清除',
      description: '系统将自动使用默认开发密钥',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">系统设置</h1>
      </div>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>API 认证配置</CardTitle>
          <CardDescription>
            配置访问 SuperInbox 后端所需的 API Key
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API 地址 */}
          <div className="space-y-2">
            <Label htmlFor="api-url">API 地址</Label>
            <Input
              id="api-url"
              value={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'}
              disabled
              className="bg-muted"
            />
          </div>

          {/* 当前 API Key 状态 */}
          <div className="space-y-2">
            <Label>当前 API Key 状态</Label>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {currentKey ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">已配置</span>
                      <Badge variant="outline">本地存储</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Key: {currentKey.substring(0, 8)}...{currentKey.length > 12 ? currentKey.substring(currentKey.length - 4) : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearApiKey}>
                    清除
                  </Button>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">未配置</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      将使用默认开发密钥
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 设置新的 API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">设置新的 API Key</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type="password"
                placeholder="输入你的 API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveApiKey()
                }}
                className="flex-1"
              />
              <Button onClick={handleSaveApiKey}>保存</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              生产环境建议使用后端生成的 API Key
            </p>
          </div>

          {/* 快速操作 */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleUseDefaultKey}>
              使用默认开发密钥
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>快速导航</CardTitle>
          <CardDescription>访问其他设置页面</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Button variant="outline" className="h-auto p-4" asChild>
            <a href="/settings/api-keys">
              <div className="text-left">
                <div className="font-medium mb-1">API 密钥管理</div>
                <div className="text-sm text-muted-foreground">
                  创建和管理 API 密钥
                </div>
              </div>
            </a>
          </Button>
          <Button variant="outline" className="h-auto p-4" asChild>
            <a href="/settings/logs">
              <div className="text-left">
                <div className="font-medium mb-1">访问日志</div>
                <div className="text-sm text-muted-foreground">
                  查看系统访问记录
                </div>
              </div>
            </a>
          </Button>
          <Button variant="outline" className="h-auto p-4" asChild>
            <a href="/settings/statistics">
              <div className="text-left">
                <div className="font-medium mb-1">使用统计</div>
                <div className="text-sm text-muted-foreground">
                  查看系统使用情况
                </div>
              </div>
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
