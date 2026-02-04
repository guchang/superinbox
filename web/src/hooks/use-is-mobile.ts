import { useState, useEffect } from 'react'

/**
 * Detect if the current viewport is mobile size
 * Avoids hydration mismatch by only updating after client-side mount
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [breakpoint])

  // During SSR and before mount, return false to avoid hydration mismatch
  // After mount, return the actual detected value
  return isMounted ? isMobile : false
}
