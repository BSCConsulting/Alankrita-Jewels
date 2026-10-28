import { groupTaxonomyMatches, productMatches, rankResults, searchGroups } from '@/lib/search'
import { supabase } from '@/lib/supabase'
import type { Category, JewelleryType, Product, ProductMedia } from '@/types'
import { delay, mockDb, withCategory } from './mockDb'

export const PRODUCT_SELECT = '*, category:categories(*), media:product_media(*)'

export function normalizeProduct(row: Record<string, unknown>): Product {
  const p = row as unknown as Product
  return {
    ...p,
    mrp: Number(p.mrp),
    sale_price: Number(p.sale_price),
    available_sizes: p.available_sizes ?? [],
    occasions: p.occasions ?? [],
    stones: p.stones ?? [],
    media: [...((p.media ?? []) as ProductMedia[])].sort((a, b) => a.display_order - b.display_order),
  }
}

let categoriesCache: Promise<Category[]> | null = null

export function fetchCategories(force = false): Promise<Category[]> {
  if (!categoriesCache || force) {
    categoriesCache = (async () => {
      if (!supabase) {
        await delay(50)
        return [...mockDb().categories].sort((a, b) => a.display_order - b.display_order)
      }
      const { data, error } = await supabase.from('categories').select('*').order('display_order')
      if (error) throw error
      return data as Category[]
    })()
    categoriesCache.catch(() => (categoriesCache = null))
  }
  return categoriesCache
}

export async function fetchCategoryBySlug(slug: string): Promise<Category | null> {
  return (await fetchCategories()).find((c) => c.slug === slug) ?? null
}

/** A category plus all of its sub-categories (e.g. 1 Gram Gold → Vaddanam, Nallapusalu, Chokers). */
async function categoryTreeIds(slug: string): Promise<string[]> {
  const all = await fetchCategories()
  const root = all.find((c) => c.slug === slug)
  if (!root) return []
  return [root.id, ...all.filter((c) => c.parent_id === root.id).map((c) => c.id)]
}

export interface ProductQuery {
  categorySlug?: string
  featured?: boolean
  jewelleryTypes?: JewelleryType[]
  excludeId?: string
  limit?: number
}

export async function fetchProducts(query: ProductQuery = {}): Promise<Product[]> {
  const categoryIds = query.categorySlug ? await categoryTreeIds(query.categorySlug) : null
  if (categoryIds && categoryIds.length === 0) return []

  if (!supabase) {
    await delay()
    let rows = mockDb().products.map(withCategory)
    if (categoryIds) rows = rows.filter((p) => p.category_id && categoryIds.includes(p.category_id))
    if (query.featured) rows = rows.filter((p) => p.featured)
    if (query.jewelleryTypes) rows = rows.filter((p) => query.jewelleryTypes!.includes(p.jewellery_type))
    if (query.excludeId) rows = rows.filter((p) => p.id !== query.excludeId)
    rows.sort((a, b) => Number(b.featured) - Number(a.featured) || b.created_at.localeCompare(a.created_at))
    return query.limit ? rows.slice(0, query.limit) : rows
  }

  let q = supabase.from('products').select(PRODUCT_SELECT)
  if (categoryIds) q = q.in('category_id', categoryIds)
  if (query.featured) q = q.eq('featured', true)
  if (query.jewelleryTypes) q = q.in('jewellery_type', query.jewelleryTypes)
  if (query.excludeId) q = q.neq('id', query.excludeId)
  q = q.order('featured', { ascending: false }).order('created_at', { ascending: false })
  if (query.limit) q = q.limit(query.limit)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(normalizeProduct)
}

/** Every word must match the title, Telugu title, description, plating, category or jewellery type. */
export async function searchProducts(query: string, limit = 48): Promise<Product[]> {
  const groups = searchGroups(query)
  if (!groups.length) return []
  const categories = await fetchCategories()

  if (!supabase) {
    await delay(120)
    const rows = mockDb().products.map(withCategory).filter((p) => productMatches(p, groups, categories))
    return rankResults(rows, groups).slice(0, limit)
  }

  let q = supabase.from('products').select(PRODUCT_SELECT)
  for (const group of groups) {
    const { categoryIds, types } = groupTaxonomyMatches(group, categories)
    const clauses = group.flatMap((alt) =>
      ['title', 'telugu_title', 'description', 'plating_type'].map((col) => `${col}.ilike."*${alt}*"`),
    )
    if (categoryIds.length) clauses.push(`category_id.in.(${categoryIds.join(',')})`)
    if (types.length) clauses.push(`jewellery_type.in.(${types.join(',')})`)
    q = q.or(clauses.join(','))
  }
  const { data, error } = await q.limit(limit)
  if (error) throw error
  return rankResults((data ?? []).map(normalizeProduct), groups)
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  if (!supabase) {
    await delay()
    const product = mockDb().products.find((p) => p.slug === slug)
    return product ? withCategory(product) : null
  }
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('slug', slug).maybeSingle()
  if (error) throw error
  return data ? normalizeProduct(data) : null
}

/** Product ids bought together with this one in at least two real orders, most frequent first. */
export async function fetchBoughtTogether(productId: string): Promise<Map<string, number>> {
  if (!supabase) {
    const counts = new Map<string, number>()
    for (const o of mockDb().orders) {
      if (o.order_status === 'CANCELLED' || !o.items?.some((i) => i.product_id === productId)) continue
      for (const id of new Set(o.items.map((i) => i.product_id))) if (id && id !== productId) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return new Map([...counts].filter(([, n]) => n >= 2))
  }
  const { data, error } = await supabase.rpc('frequently_bought_with', { p_product_id: productId, p_limit: 8 })
  // Before migration 005 is installed the RPC is missing; recommendations fall back to catalogue rules.
  if (error) return new Map()
  return new Map((data as Array<{ product_id: string; orders_together: number }>).map((r) => [r.product_id, r.orders_together]))
}

export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return []
  if (!supabase) return mockDb().products.filter((p) => ids.includes(p.id)).map(withCategory)
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).in('id', ids)
  if (error) throw error
  return (data ?? []).map(normalizeProduct)
}

export const productImages = (p: Product) => p.media.filter((m) => m.media_type === 'image')
export const productThumbnail = (p: Product) =>
  (p.media.find((m) => m.is_thumbnail && m.media_type === 'image') ?? productImages(p)[0])?.url ?? '/favicon.svg'
/** Small grid image, falling back to the full photo for media uploaded before thumbnails existed. */
export const productThumbnailSmall = (p: Product) => {
  const m = p.media.find((x) => x.is_thumbnail && x.media_type === 'image') ?? productImages(p)[0]
  return m?.thumb_url ?? m?.url ?? '/favicon.svg'
}
export const productReel = (p: Product) => p.media.find((m) => m.media_type === 'video_reel')?.url ?? null
