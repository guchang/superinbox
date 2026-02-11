"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

function ThemeMigration() {
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    if (theme === "system") {
      setTheme("light")
    }
  }, [theme, setTheme])

  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeMigration />
      {children}
    </NextThemesProvider>
  )
}
