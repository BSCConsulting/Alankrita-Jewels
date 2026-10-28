// Local, persistent stand-in for Supabase so the full storefront + admin works with zero setup.
// Seeded from the same catalog.json that generates supabase/seed.sql.
import catalog from '@/data/catalog.json'
import type { Category, Coupon, GiftCard, JewelleryType, Occasion, Order, Product, ProductMedia, Review, Stone, StockAlert, ThemeVariant } from '@/types'

interface MockState {
  categories: Category[]
  products: Product[]
  orders: Order[]
  coupons: Coupon[]
  giftCards: GiftCard[]
  reviews: Review[]
  stockAlerts: StockAlert[]
}

const STORAGE_KEY = 'ak-mockdb-v1'
let state: MockState | null = null

export const uid = () => crypto.randomUUID()
export const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

/** Same starter coupon as migration 005. */
const seedCoupons = (): Coupon[] => [
  {
    id: uid(),
    code: 'WELCOME10',
    description: '10% off your first order (up to ₹300) on ₹999+',
    kind: 'percent',
    value: 10,
    min_subtotal: 999,
    max_discount: 300,
    first_order_only: true,
    usage_limit: null,
    per_customer_limit: 1,
    starts_at: null,
    ends_at: null,
    active: true,
    created_at: new Date().toISOString(),
  },
]

function seed(): MockState {
  const categoryIdBySlug = new Map(catalog.categories.map((c) => [c.slug, c.id]))
  const categories: Category[] = catalog.categories.map((c) => ({
    id: c.id,
    name: c.name,
    telugu_name: c.telugu_name,
    slug: c.slug,
    parent_id: c.parent_slug ? (categoryIdBySlug.get(c.parent_slug) ?? null) : null,
    description: c.description,
    theme_default: c.theme_default as ThemeVariant,
    display_order: c.display_order,
  }))

  const products: Product[] = catalog.products.map((p, index) => {
    const image = (n: number): ProductMedia => ({
      id: uid(),
      product_id: p.id,
      media_type: 'image',
      url: `/products/${p.slug}-${n}.webp`,
      thumb_url: `/products/${p.slug}-${n}-w480.webp`,
      is_thumbnail: n === 1,
      display_order: n - 1,
    })
    const media: ProductMedia[] = [image(1), image(2)]
    if (p.reel) {
      media.push({ id: uid(), product_id: p.id, media_type: 'video_reel', url: catalog.sampleReelUrl, is_thumbnail: false, display_order: 2 })
    }
    return {
      id: p.id,
      title: p.title,
      telugu_title: p.telugu_title,
      slug: p.slug,
      description: p.description,
      category_id: categoryIdBySlug.get(p.category_slug) ?? null,
      mrp: p.mrp,
      sale_price: p.sale_price,
      jewellery_type: p.jewellery_type as JewelleryType,
      plating_type: p.plating_type,
      warranty_details: p.warranty_details,
      available_sizes: p.available_sizes,
      occasions: p.occasions as Occasion[],
      stones: p.stones as Stone[],
      in_stock: p.stock_count > 0,
      stock_count: p.stock_count,
      featured: p.featured,
      created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
      media,
    }
  })

  return { categories, products, orders: [], coupons: seedCoupons(), giftCards: [], reviews: [], stockAlerts: [] }
}

/** Brings a state saved by an older build up to the current shape. */
function upgrade(saved: Partial<MockState>): MockState {
  const fresh = seed()
  const tagsById = new Map(fresh.products.map((p) => [p.id, p]))
  return {
    categories: saved.categories ?? fresh.categories,
    products: (saved.products ?? fresh.products).map((p) => ({
      ...p,
      occasions: p.occasions ?? tagsById.get(p.id)?.occasions ?? [],
      stones: p.stones ?? tagsById.get(p.id)?.stones ?? [],
      media: p.media.map((m) => ({
        ...m,
        thumb_url: m.thumb_url ?? (/^\/products\/[a-z0-9-]+-\d\.webp$/.test(m.url) ? m.url.replace(/\.webp$/, '-w480.webp') : null),
      })),
    })),
    orders: saved.orders ?? [],
    coupons: saved.coupons ?? fresh.coupons,
    giftCards: saved.giftCards ?? [],
    reviews: saved.reviews ?? [],
    stockAlerts: saved.stockAlerts ?? [],
  }
}

export function mockDb(): MockState {
  if (!state) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      state = raw ? upgrade(JSON.parse(raw) as Partial<MockState>) : seed()
    } catch {
      state = seed()
    }
  }
  return state
}

export function commitMockDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockDb()))
  } catch {
    throw new Error('Local mock storage is full. Use smaller images or connect Supabase.')
  }
}

export function resetMockDb() {
  state = seed()
  commitMockDb()
}

export function withCategory(product: Product): Product {
  const category = mockDb().categories.find((c) => c.id === product.category_id) ?? null
  return { ...product, category, media: [...product.media].sort((a, b) => a.display_order - b.display_order) }
}
