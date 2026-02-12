"use client"

import { useEffect } from 'react'

const CHROME_EXTENSION_PREFIX = 'chrome-extension://'

const containsExtensionOrigin = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.includes(CHROME_EXTENSION_PREFIX)
  }

  if (value instanceof Error) {
    return containsExtensionOrigin(value.stack) || containsExtensionOrigin(value.message)
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return (
      containsExtensionOrigin(record.stack) ||
      containsExtensionOrigin(record.message) ||
      containsExtensionOrigin(record.filename) ||
      containsExtensionOrigin(record.fileName) ||
      containsExtensionOrigin(record.sourceURL) ||
      containsExtensionOrigin(record.src)
    )
  }

  return false
}

const shouldIgnoreErrorEvent = (event: ErrorEvent): boolean => {
  if (containsExtensionOrigin(event.filename)) return true
  if (containsExtensionOrigin(event.message)) return true
  if (containsExtensionOrigin(event.error)) return true

  const target = event.target as (EventTarget & { src?: string }) | null
  if (target?.src && containsExtensionOrigin(target.src)) return true

  return false
}

const suppressEvent = (event: Event) => {
  event.preventDefault()
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation()
    return
  }
  event.stopPropagation()
}

export function DevExtensionErrorFilter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    const handleError = (event: ErrorEvent) => {
      if (!shouldIgnoreErrorEvent(event)) return
      suppressEvent(event)
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!containsExtensionOrigin(event.reason)) return
      suppressEvent(event)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
