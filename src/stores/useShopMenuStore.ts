import { create } from 'zustand'

interface ShopMenuState {
  isOpen: boolean
  open: () => void
  close: () => void
}

/** The collections menu is opened from the header (tablet) and from the Shop tab (phone). */
export const useShopMenuStore = create<ShopMenuState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
