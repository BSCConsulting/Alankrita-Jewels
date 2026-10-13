import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  key: string
  productId: string
  slug: string
  title: string
  teluguTitle: string | null
  image: string
  mrp: number
  salePrice: number
  size: string | null
  quantity: number
  maxQty: number
}

type NewCartItem = Omit<CartItem, 'key' | 'quantity'>

interface CartState {
  items: CartItem[]
  isOpen: boolean
  add: (item: NewCartItem, quantity?: number) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
  open: () => void
  close: () => void
}

const MAX_PER_LINE = 10
const lineKey = (productId: string, size: string | null) => `${productId}::${size ?? '-'}`
const clampQty = (qty: number, max: number) => Math.max(1, Math.min(qty, max, MAX_PER_LINE))

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      add: (item, quantity = 1) =>
        set((state) => {
          const key = lineKey(item.productId, item.size)
          const existing = state.items.find((i) => i.key === key)
          const items = existing
            ? state.items.map((i) =>
                i.key === key ? { ...i, ...item, quantity: clampQty(i.quantity + quantity, item.maxQty) } : i,
              )
            : [...state.items, { ...item, key, quantity: clampQty(quantity, item.maxQty) }]
          return { items, isOpen: true }
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.key === key ? { ...i, quantity: clampQty(quantity, i.maxQty) } : i)),
        })),
      remove: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    { name: 'ak-cart', partialize: (s) => ({ items: s.items }) },
  ),
)

export const useCartCount = () => useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0))

export const toPricedLines = (items: CartItem[]) =>
  items.map((i) => ({ mrp: i.mrp, sale_price: i.salePrice, quantity: i.quantity }))
