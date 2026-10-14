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
  /** Refresh prices, images and stock from the catalogue; returns titles of lines that were removed or changed. */
  sync: (products: SyncProduct[]) => { removed: string[]; changed: string[] }
}

export interface SyncProduct {
  id: string
  title: string
  telugu_title: string | null
  image: string
  mrp: number
  sale_price: number
  stock_count: number
  in_stock: boolean
}

const MAX_PER_LINE = 10
const lineKey = (productId: string, size: string | null) => `${productId}::${size ?? '-'}`
const clampQty = (qty: number, max: number) => Math.max(1, Math.min(qty, max, MAX_PER_LINE))

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
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
      sync: (products) => {
        const byId = new Map(products.map((p) => [p.id, p]))
        const removed: string[] = []
        const changed: string[] = []
        const items = get().items.flatMap((i) => {
          const p = byId.get(i.productId)
          if (!p || !p.in_stock || p.stock_count < 1) {
            removed.push(i.title)
            return []
          }
          const quantity = clampQty(i.quantity, p.stock_count)
          if (p.sale_price !== i.salePrice || quantity !== i.quantity) changed.push(p.title)
          return [{ ...i, title: p.title, teluguTitle: p.telugu_title, image: p.image, mrp: p.mrp, salePrice: p.sale_price, maxQty: p.stock_count, quantity }]
        })
        set({ items })
        return { removed, changed }
      },
    }),
    { name: 'ak-cart', partialize: (s) => ({ items: s.items }) },
  ),
)

export const useCartCount = () => useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0))

export const toPricedLines = (items: CartItem[]) =>
  items.map((i) => ({ mrp: i.mrp, sale_price: i.salePrice, quantity: i.quantity }))
