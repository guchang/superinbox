"use client"

import { useQuery } from '@tanstack/react-query'
import { intelligenceApi } from '@/lib/api/intelligence'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Plus, Edit } from 'lucide-react'
import Link from 'next/link'

export default function AIPage() {
  const { data: promptsData, isLoading, refetch } = useQuery({
    queryKey: ['prompts'],
    queryFn: () => intelligenceApi.getPrompts(),
  })

  const prompts = promptsData?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI 引擎</h1>
          <p className="text-muted-foreground">管理 Prompt 模板和 AI 分析配置</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Link href="/ai/prompts">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建 Prompt
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Prompt 模板</CardTitle>
            <CardDescription>已配置的模板数量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{prompts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>活跃模板</CardTitle>
            <CardDescription>正在使用的模板</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {prompts.filter((p) => p.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>意图类型</CardTitle>
            <CardDescription>支持的意图类型</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">6</div>
          </CardContent>
        </Card>
      </div>

      {/* Prompt Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Prompt 模板</CardTitle>
          <CardDescription>管理 AI 分析的 Prompt 模板</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无 Prompt 模板
            </div>
          ) : (
            <div className="space-y-4">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex items-start justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{prompt.name}</h3>
                      <Badge variant={prompt.isActive ? 'default' : 'secondary'}>
                        {prompt.isActive ? '活跃' : '停用'}
                      </Badge>
                      <Badge variant="outline">{prompt.intent}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {prompt.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      变量: {prompt.variables.join(', ') || '无'}
                    </p>
                  </div>
                  <Link href={`/ai/prompts/${prompt.id}`}>
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
