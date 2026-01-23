import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(
  dateString: string,
  t: (key: string, values?: Record<string, number>) => string
): string {
  // Only calculate relative time on client side
  if (typeof window === 'undefined') {
    return formatDate(dateString)
  }

  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { count: minutes })
  if (hours < 24) return t('hoursAgo', { count: hours })
  if (days < 7) return t('daysAgo', { count: days })
  if (weeks < 4) return t('weeksAgo', { count: weeks })
  if (months < 12) return t('monthsAgo', { count: months })
  return t('yearsAgo', { count: years })
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Format date to localized string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)

  // Format manually to avoid locale differences between server and client
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
