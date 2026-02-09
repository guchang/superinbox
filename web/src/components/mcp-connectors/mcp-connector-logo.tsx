/**
 * MCPConnectorLogo Component
 *
 * Displays either:
 * 1. Official logo image (if available)
 * 2. Auto-generated initial letter with colored background
 *
 * @example
 * // With official logo
 * <MCPConnectorLogo serverType="notion" />
 *
 * // With initial letter
 * <MCPConnectorLogo name="My Todoist" logoColor="#4ECDC4" />
 */

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

interface MCPConnectorLogoProps {
  /** Server type (e.g., 'notion', 'todoist', 'github') */
  serverType?: string
  /** Connector name (fallback for initial) */
  name?: string
  /** Logo color (for initial letter fallback) */
  logoColor?: string
  /** Logo size */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base'
}

export function MCPConnectorLogo({
  serverType,
  name = '',
  logoColor,
  size = 'md',
  className
}: MCPConnectorLogoProps) {
  // Determine if we have an official logo
  const officialLogo = useMemo(() => {
    if (!serverType) return null

    const logoMap: Record<string, string> = {
      notion: '/logos/notion.svg',
      todoist: '/logos/todoist.svg',
      github: '/logos/github.svg',
      obsidian: '/logos/obsidian.svg',
    }

    return logoMap[serverType]
  }, [serverType])

  // Get the letter to display
  const letter = useMemo(() => {
    if (name && name.length > 0) {
      return name[0].toUpperCase()
    }
    if (serverType && serverType.length > 0) {
      return serverType[0].toUpperCase()
    }
    return '?'
  }, [name, serverType])

  // Get background color
  const bgColor = logoColor || '#94a3b8' // Default slate-400
  const [logoLoadFailed, setLogoLoadFailed] = useState(false)

  useEffect(() => {
    setLogoLoadFailed(false)
  }, [officialLogo])

  if (officialLogo && !logoLoadFailed) {
    return (
      <div className={cn('flex items-center justify-center', sizeClasses[size], className)}>
        <div className="relative h-2/3 w-2/3">
          <Image
            src={officialLogo}
            alt={serverType ?? 'connector logo'}
            fill
            sizes="40px"
            unoptimized
            className="object-contain"
            onError={() => setLogoLoadFailed(true)}
          />
        </div>
      </div>
    )
  }

  // Initial letter fallback
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md font-semibold text-white',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: bgColor }}
    >
      {letter}
    </div>
  )
}
