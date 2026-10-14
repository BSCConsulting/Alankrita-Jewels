// Local, persistent stand-in for Supabase so the full storefront + admin works with zero setup.
// Seeded from the same catalog.json that generates supabase/seed.sql.
import catalog from '@/data/catalog.json'
import type { Category, Order, Product, ProductMedia, ThemeVariant, JewelleryType } from '@/types'

interface MockState {
  categories: Category[]
  products: Product[]
  orders: Order[]
}

const STORAGE_KEY = 'ak-mockdb-v1'
let state: MockState | null = null

export const uid = () => crypto.randomUUID()
export const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

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
    const media: ProductMedia[] = [
      { id: uid(), product_id: p.id, media_type: 'image', url: `/products/${p.slug}-1.webp`, is_thumbnail: true, display_order: 0 },
      { id: uid(), product_id: p.id, media_type: 'image', url: `/products/${p.slug}-2.webp`, is_thumbnail: false, display_order: 1 },
    ]
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
      in_stock: p.stock_count > 0,
      stock_count: p.stock_count,
      featured: p.featured,
      created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
      media,
    }
  })

  return { categories, products, orders: [] }
}

export function mockDb(): MockState {
  if (!state) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      state = raw ? (JSON.parse(raw) as MockState) : seed()
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
