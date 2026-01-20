"use client"

import { useQuery } from '@tanstack/react-query'
import { routingApi } from '@/lib/api/routing'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Plus, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function RoutingPage() {
  const { data: rulesData, isLoading, refetch } = useQuery({
    queryKey: ['routing-rules'],
    queryFn: () => routingApi.getRules(),
  })

  const rules = rulesData?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">分发规则</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Link href="/routing/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建规则
            </Button>
          </Link>
        </div>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle>规则列表</CardTitle>
          <CardDescription>
            按优先级排序的分发规则，优先级高的规则先执行
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无分发规则
            </div>
          ) : (
            <div className="space-y-4">
              {rules
                .sort((a, b) => b.priority - a.priority)
                .map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-start justify-between border-b pb-4 last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{rule.name}</h3>
                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                          {rule.isActive ? '活跃' : '停用'}
                        </Badge>
                        <Badge variant="outline">优先级: {rule.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {rule.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {rule.conditions.map((condition, index) => (
                          <Badge key={index} variant="secondary">
                            {condition.field} {condition.operator} {condition.value}
                          </Badge>
                        ))}
                        {rule.actions.map((action, index) => (
                          <Badge key={index} variant="outline">
                            → {action.type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Link href={`/routing/${rule.id}`}>
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
