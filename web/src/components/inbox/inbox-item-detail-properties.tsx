"use client"

import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { LinkifiedText } from '@/components/shared/linkified-text'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { Item, ItemStatus } from '@/types'
import { Sparkles, Share2 } from 'lucide-react'

type InboxDetailTranslations = (key: string, values?: Record<string, any>) => string

type EntityEntry = {
  type: string
  label: string
  visibleValues: string[]
  hiddenCount: number
}

type DistributionEntry = {
  key: string
  target: string
  isSuccess: boolean
}

export function InboxItemDetailProperties({
  t,
  time,
  item,
  selectedCategoryLabel,
  showCategoryConfidence,
  clampedAnalysisConfidence,
  hasAnalysisSection,
  hasAnalysisSummary,
  analysisSummary,
  entityEntries,
  distributionEntries,
  contentTypeTags,
  updatedAtLabel,
  statusLabelMap,
  getStatusBadgeVariant,
}: {
  t: InboxDetailTranslations
  time: InboxDetailTranslations
  item: Item
  selectedCategoryLabel: string
  showCategoryConfidence: boolean
  clampedAnalysisConfidence: number
  hasAnalysisSection: boolean
  hasAnalysisSummary: boolean
  analysisSummary: string
  entityEntries: EntityEntry[]
  distributionEntries: DistributionEntry[]
  contentTypeTags: string[]
  updatedAtLabel: string
  statusLabelMap: Record<ItemStatus, string>
  getStatusBadgeVariant: (status: ItemStatus) => 'secondary' | 'outline' | 'default' | 'destructive'
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">{t('metadata.status')}</span>
          <div>
            <Badge variant={getStatusBadgeVariant(item.status)}>{statusLabelMap[item.status]}</Badge>
          </div>
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted-foreground">{t('metadata.category')}</span>
          <div className="grid gap-2">
            <Badge variant="secondary" className="w-fit font-medium">
              {selectedCategoryLabel}
            </Badge>

            {showCategoryConfidence ? (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('analysis.confidence')}</span>
                  <span className="font-medium text-muted-foreground">{clampedAnalysisConfidence.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${clampedAnalysisConfidence}%` }} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {hasAnalysisSection ? (
        <>
          <Separator />
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {t('sections.analysis')}
            </div>

            {hasAnalysisSummary ? (
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">{t('analysis.summary')}</span>
                <p className="rounded-xl border border-border bg-muted p-3 text-xs leading-relaxed text-foreground">
                  <LinkifiedText text={analysisSummary} linkClassName="text-primary hover:opacity-80" />
                </p>
              </div>
            ) : null}

            {entityEntries.length > 0 ? (
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">{t('analysis.entities')}</span>
                <div className="grid gap-2">
                  {entityEntries.map((entry) => (
                    <div key={entry.type} className="rounded-xl border border-border bg-muted/40 p-2.5">
                      <div className="text-[11px] font-medium text-muted-foreground">{entry.label}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {entry.visibleValues.map((value, index) => (
                          <Badge
                            key={`${entry.type}-${index}`}
                            variant="secondary"
                            className="px-2 py-0.5 text-[11px] font-normal"
                          >
                            {value}
                          </Badge>
                        ))}
                        {entry.hiddenCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            +{entry.hiddenCount}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <Separator />

      <div className="grid gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Share2 className="h-3.5 w-3.5" />
          {t('sections.distribution')}
        </div>
        {distributionEntries.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-border bg-muted p-3">
            {distributionEntries.map((entry) => (
              <div key={entry.key} className="flex items-center gap-2.5 text-xs">
                <span
                  className={cn(
                    'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                    entry.isSuccess ? 'bg-emerald-500' : 'bg-rose-500'
                  )}
                />
                <span className="flex-1 truncate text-muted-foreground">{entry.target}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="pl-1 text-xs text-muted-foreground">{t('distribution.empty')}</p>
        )}
      </div>

      <Separator />

      <div className="grid gap-4 text-xs">
        <div className="grid gap-2">
          <span className="text-muted-foreground">{t('metadata.contentType')}</span>
          <div className="flex flex-wrap gap-2">
            {contentTypeTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="px-2 py-0.5 text-[11px]">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="grid gap-1.5 pt-1">
            <span className="text-muted-foreground">{t('metadata.source')}</span>
            <Badge variant="outline" className="w-fit">
              {item.source || '-'}
            </Badge>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{t('metadata.createdAt')}</span>
            <span className="text-right font-medium">
              {formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{t('metadata.updatedAt')}</span>
            <span className="text-right font-medium">{updatedAtLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

