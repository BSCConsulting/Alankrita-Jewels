import { useEffect, type ReactNode } from 'react'
import { useActiveTheme, useThemeStore } from '@/stores/useThemeStore'
import type { ThemeVariant } from '@/types'
import { THEMES } from './themes'

/** Mirrors the active theme onto <html data-theme> so every CSS token re-resolves at runtime. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useActiveTheme()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[theme].metaColor)
  }, [theme])

  return children
}

/**
 * Declares the theme a page defaults to (e.g. 1-gram-gold → heritage, anti-tarnish → modern).
 * A manual override from the header toggle still takes precedence.
 */
export function useRouteTheme(theme: ThemeVariant | null | undefined) {
  const setRouteTheme = useThemeStore((s) => s.setRouteTheme)
  useEffect(() => {
    if (theme) setRouteTheme(theme)
  }, [theme, setRouteTheme])
}
