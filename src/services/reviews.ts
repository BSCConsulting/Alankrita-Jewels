import { customerDb } from '@/lib/customerSession'
import { blobToDataUrl, optimizeImage } from '@/lib/media'
import { supabase } from '@/lib/supabase'
import type { Review, ReviewStatus } from '@/types'
import { commitMockDb, delay, mockDb, uid } from './mockDb'

export const REVIEW_PHOTO_BUCKET = 'review-photos'
export const REVIEW_RULES = { maxPhotos: 4, minBody: 10, maxBody: 1000, maxTitle: 80 } as const

// The reviewer's account id is not readable by the public, so every query lists its columns.
const PUBLIC_COLUMNS = 'id, product_id, rating, title, body, photos, display_name, status, created_at'

export interface RatingSummary {
  average: number
  count: number
}

const normalize = (row: Record<string, unknown>): Review => {
  const r = row as unknown as Review
  return { ...r, rating: Number(r.rating), photos: r.photos ?? [] }
}

/** Photos are stored as bucket paths ("<user id>/<file>"); mock mode keeps data URLs. */
export function reviewPhotoUrl(photo: string): string {
  if (/^(data:|https?:|\/)/.test(photo)) return photo
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${REVIEW_PHOTO_BUCKET}/${photo}`
}

export function summarize(reviews: Array<Pick<Review, 'rating'>>): RatingSummary {
  if (!reviews.length) return { average: 0, count: 0 }
  const total = reviews.reduce((sum, r) => sum + r.rating, 0)
  return { average: Math.round((total / reviews.length) * 10) / 10, count: reviews.length }
}

// ---------------------------------------------------------------------------
// Storefront
// ---------------------------------------------------------------------------
export async function fetchProductReviews(productId: string): Promise<Review[]> {
  if (!supabase) {
    await delay(80)
    return mockDb()
      .reviews.filter((r) => r.product_id === productId && r.status === 'approved')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  const { data, error } = await supabase
    .from('reviews')
    .select(PUBLIC_COLUMNS)
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []).map(normalize)
}

/** Best recent reviews with something to say, for the home page. */
export async function fetchFeaturedReviews(limit = 8): Promise<Review[]> {
  if (!supabase) {
    const products = new Map(mockDb().products.map((p) => [p.id, p]))
    return mockDb()
      .reviews.filter((r) => r.status === 'approved' && r.rating >= 4 && r.body.length >= 20)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((r) => {
        const p = products.get(r.product_id)
        return { ...r, product: p ? { title: p.title, slug: p.slug } : null }
      })
  }
  const { data, error } = await supabase
    .from('reviews')
    .select(`${PUBLIC_COLUMNS}, product:products(title, slug)`)
    .eq('status', 'approved')
    .gte('rating', 4)
    .order('created_at', { ascending: false })
    .limit(limit * 3)
  if (error) throw error
  return (data ?? [])
    .map(normalize)
    .filter((r) => r.body.length >= 20)
    .slice(0, limit)
}

let ratingsCache: Promise<Map<string, RatingSummary>> | null = null

/** Star rating per product for grids; one request per page load. */
export function fetchRatingSummaries(): Promise<Map<string, RatingSummary>> {
  ratingsCache ??= (async () => {
    let rows: Array<{ product_id: string; rating: number }>
    if (!supabase) {
      rows = mockDb().reviews.filter((r) => r.status === 'approved')
    } else {
      const { data, error } = await supabase.from('reviews').select('product_id, rating').eq('status', 'approved').limit(5000)
      if (error) throw error
      rows = (data ?? []).map((r) => ({ product_id: r.product_id as string, rating: Number(r.rating) }))
    }
    const byProduct = new Map<string, Array<{ rating: number }>>()
    for (const r of rows) byProduct.set(r.product_id, [...(byProduct.get(r.product_id) ?? []), r])
    return new Map([...byProduct].map(([id, list]) => [id, summarize(list)]))
  })()
  ratingsCache.catch(() => (ratingsCache = null))
  return ratingsCache
}

// ---------------------------------------------------------------------------
// Customer: write a review for a delivered piece
// ---------------------------------------------------------------------------
export interface ReviewInput {
  productId: string
  rating: number
  title: string
  body: string
  photos: File[]
}

const NOT_ELIGIBLE = 'You can review pieces from your delivered orders'

async function uploadReviewPhoto(userId: string, file: File): Promise<string> {
  const body = await optimizeImage(file, 1280, 0.82)
  if (!customerDb) return blobToDataUrl(await optimizeImage(file, 720, 0.75))
  const ext = body.type === 'image/webp' ? 'webp' : body.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${uid()}.${ext}`
  const { error } = await customerDb.storage
    .from(REVIEW_PHOTO_BUCKET)
    .upload(path, body, { contentType: body.type || 'image/jpeg', cacheControl: '31536000', upsert: false })
  if (error) {
    // Storage refuses uploads from customers without a delivered order (or past their photo limit).
    throw new Error(/row-level security|unauthorized|403/i.test(error.message) ? 'Photos can be added once your order is delivered (up to 20 photos in total).' : 'Could not upload a photo. Please try a smaller one.')
  }
  return path
}

