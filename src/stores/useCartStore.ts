import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PricedLine } from '@/lib/pricing'
import type { JewelleryType } from '@/types'

export interface CartItem {
  key: string
  productId: string
  slug: string
  title: string
  teluguTitle: string | null
  /** Optional: bags saved before the bridal set offer get it on the next catalogue sync. */
  jewelleryType?: JewelleryType
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
  /** Returns the quantity actually added (0 when a limit is already reached). */
  add: (item: NewCartItem, quantity?: number) => number
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
  jewellery_type: JewelleryType
  image: string
  mrp: number
  sale_price: number
  stock_count: number
  in_stock: boolean
}

/** Mirrors place_order (supabase/migrations/005_growth_features.sql). */
export const MAX_QTY_PER_PRODUCT = 10
export const MAX_PIECES_PER_ORDER = 20

const lineKey = (productId: string, size: string | null) => `${productId}::${size ?? '-'}`

/** Most this line may hold, given stock, the per-design cap (all sizes together) and the bag cap. */
export function lineLimit(items: CartItem[], line: Pick<CartItem, 'key' | 'productId'>, stock: number): number {
  const others = items.filter((i) => i.key !== line.key)
  const sameDesign = others.filter((i) => i.productId === line.productId).reduce((n, i) => n + i.quantity, 0)
  const bag = others.reduce((n, i) => n + i.quantity, 0)
  const designRoom = Math.min(stock, MAX_QTY_PER_PRODUCT) - sameDesign
  const bagRoom = MAX_PIECES_PER_ORDER - bag
  return Math.max(0, Math.min(designRoom, bagRoom))
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      add: (item, quantity = 1) => {
        const state = get()
        const key = lineKey(item.productId, item.size)
        const existing = state.items.find((i) => i.key === key)
        const current = existing?.quantity ?? 0
        const next = Math.min(current + quantity, lineLimit(state.items, { key, productId: item.productId }, item.maxQty))
        const added = Math.max(0, next - current)
        if (added === 0) {
          set({ isOpen: true })
          return 0
        }
        const items = existing
          ? state.items.map((i) => (i.key === key ? { ...i, ...item, quantity: next } : i))
          : [...state.items, { ...item, key, quantity: next }]
        set({ items, isOpen: true })
        return added
      },
      setQuantity: (key, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.key === key ? { ...i, quantity: Math.max(1, Math.min(quantity, lineLimit(state.items, i, i.maxQty))) } : i,
          ),
        })),
      remove: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      sync: (products) => {
        const byId = new Map(products.map((p) => [p.id, p]))
        const removed: string[] = []
        const changed: string[] = []
        const items: CartItem[] = []
        for (const i of get().items) {
          const p = byId.get(i.productId)
          const limit = p ? lineLimit(items, i, p.stock_count) : 0
          if (!p || !p.in_stock || limit < 1) {
            removed.push(i.title)
            continue
          }
          const quantity = Math.min(i.quantity, limit)
          if (p.sale_price !== i.salePrice || quantity !== i.quantity) changed.push(p.title)
          items.push({
            ...i,
            title: p.title,
            teluguTitle: p.telugu_title,
            jewelleryType: p.jewellery_type,
            image: p.image,
            mrp: p.mrp,
            salePrice: p.sale_price,
            maxQty: p.stock_count,
            quantity,
          })
        }
        set({ items })
        return { removed, changed }
      },
    }),
    { name: 'ak-cart', partialize: (s) => ({ items: s.items }) },
  ),
)

/** Explains why fewer pieces than requested went into the bag, or null when everything was added. */
export function addLimitMessage(requested: number, added: number): string | null {
  if (added >= requested) return null
  const limits = `up to ${MAX_QTY_PER_PRODUCT} of one design and ${MAX_PIECES_PER_ORDER} pieces per order, within available stock`
  return added === 0
    ? `This is already the most you can add (${limits}). Message us on WhatsApp for bulk orders.`
    : `Only ${added} more could be added (${limits}).`
}

export const useCartCount = () => useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0))

export const toPricedLines = (items: CartItem[]): PricedLine[] =>
  items.map((i) => ({ mrp: i.mrp, sale_price: i.salePrice, quantity: i.quantity, product_id: i.productId, jewellery_type: i.jewelleryType }))
