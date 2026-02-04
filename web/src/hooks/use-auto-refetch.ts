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
 * 2. There are items with routingStatus === 'processing' (routing distribution in progress)
 *
 * It stops polling when all items are completed/failed and no routing in progress.
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

    // Check if there are any items that need polling
    const hasProcessingItems = items.some(
      (item) => item.status === ItemStatus.PROCESSING
    )

    // Check if there are items with routing in progress
    const hasRoutingInProgress = items.some(
      (item: any) => item.routingStatus === 'processing'
    )

    const shouldPoll = hasProcessingItems || hasRoutingInProgress

    if (process.env.NODE_ENV === 'development') {
      console.log(`[useAutoRefetch] shouldPoll: ${shouldPoll}, hasProcessingItems: ${hasProcessingItems}, hasRoutingInProgress: ${hasRoutingInProgress}`)
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
      // Stop polling when no items need updates
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
