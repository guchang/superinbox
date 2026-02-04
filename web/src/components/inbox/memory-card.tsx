'use client'

import { useTranslations } from 'next-intl'
import { memo } from 'react'
import { Item, ItemStatus, ContentType } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FilePreview } from '@/components/file-preview'
import { RoutingStatus } from '@/components/inbox/routing-status'
import { Link } from '@/i18n/navigation'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  Eye,
  Trash2,
  Loader2,
  Clock,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'

// 获取意图配置（颜色等）
const getIntentConfig = (category: string) => {
  const map: Record<string, { color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
    todo: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: CheckCircle2 },
    idea: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: CheckCircle2 },
    expense: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', icon: CheckCircle2 },
    note: { color: 'text-slate-500', bgColor: 'bg-slate-500/10', icon: CheckCircle2 },
    bookmark: { color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', icon: CheckCircle2 },
    schedule: { color: 'text-purple-500', bgColor: 'bg-purple-500/10', icon: CheckCircle2 },
  }
  return map[category] || { color: 'text-slate-500', bgColor: 'bg-slate-500/10', icon: CheckCircle2 }
}

interface MemoryCardProps {
  item: Item
  categoryLabelMap: Map<string, string>
  onDelete: (id: string) => void
  onRetry: (id: string) => void
  deletingId: string | null
  retryingId: string | null
}

function MemoryCardComponent({
  item,
  categoryLabelMap,
  onDelete,
  onRetry,
  deletingId,
  retryingId,
}: MemoryCardProps) {
  const t = useTranslations('inbox')
  const common = useTranslations('common')
  const time = useTranslations('time')

  const config = getIntentConfig(item.analysis?.category ?? 'unknown')
  const isAnalyzing = item.status === ItemStatus.PROCESSING
  const isFailed = item.status === ItemStatus.FAILED

  const getBadgeContent = () => {
    if (isAnalyzing) return { label: t('badge.analyzing'), variant: 'outline' as const }
    if (isFailed) return { label: t('badge.failed'), variant: 'destructive' as const }
    return {
      label: categoryLabelMap.get(item.analysis?.category ?? '') || (item.analysis?.category?.toUpperCase() ?? 'UNKNOWN'),
      variant: 'default' as const
    }
  }

  const badge = getBadgeContent()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group border rounded-[24px] p-5 relative transition-all break-inside-avoid mb-4 overflow-hidden min-h-[180px]",
        "bg-card hover:shadow-lg hover:border-white/10",
        "border-white/[0.06] dark:border-white/[0.06]",
        isAnalyzing && "animate-pulse bg-accent/30"
      )}
    >
      {/* 背景装饰 - 固定位置避免随机值导致重渲染 */}
      {isAnalyzing && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {[
            { x: [20, 180], y: [10, 80], delay: 0 },
            { x: [50, 150], y: [30, 60], delay: 0.2 },
            { x: [100, 120], y: [20, 90], delay: 0.4 },
            { x: [150, 40], y: [50, 40], delay: 0.6 },
            { x: [80, 160], y: [70, 30], delay: 0.8 },
            { x: [180, 30], y: [40, 70], delay: 1.0 },
          ].map((anim, i) => (
            <motion.div
              key={i}
              animate={{
                x: anim.x,
                y: anim.y,
                opacity: [0, 0.3, 0]
              }}
              transition={{ duration: 2, repeat: Infinity, delay: anim.delay }}
              className={cn("absolute w-1 h-1 rounded-full blur-[1px]", config.bgColor.replace('/10', ''))}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 flex flex-col">
        {/* 顶部：标签和时间 */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Badge
              variant={badge.variant}
              className={cn(
                "h-5 text-[10px] font-black uppercase tracking-widest gap-1",
                !isAnalyzing && !isFailed && config.color,
                !isAnalyzing && !isFailed && config.bgColor
              )}
            >
              {isAnalyzing && <Loader2 className="h-3 w-3 animate-spin" />}
              {badge.label}
            </Badge>

            {isFailed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onRetry(item.id)
                }}
                disabled={retryingId === item.id}
                className="h-5 px-2 text-xs"
              >
                {retryingId === item.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] font-bold opacity-30 uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            <span>{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)} · {item.source?.toUpperCase()}</span>
          </div>
        </div>

        {/* 内容 */}
        <div className="mb-4">
          <p className={cn(
            "text-base leading-relaxed font-medium transition-colors",
            isAnalyzing ? 'text-muted-foreground italic' : 'text-foreground',
            item.contentType === ContentType.URL ? 'break-all' : 'break-words',
            "line-clamp-3"
          )}>
            {item.content}
          </p>

          {/* 文件预览 */}
          {item.hasFile && (
            <div className="mt-4">
              <FilePreview
                itemId={item.id}
                fileName={item.fileName}
                mimeType={item.mimeType}
                allFiles={item.allFiles}
              />
            </div>
          )}

          {/* 匹配的路由规则 */}
          {item.distributedRuleNames && item.distributedRuleNames.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium">Rules: </span>
              <span>{item.distributedRuleNames.join(', ')}</span>
            </div>
          )}
        </div>

        {/* 底部：路由状态和操作 */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <div className="flex-1 min-w-0">
            <RoutingStatus
              itemId={item.id}
              initialDistributedTargets={item.distributedTargets}
              initialRuleNames={item.distributedRuleNames}
              routingStatus={item.routingStatus}
              disabled={false}
              showAnimation={true}
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Link href={`/inbox/${item.id}`}>
              <Button
                variant="ghost"
                size="icon"
                disabled={isAnalyzing}
                className="h-8 w-8"
                aria-label={t('actions.viewDetails')}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDelete(item.id)
              }}
              disabled={deletingId === item.id}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label={common('delete')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// 使用 React.memo 避免不必要的重渲染
export const MemoryCard = memo(MemoryCardComponent)
