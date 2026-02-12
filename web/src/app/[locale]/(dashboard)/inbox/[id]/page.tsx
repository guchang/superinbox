"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, useEffect, useCallback, useRef, type FocusEvent } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { useTheme } from 'next-themes'
import { categoriesApi } from '@/lib/api/categories'
import { inboxApi } from '@/lib/api/inbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { formatRelativeTime, cn } from '@/lib/utils'
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
import { LinkifiedText } from '@/components/shared/linkified-text'
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

function normalizeDraftContent(value: string) {
  return value.replace(/\r\n/g, '\n')
}

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

export default function InboxDetailPage() {
  const t = useTranslations('inboxDetail')
  const common = useTranslations('common')
  const time = useTranslations('time')
  const errors = useTranslations('errors')
  const { resolvedTheme } = useTheme()
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
  const [draftContent, setDraftContent] = useState('')
  const [draftCategory, setDraftCategory] = useState('unknown')
  const [savedSnapshot, setSavedSnapshot] = useState<AutoSaveSnapshot | null>(null)
  const [autoSaveIndicatorState, setAutoSaveIndicatorState] = useState<AutoSaveIndicatorState>('hidden')
  const [saveIndicatorMode, setSaveIndicatorMode] = useState<SaveIndicatorMode>('auto')
  const [viewMode, setViewMode] = useState<'edit' | 'readOnly'>('edit')
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false)
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

  const updateMutation = useMutation({
    mutationFn: async ({ content, category }: { content: string; category: string }) => {
      const response = await inboxApi.updateItem(id, { content, category })
      if (!response.success || !response.data) {
        throw new Error(response.error || response.message || 'Failed to update item')
      }
      return response.data
    },
    onSuccess: (updatedItem) => {
      queryClient.setQueryData(['inbox', id], (previous: any) => {
        if (!previous || typeof previous !== 'object') return previous

        return {
          ...previous,
          data: {
            ...previous.data,
            ...updatedItem,
            content: normalizeDraftContent(updatedItem.content ?? previous.data?.content ?? ''),
            analysis: {
              ...previous.data?.analysis,
              ...updatedItem.analysis,
            },
          },
        }
      })
    },
  })

  const canEditItem = item != null && item.status !== ItemStatus.PROCESSING
  const isReadOnlyMode = viewMode === 'readOnly' || !canEditItem

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
      if (!canEditItem) return null

      beginAutoSaveIndicator(Boolean(options?.forceVisual))

      try {
        const updatedItem = await updateMutation.mutateAsync(snapshot)
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
      [ItemStatus.FAILED]: 'destructive',
    }
    return variants[status] || 'outline'
  }

  const statusLabelMap: Record<ItemStatus, string> = {
    [ItemStatus.PENDING]: t('status.pending'),
    [ItemStatus.PROCESSING]: t('status.processing'),
    [ItemStatus.COMPLETED]: t('status.completed'),
    [ItemStatus.FAILED]: t('status.failed'),
  }

  if (isLoading) {
    return (
      <div className="w-full px-4 py-24 md:px-6">
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 shadow-sm dark:bg-background/70">
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
      <div className="w-full px-4 py-24 md:px-6">
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-10 shadow-sm dark:bg-background/70">
          <div className="rounded-full bg-muted p-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">{t('notFound')}</p>
          <Link href="/inbox">
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
    <div className="w-full px-4 pb-6 pt-0 md:px-6">
      <div className="sticky top-0 z-50 -mx-4 flex h-14 items-center bg-white/50 px-3 backdrop-blur-xl dark:bg-[#0b0b0f]/50 md:-mx-6 md:px-6">
        <div className="flex w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4" />

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden h-8 gap-1 px-2 md:inline-flex"
            >
              <Link href="/inbox" className="flex items-center gap-2">
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="text-sm">{t('actions.back')}</span>
              </Link>
            </Button>
          </div>

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
              className={cn(headerPillClass, 'w-10')}
              aria-label={t('actions.viewProperties')}
              onClick={() => setIsPropertiesOpen(true)}
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
                  disabled={redistributeMutation.isPending || item.status === ItemStatus.PROCESSING}
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
              onChange={setDraftContent}
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
              />
            </section>
          </>
        )}

        {item.analysis && (item.analysis.summary || entityEntries.length > 0) && (
          <>
            <Separator />
            <Card className="rounded-2xl border border-border bg-card shadow-sm dark:bg-background/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  {t('sections.analysis')}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                {item.analysis.summary && (
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('analysis.summary')}</span>
                    <p className="rounded-xl bg-muted p-3 text-sm leading-relaxed text-foreground">
                      <LinkifiedText text={item.analysis.summary} linkClassName="text-primary hover:opacity-80" />
                    </p>
                  </div>
                )}

                {entityEntries.length > 0 && (
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('analysis.entities')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {entityEntries.flatMap(([type, values]) =>
                        values.map((val, index) => (
                          <Badge key={`${type}-${index}`} variant="secondary" className="font-normal">
                            {val}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Sheet open={isPropertiesOpen} onOpenChange={setIsPropertiesOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              {t('sections.properties')}
            </SheetTitle>
            <SheetDescription>{t('subtitle', { id: item.id })}</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">{t('metadata.source')}</span>
                <div>
                  <Badge variant="outline">{item.source || '-'}</Badge>
                </div>
              </div>

              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">{t('metadata.status')}</span>
                <div>
                  <Badge variant={getStatusBadgeVariant(item.status)}>{statusLabelMap[item.status]}</Badge>
                </div>
              </div>

              <div className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs text-muted-foreground">{t('metadata.category')}</span>
                <div>
                  <Badge variant="secondary" className="font-medium">
                    {selectedCategoryLabel}
                  </Badge>
                </div>
              </div>
            </div>

            {item.analysis && (
              <>
                <Separator />
                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('analysis.confidence')}</span>
                    <span className="font-medium text-muted-foreground">{(item.analysis.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.max(0, Math.min(100, item.analysis.confidence * 100))}%` }}
                    />
                  </div>
                </div>
              </>
            )}

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
              </div>

              <div className="grid gap-2">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('metadata.createdAt')}</span>
                  <span className="text-right font-medium">{formatRelativeTime(item.createdAtLocal ?? item.createdAt, time)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('metadata.updatedAt')}</span>
                  <span className="text-right font-medium">{updatedAtLabel}</span>
                </div>
              </div>

              <Separator />

              <div className="grid gap-1">
                <span className="text-muted-foreground">{t('metadata.id')}</span>
                <code className="rounded bg-muted px-2 py-1 font-mono text-[10px] break-all select-all">{item.id}</code>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
