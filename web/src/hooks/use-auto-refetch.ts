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
 * This hook automatically refetches data when there are items in PROCESSING status.
 * It does NOT poll for PENDING items (they haven't started processing yet).
 * It stops polling when all items are completed or failed.
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

    if (hasProcessingItems) {
      // Start polling if not already polling
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          refetch()
        }, interval)
        setIsPolling(true)
      }
    } else {
      // Stop polling when all items are completed/failed
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
