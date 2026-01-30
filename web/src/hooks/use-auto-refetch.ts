import { useEffect, useRef, useState } from 'react'
import { ItemStatus } from '@/types'

interface AutoRefetchOptions {
  refetch: () => void
  items: Array<{ status: ItemStatus }>
  interval?: number // milliseconds, default 3000
  enabled?: boolean
}

/**
 * Smart auto-refetch hook for polling processing items
 *
 * This hook automatically refetches data when:
 * 1. There are items in PROCESSING status (AI classification in progress)
 * 2. There are recently created items (within 3 minutes) - to capture routing distribution updates
 *
 * It stops polling when all items are completed/failed and no recent items exist.
 *
 * @param options - Configuration options
 * @param options.refetch - Function to refetch data
 * @param options.items - Array of items to check for processing status
 * @param options.interval - Polling interval in milliseconds (default: 3000)
 * @param options.enabled - Whether auto-refetch is enabled (default: true)
 */
export function useAutoRefetch({
  refetch,
  items,
  interval = 3000,
  enabled = true,
}: AutoRefetchOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (isPolling) {
        setIsPolling(false)
      }
      return
    }

    // Check if there are any items that need polling (only processing status)
    // PENDING items don't need polling as they haven't started processing yet
    const hasProcessingItems = items.some(
      (item) => item.status === ItemStatus.PROCESSING
    )

    // Check if there are recently created items (likely undergoing routing distribution)
    // Poll for items created within the last 3 minutes to capture routing status updates
    const now = new Date()
    const hasRecentItems = items.some((item) => {
      const createdAt = new Date(item.createdAt)
      const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)
      const isRecent = diffMinutes < 3 // Poll for 3 minutes after creation
      if (isRecent && process.env.NODE_ENV === 'development') {
        console.log(`[useAutoRefetch] Recent item detected: ${item.id}, age: ${diffMinutes.toFixed(2)} minutes`)
      }
      return isRecent
    })

    const shouldPoll = hasProcessingItems || hasRecentItems

    if (process.env.NODE_ENV === 'development') {
      console.log(`[useAutoRefetch] shouldPoll: ${shouldPoll}, hasProcessingItems: ${hasProcessingItems}, hasRecentItems: ${hasRecentItems}`)
    }

    if (shouldPoll) {
      // Start polling if not already polling
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          refetch()
        }, interval)
        setIsPolling(true)
      }
    } else {
      // Stop polling when all items are completed/failed and no recent items
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (isPolling) {
        setIsPolling(false)
      }
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [items, refetch, interval, enabled, isPolling])

  return {
    isPolling,
  }
}
