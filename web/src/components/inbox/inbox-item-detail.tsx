/* eslint-disable max-lines */
"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, useEffect, useCallback, useRef, type FocusEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { useTheme } from 'next-themes'
import { useSearchParams } from 'next/navigation'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { formatRelativeTime, cn } from '@/lib/utils'
import { normalizeMarkdownContent } from '@/lib/utils/markdown'
import { getCategoryBadgeStyle, getCategoryIconComponent } from '@/lib/category-appearance'
import { ContentType, ItemStatus } from '@/types'
import {
  Sparkles,
  Trash2,
  Loader2,
  Share2,
  AlertCircle,
  Paperclip,
  Settings2,
  MoreHorizontal,
  PencilLine,
  Eye,
  ChevronDown,
  Check,
  ArrowLeft,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { FilePreview } from '@/components/file-preview'
import { useAutoRefetch } from '@/hooks/use-auto-refetch'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DetailMarkdownEditor } from '@/components/inbox/detail-markdown-editor'
import { MarkdownContent } from '@/components/shared/markdown-content'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { InboxItemDetailProperties } from '@/components/inbox/inbox-item-detail-properties'
import { RoutingStatus } from '@/components/inbox/routing-status'

// normalizeDraftContent 已被提取到 @/lib/utils/markdown.ts 的 normalizeMarkdownContent
// 这里保留为别名以保持向后兼容
const normalizeDraftContent = normalizeMarkdownContent

type AutoSaveIndicatorState = 'hidden' | 'saving' | 'closed'
type AutoSaveSnapshot = { content: string; category: string }
type FlushAutoSaveOptions = { forceVisual?: boolean }
type SaveIndicatorMode = 'auto' | 'manual'

function isSameSnapshot(left: AutoSaveSnapshot, right: AutoSaveSnapshot) {
  return left.content === right.content && left.category === right.category
}

const AUTO_SAVE_DEBOUNCE_MS = 2500
const AUTO_SAVE_MAX_WAIT_MS = 20000
const AUTO_SAVE_VISUAL_DELAY_MS = 700
const AUTO_SAVE_MIN_OPEN_MS = 400
const AUTO_SAVE_SUCCESS_HOLD_MS = 2000
const MANUAL_SAVE_MIN_OPEN_MS = 1500
const MANUAL_SAVE_SUCCESS_HOLD_MS = 3000
const MAX_VISIBLE_ENTITY_VALUES = 6

function formatEntityTypeLabel(type: string) {
  const normalized = type.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) return type
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

function AutoSaveProgress({ state }: { state: Exclude<AutoSaveIndicatorState, 'hidden'> }) {
  const radius = 6
  const circumference = 2 * Math.PI * radius

  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('h-3.5 w-3.5', state === 'saving' && 'animate-spin')}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r={radius} strokeWidth="2" className="fill-none stroke-border" />
      <circle
        cx="8"
        cy="8"
        r={radius}
        strokeWidth="2"
        strokeLinecap="round"
        className="fill-none stroke-primary transition-all duration-300 ease-out"
        strokeDasharray={state === 'saving' ? `${circumference * 0.55} ${circumference}` : `${circumference} ${circumference}`}
        strokeDashoffset={state === 'saving' ? circumference * 0.12 : 0}
      />
    </svg>
  )
}

export type InboxItemDetailVariant = 'page' | 'drawer'

