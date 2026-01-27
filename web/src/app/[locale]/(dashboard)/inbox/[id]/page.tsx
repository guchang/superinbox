"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import { CategoryType, ContentType, ItemStatus, Priority } from '@/types'
import { ArrowLeft, RefreshCw, Sparkles, Trash2, Loader2, Share2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { FilePreview } from '@/components/file-preview'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

export default function InboxDetailPage() {
  const t = useTranslations('inboxDetail')
  const common = useTranslations('common')
  const time = useTranslations('time')
  const errors = useTranslations('errors')
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const params = useParams()
  const id = params.id as string

  const { data: itemData, isLoading, refetch } = useQuery({
    queryKey: ['inbox', id],
    queryFn: () => inboxApi.getItem(id),
    enabled: !!id,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const item = itemData?.data
  const categoryLabelMap = useMemo(() => {
    return new Map((categoriesData?.data || []).map((category) => [category.key, category.name]))
  }, [categoriesData])
  const { isPolling } = useAutoRefetch({
    refetch,
    items: item ? [item] : [],
    interval: 3000,
  })

  // 删除 mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await inboxApi.deleteItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      toast({
        title: t('toast.deleteSuccess.title'),
        description: t('toast.deleteSuccess.description'),
      })
      router.push('/inbox')
    },
    onError: (error) => {
      toast({
        title: t('toast.deleteFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  const reclassifyMutation = useMutation({
    mutationFn: async () => {
      await inboxApi.reclassifyItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox', id] })
      toast({
        title: t('toast.reclassifySuccess.title'),
        description: t('toast.reclassifySuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.reclassifyFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  const redistributeMutation = useMutation({
    mutationFn: async () => {
      await inboxApi.distributeItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox', id] })
      toast({
        title: t('toast.redistributeSuccess.title'),
        description: t('toast.redistributeSuccess.description'),
      })
    },
    onError: (error) => {
      toast({
        title: t('toast.redistributeFailure.title'),
        description: getApiErrorMessage(error, errors, common('unknownError')),
        variant: 'destructive',
      })
    },
  })

  const handleDelete = () => {
    if (confirm(t('confirmDelete'))) {
      deleteMutation.mutate()
    }
  }

  const getCategoryBadgeVariant = (category: string) => {
    const variants: Record<string, any> = {
      [CategoryType.TODO]: 'default',
      [CategoryType.IDEA]: 'secondary',
      [CategoryType.EXPENSE]: 'destructive',
      [CategoryType.NOTE]: 'outline',
      [CategoryType.BOOKMARK]: 'outline',
      [CategoryType.SCHEDULE]: 'default',
      [CategoryType.UNKNOWN]: 'secondary',
    }
    return variants[category] || 'outline'
  }

  const getStatusBadgeVariant = (status: ItemStatus) => {
    const variants: Record<ItemStatus, any> = {
      [ItemStatus.PENDING]: 'secondary',
      [ItemStatus.PROCESSING]: 'outline',
      [ItemStatus.COMPLETED]: 'default',
      [ItemStatus.FAILED]: 'destructive',
    }
    return variants[status] || 'outline'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('notFound')}</p>
      </div>
    )
  }

  const entityGroups = (item.analysis?.entities || []).reduce<Record<string, string[]>>(
    (acc, entity) => {
      if (!entity?.type || entity.type === 'customFields') return acc
      const value = entity.value?.trim()
      if (!value) return acc
      if (!acc[entity.type]) acc[entity.type] = []
      acc[entity.type].push(value)
      return acc
    },
    {}
  )
  const entityEntries = Object.entries(entityGroups)
  const categoryKey = item.analysis?.category ?? 'unknown'
  const categoryLabel =
    categoryLabelMap.get(categoryKey) ||
    ({
      [CategoryType.TODO]: t('categories.todo'),
      [CategoryType.IDEA]: t('categories.idea'),
      [CategoryType.EXPENSE]: t('categories.expense'),
      [CategoryType.NOTE]: t('categories.note'),
      [CategoryType.BOOKMARK]: t('categories.bookmark'),
      [CategoryType.SCHEDULE]: t('categories.schedule'),
      [CategoryType.UNKNOWN]: t('categories.unknown'),
    }[categoryKey] || categoryKey)

  const statusLabelMap: Record<ItemStatus, string> = {
    [ItemStatus.PENDING]: t('status.pending'),
    [ItemStatus.PROCESSING]: t('status.processing'),
    [ItemStatus.COMPLETED]: t('status.completed'),
    [ItemStatus.FAILED]: t('status.failed'),
  }

  const priorityLabelMap: Record<Priority, string> = {
    [Priority.LOW]: t('priority.low'),
    [Priority.MEDIUM]: t('priority.medium'),
    [Priority.HIGH]: t('priority.high'),
  }

  const contentTypeLabelMap: Record<ContentType, string> = {
    [ContentType.TEXT]: t('contentType.text'),
    [ContentType.IMAGE]: t('contentType.image'),
    [ContentType.URL]: t('contentType.url'),
    [ContentType.AUDIO]: t('contentType.audio'),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inbox">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle', { id })}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="h-10 w-10"
          >
            <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            onClick={() => reclassifyMutation.mutate()}
            disabled={reclassifyMutation.isPending || item.status === ItemStatus.PROCESSING}
            className="h-10 gap-2 px-4"
          >
            {reclassifyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {t('actions.reclassify')}
          </Button>
          <Button
            variant="outline"
            onClick={() => redistributeMutation.mutate()}
            disabled={redistributeMutation.isPending || item.status === ItemStatus.PROCESSING}
            className="h-10 gap-2 px-4"
          >
            {redistributeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {t('actions.redistribute')}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="h-10 w-10"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Status & Category */}
      <div className="flex items-center gap-2">
        <Badge variant={getCategoryBadgeVariant(categoryKey)}>
          {categoryLabel}
        </Badge>
        <Badge variant={getStatusBadgeVariant(item.status)} className="gap-1">
          {item.status === ItemStatus.PROCESSING && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {statusLabelMap[item.status]}
        </Badge>
        <Badge variant="outline">{item.source}</Badge>
        <Badge variant="outline">{contentTypeLabelMap[item.contentType]}</Badge>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>{t('sections.content')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`whitespace-pre-wrap ${item.contentType === ContentType.URL ? 'break-all' : 'break-words'}`}>
            {item.content}
          </p>
        </CardContent>
      </Card>

      {/* File Preview */}
      {item.hasFile && (
        <Card>
          <CardHeader>
            <CardTitle>{t('sections.attachments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FilePreview
              itemId={item.id}
              fileName={item.fileName}
              mimeType={item.mimeType}
            />
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {item.analysis && (
        <Card>
          <CardHeader>
            <CardTitle>{t('sections.analysis')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('analysis.intent')}</p>
                <p className="font-medium">{categoryLabel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('analysis.confidence')}</p>
                <p className="font-medium">
                  {(item.analysis.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {item.analysis.summary && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('analysis.summary')}</p>
                <p className="text-sm">{item.analysis.summary}</p>
              </div>
            )}

            {entityEntries.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('analysis.entities')}</p>
                <div className="space-y-1">
                  {entityEntries.map(([type, values]) => (
                    <div key={type} className="text-sm">
                      <span className="text-muted-foreground">{type}:</span>{' '}
                      <span className="font-mono">{values.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>{t('sections.metadata')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('metadata.status')}</span>
              <p className="font-medium">{statusLabelMap[item.status]}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('metadata.priority')}</span>
              <p className="font-medium">{priorityLabelMap[item.priority]}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('metadata.source')}</span>
              <p className="font-medium">{item.source}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('metadata.contentType')}</span>
              <p className="font-medium">{contentTypeLabelMap[item.contentType]}</p>
            </div>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">{t('metadata.createdAt')}</span>
            <p className="font-medium">{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</p>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">{t('metadata.updatedAt')}</span>
            <p className="font-medium">{formatRelativeTime(item.updatedAtLocal ?? item.updatedAt, time)}</p>
          </div>
          {item.processedAt && (
            <div className="text-sm">
              <span className="text-muted-foreground">{t('metadata.processedAt')}</span>
              <p className="font-medium">{formatRelativeTime(item.processedAt, time)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution Results */}
      {item.distributionResults && Object.keys(item.distributionResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('sections.distribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(item.distributionResults).map(([target, result]) => (
                <div key={target} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{target}</span>
                  <Badge
                    variant={result?.success ? 'default' : 'destructive'}
                  >
                    {result?.success ? t('distribution.success') : t('distribution.failure')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
