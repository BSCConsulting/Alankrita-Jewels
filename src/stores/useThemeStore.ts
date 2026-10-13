import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeVariant } from '@/types'

interface ThemeState {
  /** Theme implied by the current page (collection/product category). */
  routeTheme: ThemeVariant
  /** Explicit user choice from the header toggle; wins over routeTheme and persists in localStorage. */
  override: ThemeVariant | null
  setRouteTheme: (theme: ThemeVariant) => void
  setOverride: (theme: ThemeVariant | null) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Seeded from the pre-paint script so hydration doesn't flash the other theme.
      routeTheme: document.documentElement.dataset.theme === 'modern' ? 'modern' : 'heritage',
      override: null,
      setRouteTheme: (routeTheme) => set({ routeTheme }),
      setOverride: (override) => set({ override }),
      toggle: () => {
        const active = get().override ?? get().routeTheme
        set({ override: active === 'heritage' ? 'modern' : 'heritage' })
      },
    }),
    {
      // Key + shape are read by the pre-paint script in index.html.
      name: 'ak-theme',
      partialize: (s) => ({ override: s.override }),
    },
  ),
)

export const useActiveTheme = () => useThemeStore((s) => s.override ?? s.routeTheme)
