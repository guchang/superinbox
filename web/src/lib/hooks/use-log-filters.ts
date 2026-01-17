/**
 * useLogFilters Hook
 * Manages log filter state using URL search params
 */

'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useMemo, useCallback } from 'react'
import type { LogFilters } from '@/types/logs'

const DEFAULT_FILTERS: LogFilters = {
  timeRange: 'today',
  status: 'all',
  searchQuery: '',
  methods: [],
  page: 1,
  pageSize: 20,
}

export function useLogFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Read filters from URL
  const filters = useMemo((): LogFilters => {
    return {
      timeRange: (searchParams.get('timeRange') as LogFilters['timeRange']) || DEFAULT_FILTERS.timeRange,
      status: (searchParams.get('status') as LogFilters['status']) || DEFAULT_FILTERS.status,
      searchQuery: searchParams.get('q') || '',
      methods: searchParams.get('methods')?.split(',') as LogFilters['methods'] || [],
      ipAddress: searchParams.get('ip') || undefined,
      apiKeyId: searchParams.get('apiKey') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    }
  }, [searchParams])

  // Calculate actual date range (for API calls)
  const dateRange = useMemo(() => {
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    switch (filters.timeRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        startDate = new Date(now.setDate(now.getDate() - 30))
        break
      case 'custom':
        startDate = filters.startDate ? new Date(filters.startDate) : new Date(now.setDate(now.getDate() - 7))
        if (filters.endDate) {
          endDate = new Date(filters.endDate)
        }
        break
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0))
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  }, [filters])

  // Update a single filter
  const updateFilter = useCallback(<K extends keyof LogFilters>(key: K, value: LogFilters[K]) => {
    const newParams = new URLSearchParams(searchParams)

    // Map filter keys to URL param names
    const urlParamMap: Record<string, string> = {
      ipAddress: 'ip',
      apiKeyId: 'apiKey',
      searchQuery: 'q',
    }

    const urlKey = urlParamMap[key] || key

    if (value === undefined || value === '' || value === DEFAULT_FILTERS[key]) {
      newParams.delete(urlKey)
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        newParams.delete(urlKey)
      } else {
        newParams.set(urlKey, value.join(','))
      }
    } else {
      newParams.set(urlKey, String(value))
    }

    // Reset page number (except when updating page itself)
    if (key !== 'page') {
      newParams.set('page', '1')
    }

    router.push(`?${newParams.toString()}`)
  }, [searchParams, router])

  // Reset all filters
  const resetFilters = useCallback(() => {
    router.push('/settings/logs')
  }, [router])

  return {
    filters,
    dateRange,
    updateFilter,
    resetFilters,
  }
}
