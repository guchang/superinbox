import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Inbox, BrainCircuit, GitBranch, Activity } from 'lucide-react'

const stats = [
  {
    title: '总条目',
    value: '1,234',
    description: '本月新增 +128',
    icon: Inbox,
  },
  {
    title: 'AI 处理',
    value: '98.5%',
    description: '分析成功率',
    icon: BrainCircuit,
  },
  {
    title: '路由规则',
    value: '12',
    description: '活跃规则',
    icon: GitBranch,
  },
  {
    title: '系统状态',
    value: '正常',
    description: '所有服务运行正常',
    icon: Activity,
  },
]

const recentItems = [
  { id: '1', content: '明天下午3点和张三开会', intent: 'schedule', time: '2分钟前' },
  { id: '2', content: '买咖啡花了25元', intent: 'expense', time: '15分钟前' },
  { id: '3', content: '突然想到可以做一个自动整理邮件的工具', intent: 'idea', time: '1小时前' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">仪表板</h1>
        <p className="text-muted-foreground">欢迎使用 SuperInbox 智能收件箱</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Items */}
      <Card>
        <CardHeader>
          <CardTitle>最近条目</CardTitle>
          <CardDescription>最新的收件箱条目</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.content}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
                <div className="capitalize text-xs text-muted-foreground">
                  {item.intent}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