export function InboxItemDetail({
  id,
  variant,
}: {
  id: string
  variant: InboxItemDetailVariant
}) {
  const t = useTranslations('inboxDetail')
  const common = useTranslations('common')
  const time = useTranslations('time')
  const errors = useTranslations('errors')
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isDrawerVariant = variant === 'drawer'
  const searchParams = useSearchParams()
  const listHref = useMemo(() => {
    const qs = searchParams.toString()
    return qs ? `/inbox?${qs}` : '/inbox'
  }, [searchParams])

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
  const [draftContent, setDraftContent] = useState('')
  const [draftCategory, setDraftCategory] = useState('unknown')
  const [savedSnapshot, setSavedSnapshot] = useState<AutoSaveSnapshot | null>(null)
  const [autoSaveIndicatorState, setAutoSaveIndicatorState] = useState<AutoSaveIndicatorState>('hidden')
  const [saveIndicatorMode, setSaveIndicatorMode] = useState<SaveIndicatorMode>('auto')
  const [viewMode, setViewMode] = useState<'edit' | 'readOnly'>('edit')
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false)
  const [isDrawerPropertiesOpen, setIsDrawerPropertiesOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const pendingSnapshotRef = useRef<AutoSaveSnapshot | null>(null)
  const debounceTimerRef = useRef<number | null>(null)
  const maxWaitTimerRef = useRef<number | null>(null)
  const showSavingTimerRef = useRef<number | null>(null)
  const isPersistingRef = useRef(false)
  const needsFlushAfterPersistRef = useRef(false)
  const savingStartedAtRef = useRef<number | null>(null)
  const savingVisibleAtRef = useRef<number | null>(null)
  const autoSaveCloseTimerRef = useRef<number | null>(null)
  const autoSaveHideTimerRef = useRef<number | null>(null)
  const forceVisualOnNextFlushRef = useRef(false)
  const saveIndicatorModeRef = useRef<SaveIndicatorMode>('auto')
  const activePersistModeRef = useRef<SaveIndicatorMode>('auto')
  const manualUpgradeRequestedRef = useRef(false)
  const initializedItemIdRef = useRef<string | null>(null)
  const flushAutoSaveRef = useRef<(options?: FlushAutoSaveOptions) => Promise<void>>(async () => {})
  const currentItemId = item?.id ?? null
  const currentItemContent = item?.content ?? ''
  const currentItemCategory = item?.analysis?.category ?? 'unknown'

  const categoryOptions = useMemo(() => {
    const fallback = [
      { key: 'todo', name: t('categories.todo'), color: undefined as string | undefined, icon: undefined as string | undefined },
      { key: 'idea', name: t('categories.idea'), color: undefined as string | undefined, icon: undefined as string | undefined },
      { key: 'expense', name: t('categories.expense'), color: undefined as string | undefined, icon: undefined as string | undefined },
      { key: 'note', name: t('categories.note'), color: undefined as string | undefined, icon: undefined as string | undefined },
      { key: 'bookmark', name: t('categories.bookmark'), color: undefined as string | undefined, icon: undefined as string | undefined },
      { key: 'schedule', name: t('categories.schedule'), color: undefined as string | undefined, icon: undefined as string | undefined },
      { key: 'unknown', name: t('categories.unknown'), color: undefined as string | undefined, icon: undefined as string | undefined },
    ]

    const activeCategories = (categoriesData?.data || []).filter((category) => category.isActive !== false)
    const baseOptions =
      activeCategories.length > 0
        ? activeCategories.map((category) => ({
            key: category.key,
            name: category.name,
            color: category.color,
            icon: category.icon,
          }))
        : fallback

    const optionMap = new Map<string, { name: string; color?: string; icon?: string }>()
    baseOptions.forEach((option) => {
      const key = String(option.key ?? '').trim()
      const name = String(option.name ?? '').trim()
      if (!key) return
      optionMap.set(key, {
        name: name || key,
        color: option.color,
        icon: option.icon,
      })
    })

    if (!optionMap.has('unknown')) {
      optionMap.set('unknown', {
        name: t('categories.unknown'),
      })
    }

    return Array.from(optionMap.entries()).map(([key, value]) => ({
      key,
      name: value.name,
      color: value.color,
      icon: value.icon,
    }))
  }, [categoriesData, t])

  useEffect(() => {
    if (!currentItemId) {
      initializedItemIdRef.current = null
      return
    }
    if (initializedItemIdRef.current === currentItemId) return
    initializedItemIdRef.current = currentItemId

    const snapshot = {
      content: normalizeDraftContent(currentItemContent),
      category: currentItemCategory,
    }
    setDraftContent(snapshot.content)
    setDraftCategory(snapshot.category)
    setSavedSnapshot(snapshot)
    pendingSnapshotRef.current = null
    needsFlushAfterPersistRef.current = false
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (maxWaitTimerRef.current != null) {
      window.clearTimeout(maxWaitTimerRef.current)
      maxWaitTimerRef.current = null
    }
    if (showSavingTimerRef.current != null) {
      window.clearTimeout(showSavingTimerRef.current)
      showSavingTimerRef.current = null
    }
    if (autoSaveCloseTimerRef.current != null) {
      window.clearTimeout(autoSaveCloseTimerRef.current)
      autoSaveCloseTimerRef.current = null
    }
    if (autoSaveHideTimerRef.current != null) {
      window.clearTimeout(autoSaveHideTimerRef.current)
      autoSaveHideTimerRef.current = null
    }
    savingStartedAtRef.current = null
    savingVisibleAtRef.current = null
    saveIndicatorModeRef.current = 'auto'
    activePersistModeRef.current = 'auto'
    manualUpgradeRequestedRef.current = false
    setSaveIndicatorMode('auto')
    setAutoSaveIndicatorState('hidden')
    setViewMode('edit')
  }, [currentItemId, currentItemContent, currentItemCategory])

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
      router.push(listHref)
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
      // 如果路由正在处理中，先取消再重新分发
      if (item?.routingStatus === 'processing') {
        const cancelResult = await inboxApi.cancelRouting(id)
        if (!cancelResult.success) {
          throw new Error(cancelResult.error || '取消路由失败')
        }
        // 手动更新本地缓存，确保 distributeItem 看到的是最新状态
        queryClient.setQueryData(['inbox', id], (oldData: any) => {
          if (!oldData?.data) return oldData
          return {
            ...oldData,
            data: {
              ...oldData.data,
              routingStatus: 'skipped',
            },
          }
        })
        // 小延迟确保后端状态已更新
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      const result = await inboxApi.distributeItem(id)
      if (!result.success) {
        throw new Error(result.error || '重新分发失败')
      }
      // 乐观更新：立即将状态设为 processing，让 UI 显示处理中
      queryClient.setQueryData(['inbox', id], (oldData: any) => {
        if (!oldData?.data) return oldData
        return {
          ...oldData,
          data: {
            ...oldData.data,
            routingStatus: 'processing',
          },
        }
      })
      return result
    },
    onSuccess: () => {
      // 立即将状态设为 completed，让按钮重新启用
      queryClient.setQueryData(['inbox', id], (oldData: any) => {
        if (!oldData?.data) return oldData
        return {
          ...oldData,
          data: {
            ...oldData.data,
            routingStatus: 'completed',
          },
        }
      })
      // 触发后台刷新获取完整数据
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

  const updateMutation = useMutation({
    mutationFn: async ({ content, category }: { content?: string; category?: string }) => {
      const response = await inboxApi.updateItem(id, { content, category })
      if (!response.success || !response.data) {
        throw new Error(response.error || response.message || 'Failed to update item')
      }
      return response.data
    },
    onSuccess: (updatedItem) => {
      const normalizedUpdatedItem = {
        ...updatedItem,
        content: normalizeDraftContent(updatedItem.content ?? ''),
        analysis: updatedItem.analysis
          ? {
              ...updatedItem.analysis,
            }
          : updatedItem.analysis,
      }

      queryClient.setQueryData(['inbox', id], (previous: any) => {
        if (!previous || typeof previous !== 'object') return previous

        return {
          ...previous,
          data: {
            ...previous.data,
            ...normalizedUpdatedItem,
            content: normalizeDraftContent(normalizedUpdatedItem.content ?? previous.data?.content ?? ''),
            analysis: {
              ...previous.data?.analysis,
              ...normalizedUpdatedItem.analysis,
            },
          },
        }
      })

      // 详情页保存后，列表页（useInfiniteQuery / useQuery）可能仍然显示旧缓存。
      // 这里直接把所有以 ['inbox', <paramsObject>] 为 key 的列表缓存里对应 item 同步更新，
      // 这样用户返回 Inbox 页面时可以立即看到最新内容，而不必等待 refetch。
      queryClient.setQueriesData(
        {
          predicate: (query) => {
            const key = query.queryKey
            return (
              Array.isArray(key) &&
              key[0] === 'inbox' &&
              typeof key[1] === 'object' &&
              key[1] != null
            )
          },
        },
        (previous: any) => {
          if (!previous || typeof previous !== 'object') return previous

          const mergeItem = (entry: any) => {
            if (!entry || typeof entry !== 'object') return entry
            if (entry.id !== normalizedUpdatedItem.id) return entry

            return {
              ...entry,
              ...normalizedUpdatedItem,
              content: normalizeDraftContent(normalizedUpdatedItem.content ?? entry.content ?? ''),
              analysis: {
                ...entry.analysis,
                ...normalizedUpdatedItem.analysis,
              },
            }
          }

          // Infinite query shape: { pages: ApiResponse[], pageParams: [] }
          if (Array.isArray(previous.pages)) {
            let changed = false
            const nextPages = previous.pages.map((page: any) => {
              const items = page?.data?.items
              if (!Array.isArray(items)) return page

              let pageChanged = false
              const nextItems = items.map((entry: any) => {
                const merged = mergeItem(entry)
                if (merged !== entry) {
                  changed = true
                  pageChanged = true
                }
                return merged
              })

              if (!pageChanged) return page
              return {
                ...page,
                data: {
                  ...page.data,
                  items: nextItems,
                },
              }
            })

            return changed
              ? {
                  ...previous,
                  pages: nextPages,
                }
              : previous
          }

          // Normal query shape: ApiResponse<{ items: Item[] }>
          if (Array.isArray(previous.data?.items)) {
            let changed = false
            const nextItems = previous.data.items.map((entry: any) => {
              const merged = mergeItem(entry)
              if (merged !== entry) changed = true
              return merged
            })
            if (!changed) return previous

            return {
              ...previous,
              data: {
                ...previous.data,
                items: nextItems,
              },
            }
          }

          return previous
        }
      )
    },
  })

  const canEditItem = item != null && item.status !== ItemStatus.PROCESSING
  const isReadOnlyMode = viewMode === 'readOnly' || !canEditItem

  const handleDraftContentChange = useCallback((nextValue: string) => {
    setDraftContent(normalizeDraftContent(nextValue))
  }, [])

  const hasUnsavedChanges =
    savedSnapshot != null &&
    (normalizeDraftContent(draftContent) !== savedSnapshot.content || draftCategory !== savedSnapshot.category)

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current == null) return
    window.clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = null
  }, [])

  const clearMaxWaitTimer = useCallback(() => {
    if (maxWaitTimerRef.current == null) return
    window.clearTimeout(maxWaitTimerRef.current)
    maxWaitTimerRef.current = null
  }, [])

  const clearShowSavingTimer = useCallback(() => {
    if (showSavingTimerRef.current == null) return
    window.clearTimeout(showSavingTimerRef.current)
    showSavingTimerRef.current = null
  }, [])

  const clearAutoSaveCloseTimer = useCallback(() => {
    if (autoSaveCloseTimerRef.current == null) return
    window.clearTimeout(autoSaveCloseTimerRef.current)
    autoSaveCloseTimerRef.current = null
  }, [])

  const clearAutoSaveHideTimer = useCallback(() => {
    if (autoSaveHideTimerRef.current == null) return
    window.clearTimeout(autoSaveHideTimerRef.current)
    autoSaveHideTimerRef.current = null
  }, [])

  const clearAutoSaveIndicatorTimers = useCallback(() => {
    clearShowSavingTimer()
    clearAutoSaveCloseTimer()
    clearAutoSaveHideTimer()
  }, [clearShowSavingTimer, clearAutoSaveCloseTimer, clearAutoSaveHideTimer])

  const hideAutoSaveIndicator = useCallback(() => {
    clearAutoSaveIndicatorTimers()
    savingStartedAtRef.current = null
    savingVisibleAtRef.current = null
    saveIndicatorModeRef.current = 'auto'
    activePersistModeRef.current = 'auto'
    manualUpgradeRequestedRef.current = false
    setSaveIndicatorMode('auto')
    setAutoSaveIndicatorState('hidden')
  }, [clearAutoSaveIndicatorTimers])

  const beginAutoSaveIndicator = useCallback((forceVisual = false) => {
    clearAutoSaveIndicatorTimers()
    savingStartedAtRef.current = performance.now()
    savingVisibleAtRef.current = null
    const mode: SaveIndicatorMode = forceVisual ? 'manual' : 'auto'
    saveIndicatorModeRef.current = mode
    activePersistModeRef.current = mode
    manualUpgradeRequestedRef.current = false
    setSaveIndicatorMode(mode)

    if (forceVisual) {
      setAutoSaveIndicatorState('saving')
      savingVisibleAtRef.current = performance.now()
      return
    }

    setAutoSaveIndicatorState('hidden')

    showSavingTimerRef.current = window.setTimeout(() => {
      savingVisibleAtRef.current = performance.now()
      setAutoSaveIndicatorState('saving')
    }, AUTO_SAVE_VISUAL_DELAY_MS)
  }, [clearAutoSaveIndicatorTimers])

  const promoteInFlightToManual = useCallback(() => {
    if (!isPersistingRef.current) return

    manualUpgradeRequestedRef.current = true
    activePersistModeRef.current = 'manual'
    saveIndicatorModeRef.current = 'manual'
    setSaveIndicatorMode('manual')

    clearShowSavingTimer()
    clearAutoSaveCloseTimer()
    clearAutoSaveHideTimer()

    setAutoSaveIndicatorState((current) => {
      if (current !== 'hidden') return current
      const now = performance.now()
      savingVisibleAtRef.current = now
      savingStartedAtRef.current = savingStartedAtRef.current ?? now
      return 'saving'
    })
  }, [clearAutoSaveCloseTimer, clearAutoSaveHideTimer, clearShowSavingTimer])

  const completeAutoSaveIndicator = useCallback(() => {
    clearShowSavingTimer()
    const sessionMode: SaveIndicatorMode =
      manualUpgradeRequestedRef.current || activePersistModeRef.current === 'manual'
        ? 'manual'
        : 'auto'
    manualUpgradeRequestedRef.current = false
    activePersistModeRef.current = sessionMode
    saveIndicatorModeRef.current = sessionMode
    setSaveIndicatorMode(sessionMode)

    const startedAt = savingStartedAtRef.current ?? performance.now()
    const requestElapsed = Math.max(0, performance.now() - startedAt)

    if (savingVisibleAtRef.current == null) {
      if (sessionMode === 'auto' && requestElapsed < AUTO_SAVE_VISUAL_DELAY_MS) {
        hideAutoSaveIndicator()
        return
      }

      savingVisibleAtRef.current = performance.now()
      setAutoSaveIndicatorState('saving')
    }

    const visibleAt = savingVisibleAtRef.current ?? performance.now()
    const elapsedOpen = Math.max(0, performance.now() - visibleAt)
    const minOpenMs = sessionMode === 'manual' ? MANUAL_SAVE_MIN_OPEN_MS : AUTO_SAVE_MIN_OPEN_MS
    const successHoldMs = sessionMode === 'manual' ? MANUAL_SAVE_SUCCESS_HOLD_MS : AUTO_SAVE_SUCCESS_HOLD_MS
    const delayToClose = Math.max(0, minOpenMs - elapsedOpen)

    clearAutoSaveCloseTimer()
    clearAutoSaveHideTimer()

    autoSaveCloseTimerRef.current = window.setTimeout(() => {
      setAutoSaveIndicatorState('closed')
      autoSaveHideTimerRef.current = window.setTimeout(() => {
        hideAutoSaveIndicator()
      }, successHoldMs)
    }, delayToClose)
  }, [clearAutoSaveCloseTimer, clearAutoSaveHideTimer, clearShowSavingTimer, hideAutoSaveIndicator])

  const resetAutoSaveRuntime = useCallback(() => {
    clearDebounceTimer()
    clearMaxWaitTimer()
    pendingSnapshotRef.current = null
    needsFlushAfterPersistRef.current = false
    forceVisualOnNextFlushRef.current = false
    activePersistModeRef.current = 'auto'
    manualUpgradeRequestedRef.current = false
    hideAutoSaveIndicator()
  }, [clearDebounceTimer, clearMaxWaitTimer, hideAutoSaveIndicator])

  const persistSnapshot = useCallback(
    async (snapshot: AutoSaveSnapshot, options?: FlushAutoSaveOptions): Promise<AutoSaveSnapshot | null> => {
      if (!canEditItem || savedSnapshot == null) return null

      // 只提交发生变化的字段：
      // - 避免在“仅附件”的条目中，content 为空时还被强行提交（后端更新接口对空字符串校验更严格）
      // - 也避免无意义的写入，降低自动保存噪音
      const updatePayload: { content?: string; category?: string } = {}
      if (snapshot.content !== savedSnapshot.content) updatePayload.content = snapshot.content
      if (snapshot.category !== savedSnapshot.category) updatePayload.category = snapshot.category

      if (updatePayload.content === undefined && updatePayload.category === undefined) {
        // 可能是并发情况下 savedSnapshot 已经被其他保存同步了
        setSavedSnapshot(snapshot)
        return snapshot
      }

      beginAutoSaveIndicator(Boolean(options?.forceVisual))

      try {
        const updatedItem = await updateMutation.mutateAsync(updatePayload)
        const syncedSnapshot = {
          content: normalizeDraftContent(updatedItem.content ?? snapshot.content),
          category: updatedItem.analysis?.category ?? snapshot.category,
        }

        setSavedSnapshot(syncedSnapshot)
        completeAutoSaveIndicator()
        return syncedSnapshot
      } catch (error) {
        hideAutoSaveIndicator()
        toast({
          title: t('toast.updateFailure.title'),
          description: getApiErrorMessage(error, errors, common('unknownError')),
          variant: 'destructive',
        })
        return null
      }
    },
    [
      canEditItem,
      savedSnapshot,
      beginAutoSaveIndicator,
      updateMutation,
      completeAutoSaveIndicator,
      hideAutoSaveIndicator,
      toast,
      t,
      errors,
      common,
    ]
  )

  const scheduleAutoSaveTimers = useCallback(() => {
    if (!canEditItem || isReadOnlyMode || pendingSnapshotRef.current == null) return

    clearDebounceTimer()
    debounceTimerRef.current = window.setTimeout(() => {
      void flushAutoSaveRef.current()
    }, AUTO_SAVE_DEBOUNCE_MS)

    if (maxWaitTimerRef.current == null) {
      maxWaitTimerRef.current = window.setTimeout(() => {
        void flushAutoSaveRef.current()
      }, AUTO_SAVE_MAX_WAIT_MS)
    }
  }, [canEditItem, isReadOnlyMode, clearDebounceTimer])

  const flushAutoSave = useCallback(async (options?: FlushAutoSaveOptions) => {
    if (!canEditItem || savedSnapshot == null) return

    if (options?.forceVisual && isPersistingRef.current) {
      promoteInFlightToManual()
    }

    let snapshot = pendingSnapshotRef.current
    if (!snapshot && hasUnsavedChanges) {
      snapshot = {
        content: normalizeDraftContent(draftContent),
        category: draftCategory,
      }
      pendingSnapshotRef.current = snapshot
    }
    if (!snapshot) return

    if (isSameSnapshot(snapshot, savedSnapshot)) {
      pendingSnapshotRef.current = null
      clearDebounceTimer()
      clearMaxWaitTimer()
      return
    }

    if (isPersistingRef.current) {
      needsFlushAfterPersistRef.current = true
      if (options?.forceVisual) {
        forceVisualOnNextFlushRef.current = true
        promoteInFlightToManual()
      }
      return
    }

    clearDebounceTimer()
    clearMaxWaitTimer()
    isPersistingRef.current = true

    try {
      const shouldForceVisual = Boolean(options?.forceVisual || forceVisualOnNextFlushRef.current)
      forceVisualOnNextFlushRef.current = false

      const syncedSnapshot = await persistSnapshot(snapshot, { forceVisual: shouldForceVisual })
      if (!syncedSnapshot) return

      if (pendingSnapshotRef.current && isSameSnapshot(pendingSnapshotRef.current, snapshot)) {
        pendingSnapshotRef.current = null
      }

      const latestPending = pendingSnapshotRef.current
      if (latestPending && !isSameSnapshot(latestPending, syncedSnapshot)) {
        scheduleAutoSaveTimers()
      }
    } finally {
      isPersistingRef.current = false
      if (needsFlushAfterPersistRef.current) {
        needsFlushAfterPersistRef.current = false
        const forceVisual = forceVisualOnNextFlushRef.current
        forceVisualOnNextFlushRef.current = false
        void flushAutoSaveRef.current({ forceVisual })
      }
    }
  }, [
    canEditItem,
    savedSnapshot,
    hasUnsavedChanges,
    draftContent,
    draftCategory,
    clearDebounceTimer,
    clearMaxWaitTimer,
    persistSnapshot,
    scheduleAutoSaveTimers,
    promoteInFlightToManual,
  ])

  useEffect(() => {
    flushAutoSaveRef.current = flushAutoSave
  }, [flushAutoSave])

  useEffect(() => {
    if (!canEditItem || savedSnapshot == null) {
      resetAutoSaveRuntime()
      return
    }

    if (isReadOnlyMode) {
      void flushAutoSaveRef.current()
      clearDebounceTimer()
      clearMaxWaitTimer()
      hideAutoSaveIndicator()
      return
    }

    if (!hasUnsavedChanges) {
      pendingSnapshotRef.current = null
      clearDebounceTimer()
      clearMaxWaitTimer()
      return
    }

    pendingSnapshotRef.current = {
      content: normalizeDraftContent(draftContent),
      category: draftCategory,
    }
    scheduleAutoSaveTimers()
  }, [
    canEditItem,
    isReadOnlyMode,
    savedSnapshot,
    hasUnsavedChanges,
    draftContent,
    draftCategory,
    scheduleAutoSaveTimers,
    resetAutoSaveRuntime,
    clearDebounceTimer,
    clearMaxWaitTimer,
    hideAutoSaveIndicator,
  ])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      void flushAutoSaveRef.current()
    }

    const handleBeforeUnload = () => {
      void flushAutoSaveRef.current()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  useEffect(() => {
    return () => {
      void flushAutoSaveRef.current()
      clearDebounceTimer()
      clearMaxWaitTimer()
      clearAutoSaveIndicatorTimers()
      forceVisualOnNextFlushRef.current = false
      activePersistModeRef.current = 'auto'
      manualUpgradeRequestedRef.current = false
    }
  }, [clearDebounceTimer, clearMaxWaitTimer, clearAutoSaveIndicatorTimers])

  const handleEditorBlurCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    void flushAutoSaveRef.current()
  }, [])

  useEffect(() => {
    const handleManualSave = (event: KeyboardEvent) => {
      const lowerKey = event.key.toLowerCase()
      const isSaveShortcut = (event.metaKey || event.ctrlKey) && lowerKey === 's'
      if (!isSaveShortcut) return

      event.preventDefault()
      if (isReadOnlyMode || !canEditItem) return
      void flushAutoSaveRef.current({ forceVisual: true })
    }

    document.addEventListener('keydown', handleManualSave, true)
    return () => document.removeEventListener('keydown', handleManualSave, true)
  }, [isReadOnlyMode, canEditItem])

  const autoSaveLabel = (() => {
    if (saveIndicatorMode === 'manual') {
      if (autoSaveIndicatorState === 'saving') return t('edit.autoSave.saving')
      if (autoSaveIndicatorState === 'closed') return t('edit.autoSave.saved')
    }
    return t('edit.autoSave.indicator')
  })()

  const { isPolling } = useAutoRefetch({
    refetch,
    items: item ? [item] : [],
    interval: 3000,
    enabled: !!item && (item.status === ItemStatus.PROCESSING || reclassifyMutation.isPending || redistributeMutation.isPending),
  })

  const contentTypeTags = useMemo(() => {
    if (!item) return []
    const tags = new Set<string>()
    const content = item.content?.trim() ?? ''

    if (item.contentType === ContentType.URL) {
      tags.add(t('contentType.url'))
    } else if (content) {
      tags.add(t('contentType.text'))
    }

    const fileSources = item.allFiles && item.allFiles.length > 0 ? item.allFiles : item.mimeType ? [{ mimeType: item.mimeType }] : []

    for (const file of fileSources) {
      const mimeType = file?.mimeType?.toLowerCase() ?? ''
      if (mimeType.startsWith('image/')) {
        tags.add(t('contentType.image'))
      } else if (mimeType.startsWith('audio/')) {
        tags.add(t('contentType.audio'))
      } else {
        tags.add(t('contentType.file'))
      }
    }

    if (tags.size === 0) {
      if (item.contentType === ContentType.IMAGE) {
        tags.add(t('contentType.image'))
      } else if (item.contentType === ContentType.AUDIO) {
        tags.add(t('contentType.audio'))
      } else if (item.contentType === ContentType.FILE) {
        tags.add(t('contentType.file'))
      } else if (item.contentType === ContentType.TEXT) {
        tags.add(t('contentType.text'))
      }
    }

    return Array.from(tags)
  }, [item, t])

  const getStatusBadgeVariant = (status: ItemStatus) => {
    const variants: Record<ItemStatus, 'secondary' | 'outline' | 'default' | 'destructive'> = {
      [ItemStatus.PENDING]: 'secondary',
      [ItemStatus.PROCESSING]: 'outline',
      [ItemStatus.COMPLETED]: 'default',
      [ItemStatus.MANUAL]: 'outline',
      [ItemStatus.FAILED]: 'destructive',
    }
    return variants[status] || 'outline'
  }

  const statusLabelMap: Record<ItemStatus, string> = {
    [ItemStatus.PENDING]: t('status.pending'),
    [ItemStatus.PROCESSING]: t('status.processing'),
    [ItemStatus.COMPLETED]: t('status.completed'),
    [ItemStatus.MANUAL]: t('status.manual'),
    [ItemStatus.FAILED]: t('status.failed'),
  }

  // 简化后的路由活动banner控制逻辑
  const shouldShowRoutingBanner = item && (
    item.routingStatus === 'processing' ||
    redistributeMutation.isPending ||
    isPolling
  )

  if (isLoading) {
    return (
      <div
        className={cn(
          isDrawerVariant ? 'h-full flex items-center justify-center p-6' : 'w-full px-4 py-24 md:px-6'
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl border border-border bg-card shadow-sm dark:bg-background/70',
            isDrawerVariant ? 'w-full max-w-md p-8' : 'p-10'
          )}
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div
        className={cn(
          isDrawerVariant ? 'h-full flex items-center justify-center p-6' : 'w-full px-4 py-24 md:px-6'
        )}
      >
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card shadow-sm dark:bg-background/70',
            isDrawerVariant ? 'w-full max-w-md p-8' : 'p-10'
          )}
        >
          <div className="rounded-full bg-muted p-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">{t('notFound')}</p>
          <Link href={listHref}>
            <Button variant="outline">{t('backToInbox')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  const entityGroups = (item.analysis?.entities || []).reduce<Record<string, string[]>>((acc, entity) => {
    if (!entity?.type || entity.type === 'customFields') return acc
    const value = entity.value?.trim()
    if (!value) return acc
    if (!acc[entity.type]) acc[entity.type] = []
    acc[entity.type].push(value)
    return acc
  }, {})
  const entityEntries = Object.entries(entityGroups)
    .map(([type, values]) => {
      const uniqueValues = Array.from(new Set(values))
      return {
        type,
        label: formatEntityTypeLabel(type),
        visibleValues: uniqueValues.slice(0, MAX_VISIBLE_ENTITY_VALUES),
        hiddenCount: Math.max(0, uniqueValues.length - MAX_VISIBLE_ENTITY_VALUES),
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))
  const analysisSummary = item.analysis?.summary?.trim() ?? ''
  const hasAnalysisSummary = analysisSummary.length > 0
  const analysisConfidence = item.analysis?.confidence
  const hasAnalysisConfidence = typeof analysisConfidence === 'number' && Number.isFinite(analysisConfidence)
  const clampedAnalysisConfidence = hasAnalysisConfidence
    ? Math.max(0, Math.min(100, analysisConfidence * 100))
    : 0
  const isManualCategoryStatus = item.status === ItemStatus.MANUAL
  const showCategoryConfidence = hasAnalysisConfidence && !isManualCategoryStatus
  const hasAnalysisSection = hasAnalysisSummary || entityEntries.length > 0

  const distributionEntries = (() => {
    const results = item.distributionResults
    if (!results) return []

    if (Array.isArray(results)) {
      return results.map((result: any, index: number) => {
        const target = result?.ruleName || result?.targetId || result?.adapter || result?.id || `Target ${index + 1}`
        const status = result?.status || (result?.success ? 'success' : 'failed')
        const isSuccess = status === 'success' || status === 'completed'
        return { key: `${target}-${index}`, target, isSuccess }
      })
    }

    return Object.entries(results).map(([target, result]) => {
      const status = (result as any)?.status || ((result as any)?.success ? 'success' : 'failed')
      const isSuccess = status === 'success' || status === 'completed'
      return { key: target, target, isSuccess }
    })
  })()

  const isDark = resolvedTheme === 'dark'
  const selectedCategory = categoryOptions.find((option) => option.key === draftCategory)
  const selectedCategoryLabel = selectedCategory?.name ?? draftCategory
  const selectedCategoryTone = getCategoryBadgeStyle(draftCategory, selectedCategory?.color, isDark ? 'dark' : 'light')
  const selectedCategoryColor = selectedCategoryTone.color
  const SelectedCategoryIcon = getCategoryIconComponent(selectedCategory?.icon, draftCategory)
  const updatedAtLabel = formatRelativeTime(item.updatedAtLocal ?? item.updatedAt, time)
  const headerPillClass =
    'h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/20'

  return (
    <div className={cn(isDrawerVariant ? 'h-full flex flex-col' : 'w-full px-4 pb-6 pt-0 md:px-6')}>
      <div
        className={cn(
          'sticky top-0 z-50 flex h-14 items-center bg-white/50 px-3 backdrop-blur-xl dark:bg-[#0b0b0f]/50 md:px-6',
          isDrawerVariant ? 'border-b border-border pr-14' : '-mx-4 md:-mx-6'
        )}
      >
        <div className="flex w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:gap-3">
          {!isDrawerVariant ? (
            <div className="flex shrink-0 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 h-4" />

              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden h-8 gap-1 px-2 md:inline-flex"
              >
                <Link href={listHref} className="flex items-center gap-2">
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-sm">{t('actions.back')}</span>
                </Link>
              </Button>
            </div>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(headerPillClass, 'min-w-0 max-w-[140px] justify-start gap-2 md:min-w-[120px] md:max-w-none')}
                  disabled={!canEditItem || updateMutation.isPending}
                >
                  <SelectedCategoryIcon
                    className="h-4 w-4 shrink-0"
                    style={selectedCategoryColor ? { color: selectedCategoryColor } : undefined}
                  />
                  <span
                    className="truncate"
                    style={selectedCategoryColor ? { color: selectedCategoryColor } : undefined}
                  >
                    {selectedCategoryLabel}
                  </span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[220px]">
                {categoryOptions.map((option) => {
                  const OptionIcon = getCategoryIconComponent(option.icon, option.key)
                  const optionTone = getCategoryBadgeStyle(option.key, option.color, isDark ? 'dark' : 'light')

                  return (
                    <DropdownMenuItem
                      key={option.key}
                      onClick={() => setDraftCategory(option.key)}
                      className="justify-between"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <OptionIcon className="h-4 w-4 shrink-0" style={{ color: optionTone.color }} />
                        <span className="truncate">{option.name}</span>
                      </span>
                      {option.key === draftCategory ? <Check className="h-4 w-4" /> : null}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(headerPillClass, 'gap-2')}
                  disabled={isPolling}
                >
                  {isReadOnlyMode ? <Eye className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
                  <span>{isReadOnlyMode ? t('edit.mode.readOnly') : t('edit.mode.write')}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[180px]">
                <DropdownMenuItem
                  onClick={() => setViewMode('edit')}
                  disabled={!canEditItem}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    <PencilLine className="h-4 w-4" />
                    {t('edit.mode.write')}
                  </span>
                  {viewMode === 'edit' && canEditItem ? <Check className="h-4 w-4" /> : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setViewMode('readOnly')}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    {t('edit.mode.readOnly')}
                  </span>
                  {isReadOnlyMode ? <Check className="h-4 w-4" /> : null}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              className={cn(headerPillClass, 'w-10', isDrawerVariant && 'lg:hidden')}
              aria-label={t('actions.viewProperties')}
              aria-pressed={isDrawerVariant ? isDrawerPropertiesOpen : undefined}
              onClick={() => {
                if (isDrawerVariant) {
                  setIsDrawerPropertiesOpen((previous) => !previous)
                  return
                }

                setIsPropertiesOpen(true)
              }}
            >
              <Settings2 className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(headerPillClass, 'w-10')}
                  aria-label={t('actions.more')}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem
                  onClick={() => reclassifyMutation.mutate()}
                  disabled={reclassifyMutation.isPending || item.status === ItemStatus.PROCESSING}
                >
                  {reclassifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {t('actions.reclassify')}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => redistributeMutation.mutate()}
                  disabled={redistributeMutation.isPending || item.routingStatus === 'processing'}
                >
                  {redistributeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  {t('actions.redistribute')}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {common('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {shouldShowRoutingBanner ? (
        <div className="pb-4 pt-3">
          <RoutingStatus
            itemId={item.id}
            initialDistributedTargets={item.distributedTargets}
            initialRuleNames={item.distributedRuleNames}
            routingStatus={item.routingStatus}
            showAnimation={true}
            className={isDrawerVariant ? 'px-4 md:px-6' : ''}
          />
        </div>
      ) : null}

      {isDrawerVariant ? (
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6 min-w-0">
              <section className="relative grid gap-3" onBlurCapture={!isReadOnlyMode ? handleEditorBlurCapture : undefined}>
                {!isReadOnlyMode && autoSaveLabel ? (
                  <div className="pointer-events-none absolute right-2 top-2 z-10">
                    <div
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full bg-background/85 px-2 py-1 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur transition-opacity duration-200',
                        autoSaveIndicatorState === 'hidden' ? 'opacity-0' : 'opacity-100'
                      )}
                    >
                      {autoSaveIndicatorState === 'hidden' ? null : <AutoSaveProgress state={autoSaveIndicatorState} />}
                      <span>{autoSaveLabel}</span>
                    </div>
                  </div>
                ) : null}

                {isReadOnlyMode ? (
                  <div className="rounded-xl bg-background p-4 text-sm leading-relaxed">
                    <MarkdownContent text={draftContent} emptyText={t('content.empty')} />
                  </div>
                ) : (
                  <DetailMarkdownEditor
                    value={draftContent}
                    onChange={handleDraftContentChange}
                    placeholder={t('edit.placeholder')}
                    disabled={!canEditItem}
                    className="border-0 bg-card focus-within:ring-0"
                  />
                )}
              </section>

              {item.hasFile && (
                <>
                  <Separator className="h-[2px] bg-border" />
                  <section className="grid gap-3">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span>{t('sections.attachments')}</span>
                    </div>

                    <FilePreview
                      itemId={item.id}
                      fileName={item.fileName}
                      mimeType={item.mimeType}
                      allFiles={item.allFiles}
                      variant="detailTypeAware"
                    />
                  </section>
                </>
              )}

              {isDrawerPropertiesOpen ? (
                <div className="lg:hidden rounded-2xl border border-border bg-muted/20 p-4">
                  <InboxItemDetailProperties
                    t={t}
                    time={time}
                    item={item}
                    selectedCategoryLabel={selectedCategoryLabel}
                    showCategoryConfidence={showCategoryConfidence}
                    clampedAnalysisConfidence={clampedAnalysisConfidence}
                    hasAnalysisSection={hasAnalysisSection}
                    hasAnalysisSummary={hasAnalysisSummary}
                    analysisSummary={analysisSummary}
                    entityEntries={entityEntries}
                    distributionEntries={distributionEntries}
                    contentTypeTags={contentTypeTags}
                    updatedAtLabel={updatedAtLabel}
                    statusLabelMap={statusLabelMap}
                    getStatusBadgeVariant={getStatusBadgeVariant}
                  />
                </div>
              ) : null}
            </div>

            <aside className="hidden lg:block rounded-2xl border border-border bg-muted/20 p-4">
              <InboxItemDetailProperties
                t={t}
                time={time}
                item={item}
                selectedCategoryLabel={selectedCategoryLabel}
                showCategoryConfidence={showCategoryConfidence}
                clampedAnalysisConfidence={clampedAnalysisConfidence}
                hasAnalysisSection={hasAnalysisSection}
                hasAnalysisSummary={hasAnalysisSummary}
                analysisSummary={analysisSummary}
                entityEntries={entityEntries}
                distributionEntries={distributionEntries}
                contentTypeTags={contentTypeTags}
                updatedAtLabel={updatedAtLabel}
                statusLabelMap={statusLabelMap}
                getStatusBadgeVariant={getStatusBadgeVariant}
              />
            </aside>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <section className="relative grid gap-3" onBlurCapture={!isReadOnlyMode ? handleEditorBlurCapture : undefined}>
            {!isReadOnlyMode && autoSaveLabel ? (
              <div className="pointer-events-none absolute right-2 top-2 z-10">
                <div
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full bg-background/85 px-2 py-1 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur transition-opacity duration-200',
                    autoSaveIndicatorState === 'hidden' ? 'opacity-0' : 'opacity-100'
                  )}
                >
                  {autoSaveIndicatorState === 'hidden' ? null : <AutoSaveProgress state={autoSaveIndicatorState} />}
                  <span>{autoSaveLabel}</span>
                </div>
              </div>
            ) : null}

            {isReadOnlyMode ? (
              <div className="rounded-xl bg-background p-4 text-sm leading-relaxed">
                <MarkdownContent text={draftContent} emptyText={t('content.empty')} />
              </div>
            ) : (
              <DetailMarkdownEditor
                value={draftContent}
                onChange={handleDraftContentChange}
                placeholder={t('edit.placeholder')}
                disabled={!canEditItem}
                className="border-0 bg-card focus-within:ring-0"
              />
            )}
          </section>

          {item.hasFile && (
            <>
              <Separator className="h-[2px] bg-border" />
              <section className="grid gap-3">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span>{t('sections.attachments')}</span>
                </div>

                <FilePreview
                  itemId={item.id}
                  fileName={item.fileName}
                  mimeType={item.mimeType}
                  allFiles={item.allFiles}
                  variant="detailTypeAware"
                />
              </section>
            </>
          )}
        </div>
      )}

      {!isDrawerVariant ? (
        <Sheet open={isPropertiesOpen} onOpenChange={setIsPropertiesOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                {t('sections.properties')}
              </SheetTitle>
              <SheetDescription>{t('subtitle', { id: item.id })}</SheetDescription>
            </SheetHeader>

            <div className="mt-4">
              <InboxItemDetailProperties
                t={t}
                time={time}
                item={item}
                selectedCategoryLabel={selectedCategoryLabel}
                showCategoryConfidence={showCategoryConfidence}
                clampedAnalysisConfidence={clampedAnalysisConfidence}
                hasAnalysisSection={hasAnalysisSection}
                hasAnalysisSummary={hasAnalysisSummary}
                analysisSummary={analysisSummary}
                entityEntries={entityEntries}
                distributionEntries={distributionEntries}
                contentTypeTags={contentTypeTags}
                updatedAtLabel={updatedAtLabel}
                statusLabelMap={statusLabelMap}
                getStatusBadgeVariant={getStatusBadgeVariant}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()}>{common('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