export async function submitReview(input: ReviewInput, user: { userId: string; phone: string }): Promise<Review> {
  if (input.photos.length > REVIEW_RULES.maxPhotos) throw new Error(`Please add up to ${REVIEW_RULES.maxPhotos} photos`)
  const photos = await Promise.all(input.photos.map((f) => uploadReviewPhoto(user.userId, f)))

  if (!customerDb) return submitMockReview(input, user, photos)

  const { data, error } = await customerDb.rpc('submit_review', {
    p_product_id: input.productId,
    p_rating: input.rating,
    p_title: input.title,
    p_body: input.body,
    p_photos: photos,
  })
  if (error) {
    if (error.code === '42501') throw new Error(NOT_ELIGIBLE)
    throw error
  }
  ratingsCache = null
  return normalize(data as Record<string, unknown>)
}

async function submitMockReview(input: ReviewInput, user: { userId: string; phone: string }, photos: string[]): Promise<Review> {
  await delay(150)
  const db = mockDb()
  const order = db.orders
    .filter((o) => o.customer_phone === user.phone && o.order_status === 'DELIVERED' && o.items?.some((i) => i.product_id === input.productId))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  if (!order) throw new Error(NOT_ELIGIBLE)
  const body = input.body.trim()
  if (input.rating < 1 || input.rating > 5) throw new Error('Please choose a rating from 1 to 5 stars')
  if (body.length < REVIEW_RULES.minBody) throw new Error('Please write at least a sentence about the piece')

  const firstName = order.customer_name.trim().split(/\s+/)[0] ?? ''
  const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
  const city = order.shipping_address.city?.trim()
  const fields = {
    rating: input.rating,
    title: input.title.trim().slice(0, REVIEW_RULES.maxTitle) || null,
    body: body.slice(0, REVIEW_RULES.maxBody),
    photos,
    display_name: titleCase(firstName) + (city ? `, ${titleCase(city)}` : ''),
    status: 'pending' as const,
  }
  const existing = db.reviews.find((r) => r.product_id === input.productId && r.user_id === user.userId)
  const review: Review = existing
    ? Object.assign(existing, fields)
    : { id: uid(), product_id: input.productId, user_id: user.userId, created_at: new Date().toISOString(), ...fields }
  if (!existing) db.reviews.push(review)
  commitMockDb()
  ratingsCache = null
  return review
}

/** The signed-in customer's reviews that are still waiting or were not published (their own rows only). */
export async function fetchMyUnpublishedReviews(userId: string | null): Promise<Map<string, ReviewStatus>> {
  if (!userId) return new Map()
  if (!customerDb) {
    return new Map(mockDb().reviews.filter((r) => r.user_id === userId && r.status !== 'approved').map((r) => [r.product_id, r.status]))
  }
  // Row security only shows other people's reviews once approved, so non-approved rows are this customer's.
  const { data, error } = await customerDb.from('reviews').select('product_id, status').neq('status', 'approved')
  if (error) return new Map()
  return new Map((data ?? []).map((r) => [r.product_id as string, r.status as ReviewStatus]))
}

// ---------------------------------------------------------------------------
// Admin moderation
// ---------------------------------------------------------------------------
export async function listReviewsForAdmin(status: ReviewStatus): Promise<Review[]> {
  if (!supabase) {
    await delay(80)
    const products = new Map(mockDb().products.map((p) => [p.id, p]))
    return mockDb()
      .reviews.filter((r) => r.status === status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => {
        const p = products.get(r.product_id)
        return { ...r, product: p ? { title: p.title, slug: p.slug } : null }
      })
  }
  const { data, error } = await supabase
    .from('reviews')
    .select(`${PUBLIC_COLUMNS}, product:products(title, slug)`)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(normalize)
}

export async function countPendingReviews(): Promise<number> {
  if (!supabase) return mockDb().reviews.filter((r) => r.status === 'pending').length
  const { count, error } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (error) return 0
  return count ?? 0
}

export async function setReviewStatus(id: string, status: ReviewStatus): Promise<void> {
  if (!supabase) {
    const review = mockDb().reviews.find((r) => r.id === id)
    if (review) review.status = status
    commitMockDb()
    ratingsCache = null
    return
  }
  const { data, error } = await supabase.from('reviews').update({ status }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Your admin session has expired. Please sign in again.')
  ratingsCache = null
}

export async function deleteReview(review: Review): Promise<void> {
  if (!supabase) {
    const db = mockDb()
    db.reviews = db.reviews.filter((r) => r.id !== review.id)
    commitMockDb()
    ratingsCache = null
    return
  }
  const { data, error } = await supabase.from('reviews').delete().eq('id', review.id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Your admin session has expired. Please sign in again.')
  const paths = review.photos.filter((p) => !/^(data:|https?:|\/)/.test(p))
  if (paths.length) await supabase.storage.from(REVIEW_PHOTO_BUCKET).remove(paths)
  ratingsCache = null
}
