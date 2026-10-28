import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_WISHLIST = 60
const MAX_RECENT = 12

interface WishlistState {
  /** Product ids, most recently saved first. */
  ids: string[]
  /** Returns true when the piece is now saved. */
  toggle: (id: string) => boolean
  /** Drops ids of pieces that no longer exist in the catalogue. */
  keepOnly: (existing: string[]) => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const saved = get().ids.includes(id)
        set({ ids: saved ? get().ids.filter((x) => x !== id) : [id, ...get().ids].slice(0, MAX_WISHLIST) })
        return !saved
      },
      keepOnly: (existing) => set({ ids: get().ids.filter((id) => existing.includes(id)) }),
    }),
    { name: 'ak-wishlist' },
  ),
)

export const useIsWishlisted = (id: string) => useWishlistStore((s) => s.ids.includes(id))
export const useWishlistCount = () => useWishlistStore((s) => s.ids.length)

interface RecentState {
  /** Product ids, most recently viewed first. */
  ids: string[]
  remember: (id: string) => void
}

export const useRecentlyViewedStore = create<RecentState>()(
  persist(
    (set, get) => ({
      ids: [],
      remember: (id) => set({ ids: [id, ...get().ids.filter((x) => x !== id)].slice(0, MAX_RECENT) }),
    }),
    { name: 'ak-recently-viewed' },
  ),
)
