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
  Trash2,
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
const TRASH_CATEGORY_KEY = 'trash'
const UNKNOWN_CATEGORY_COLOR = '#6b7280'
const TRASH_CATEGORY_COLOR = '#9ca3af'

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
  trash: Trash2,
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
  trash: 'trash',
  movie: 'film',
  books: 'book-open',
  sinbox: 'wrench',
}

const DEFAULT_APPEARANCE_KEYS = new Set(Object.keys(DEFAULT_ICON_BY_KEY))

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

const hexToRgb = (hexColor: string) => {
  const sanitized = hexColor.replace('#', '')
  return {
    r: Number.parseInt(sanitized.slice(0, 2), 16),
    g: Number.parseInt(sanitized.slice(2, 4), 16),
    b: Number.parseInt(sanitized.slice(4, 6), 16),
  }
}

const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g)
    .toString(16)
    .padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
}

const mixHexColors = (baseHexColor: string, targetHexColor: string, ratio: number): string => {
  const base = hexToRgb(baseHexColor)
  const target = hexToRgb(targetHexColor)
  const safeRatio = Math.min(1, Math.max(0, ratio))

  return rgbToHex(
    base.r + (target.r - base.r) * safeRatio,
    base.g + (target.g - base.g) * safeRatio,
    base.b + (target.b - base.b) * safeRatio
  )
}

const hexToRgba = (hexColor: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hexColor)
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha)).toFixed(2)})`
}

export type CategoryAppearanceTheme = 'light' | 'dark'

const getThemeAdjustedCategoryColor = (
  color: string,
  theme: CategoryAppearanceTheme = 'light'
): string => {
  if (theme === 'dark') {
    return mixHexColors(color, '#ffffff', 0.30)
  }

  return color
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

  if (normalizedKey === TRASH_CATEGORY_KEY) {
    return TRASH_CATEGORY_COLOR
  }

  const normalized = String(color ?? '').trim().toLowerCase()
  if (normalized && isHexColor(normalized)) {
    return normalized
  }

  return getAutoCategoryColor(normalizedKey)
}

export const getCategoryDisplayColor = (
  key?: string,
  color?: string,
  theme: CategoryAppearanceTheme = 'light'
): string => {
  const resolved = resolveCategoryColor(key, color)

  if (normalizeCategoryKey(key) === UNKNOWN_CATEGORY_KEY) {
    return resolved
  }

  return getThemeAdjustedCategoryColor(resolved, theme)
}

export const hasCategoryDefaultAppearance = (key?: string): boolean => {
  const normalizedKey = String(key ?? '').trim().toLowerCase()

  if (!normalizedKey) {
    return false
  }

  return DEFAULT_APPEARANCE_KEYS.has(normalizedKey)
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

export const getCategoryBadgeStyle = (
  key?: string,
  color?: string,
  theme: CategoryAppearanceTheme = 'light'
): CSSProperties => {
  const adjustedColor = getCategoryDisplayColor(key, color, theme)

  if (theme === 'dark') {
    return {
      color: adjustedColor,
      borderColor: hexToRgba(adjustedColor, 0.55),
      backgroundColor: hexToRgba(adjustedColor, 0.26),
    }
  }

  return {
    color: adjustedColor,
    borderColor: hexToRgba(adjustedColor, 0.35),
    backgroundColor: hexToRgba(adjustedColor, 0.14),
  }
}

export const getCategorySoftStyle = (
  key?: string,
  color?: string,
  theme: CategoryAppearanceTheme = 'light'
): CSSProperties => {
  const adjustedColor = getCategoryDisplayColor(key, color, theme)

  if (theme === 'dark') {
    return {
      color: adjustedColor,
      backgroundColor: hexToRgba(adjustedColor, 0.24),
    }
  }

  return {
    color: adjustedColor,
    backgroundColor: hexToRgba(adjustedColor, 0.14),
  }
}
