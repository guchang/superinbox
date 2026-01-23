/**
 * MCP Connector Logo Color Palette
 * Predefined colors for auto-generated logos with initial letters
 * Colors are persistent and assigned once per connector
 */

export const LOGO_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Orange
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Pink
  '#85C1E2', // Sky Blue
  '#F8B500', // Gold
  '#00B894', // Green
  '#6C5CE7', // Purple
  '#FD79A8', // Hot Pink
  '#00CEC9', // Turquoise
  '#E17055', // Coral
  '#74B9FF', // Light Blue
] as const

export type LogoColor = typeof LOGO_COLORS[number]

/**
 * Get a random color from the palette
 * Used when assigning a color to a new connector
 */
export function getRandomLogoColor(): LogoColor {
  return LOGO_COLORS[Math.floor(Math.random() * LOGO_COLORS.length)]
}

/**
 * Get a consistent color for a given string (e.g., connector name)
 * Uses simple hash function for consistency
 */
export function getConsistentLogoColor(str: string): LogoColor {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return LOGO_COLORS[Math.abs(hash) % LOGO_COLORS.length]
}
