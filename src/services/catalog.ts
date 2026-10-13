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
export const productReel = (p: Product) => p.media.find((m) => m.media_type === 'video_reel')?.url ?? null
