import type { CSSProperties } from 'react'
import {
  BookOpen,
  Bookmark,
  Briefcase,
  CalendarClock,
  CheckSquare,
  Code,
  Film,
  GraduationCap,
  HeartPulse,
  HelpCircle,
  Inbox,
  Lightbulb,
  Notebook,
  Plane,
  Receipt,
  ShoppingCart,
  Star,
  Target,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

const CATEGORY_COLOR_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#0f766e',
  '#ea580c',
  '#db2777',
  '#0891b2',
  '#4f46e5',
  '#ca8a04',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#0284c7',
] as const

const UNKNOWN_CATEGORY_KEY = 'unknown'
const UNKNOWN_CATEGORY_COLOR = '#6b7280'

const CATEGORY_ICON_COMPONENTS = {
  inbox: Inbox,
  'check-square': CheckSquare,
  lightbulb: Lightbulb,
  wallet: Wallet,
  'calendar-clock': CalendarClock,
  notebook: Notebook,
  bookmark: Bookmark,
  'help-circle': HelpCircle,
  film: Film,
  'book-open': BookOpen,
  wrench: Wrench,
  briefcase: Briefcase,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  'shopping-cart': ShoppingCart,
  receipt: Receipt,
  target: Target,
  plane: Plane,
  code: Code,
  star: Star,
} as const satisfies Record<string, LucideIcon>

type CategoryIconName = keyof typeof CATEGORY_ICON_COMPONENTS

export const CATEGORY_ICON_OPTIONS = Object.keys(
  CATEGORY_ICON_COMPONENTS
) as CategoryIconName[]

const DEFAULT_ICON_BY_KEY: Record<string, CategoryIconName> = {
  todo: 'check-square',
  idea: 'lightbulb',
  expense: 'wallet',
  schedule: 'calendar-clock',
  note: 'notebook',
  bookmark: 'bookmark',
  unknown: 'help-circle',
  movie: 'film',
  books: 'book-open',
  sinbox: 'wrench',
}

const normalizeCategoryKey = (key?: string): string => {
  return String(key ?? '').trim().toLowerCase() || UNKNOWN_CATEGORY_KEY
}

const hashString = (input: string): number => {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33 + input.charCodeAt(i)) >>> 0
  }
  return hash
}

const isHexColor = (value: string): boolean => {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

const hexToRgba = (hexColor: string, alpha: number): string => {
  const sanitized = hexColor.replace('#', '')
  const r = Number.parseInt(sanitized.slice(0, 2), 16)
  const g = Number.parseInt(sanitized.slice(2, 4), 16)
  const b = Number.parseInt(sanitized.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha)).toFixed(2)})`
}

export const getAutoCategoryColor = (key?: string): string => {
  const normalizedKey = normalizeCategoryKey(key)

  if (normalizedKey === UNKNOWN_CATEGORY_KEY) {
    return UNKNOWN_CATEGORY_COLOR
  }

  const index = hashString(normalizedKey) % CATEGORY_COLOR_PALETTE.length
  return CATEGORY_COLOR_PALETTE[index]
}

export const resolveCategoryColor = (key?: string, color?: string): string => {
  const normalizedKey = normalizeCategoryKey(key)

  if (normalizedKey === UNKNOWN_CATEGORY_KEY) {
    return UNKNOWN_CATEGORY_COLOR
  }

  const normalized = String(color ?? '').trim().toLowerCase()
  if (normalized && isHexColor(normalized)) {
    return normalized
  }

  return getAutoCategoryColor(normalizedKey)
}

export const resolveCategoryIconName = (
  key?: string,
  icon?: string
): CategoryIconName => {
  const normalizedKey = normalizeCategoryKey(key)
  const normalizedIcon = String(icon ?? '').trim()

  if (normalizedIcon && normalizedIcon in CATEGORY_ICON_COMPONENTS) {
    return normalizedIcon as CategoryIconName
  }

  return DEFAULT_ICON_BY_KEY[normalizedKey] || 'inbox'
}

export const getCategoryIconComponent = (icon?: string, key?: string): LucideIcon => {
  const iconName = resolveCategoryIconName(key, icon)
  return CATEGORY_ICON_COMPONENTS[iconName] || Inbox
}

export const getCategoryBadgeStyle = (key?: string, color?: string): CSSProperties => {
  const resolved = resolveCategoryColor(key, color)
  return {
    color: resolved,
    borderColor: hexToRgba(resolved, 0.35),
    backgroundColor: hexToRgba(resolved, 0.14),
  }
}

export const getCategorySoftStyle = (key?: string, color?: string): CSSProperties => {
  const resolved = resolveCategoryColor(key, color)
  return {
    color: resolved,
    backgroundColor: hexToRgba(resolved, 0.14),
  }
}
