import { blobToDataUrl, optimizeImage } from '@/lib/media'
import { STORAGE_BUCKET, supabase } from '@/lib/supabase'
import type { JewelleryType, MediaType, Order, OrderStatus, PaymentMode, PaymentStatus, Product, ProductMedia } from '@/types'
import { fetchCategories, normalizeProduct, PRODUCT_SELECT } from './catalog'
import { commitMockDb, delay, mockDb, uid, withCategory } from './mockDb'
import { normalizeOrder, ORDER_SELECT } from './orders'

// ---------------------------------------------------------------------------
// Admin session
// ---------------------------------------------------------------------------
const MOCK_ADMIN_KEY = 'ak-mock-admin'

export async function adminSignIn(email: string, password: string): Promise<void> {
  if (!supabase) {
    const passcode = import.meta.env.VITE_ADMIN_DEV_PASSCODE ?? 'alankrita-admin'
    if (password !== passcode) throw new Error('Invalid passcode')
    sessionStorage.setItem(MOCK_ADMIN_KEY, email || 'admin@local')
    return
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!(await currentAdminEmail())) {
    await supabase.auth.signOut()
    throw new Error('This account does not have admin access')
  }
}

export async function currentAdminEmail(): Promise<string | null> {
  if (!supabase) return sessionStorage.getItem(MOCK_ADMIN_KEY)
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  return profile?.role === 'admin' ? (data.user.email ?? data.user.phone ?? 'admin') : null
}

export async function adminSignOut() {
  sessionStorage.removeItem(MOCK_ADMIN_KEY)
  await supabase?.auth.signOut()
}

// ---------------------------------------------------------------------------
// Media upload
// ---------------------------------------------------------------------------
export async function uploadMedia(file: File, kind: MediaType): Promise<string> {
  const body = kind === 'image' ? await optimizeImage(file) : file
  if (!supabase) {
    // Mock mode: images persist as data URLs; reels are session-only object URLs.
    return kind === 'image' ? blobToDataUrl(body) : URL.createObjectURL(body)
  }
  const ext = kind === 'image' ? (body.type === 'image/webp' ? 'webp' : file.name.split('.').pop()) : file.name.split('.').pop()
  const path = `${kind === 'image' ? 'images' : 'reels'}/${new Date().getFullYear()}/${uid()}.${ext ?? 'bin'}`
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, body, { contentType: body.type || file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export interface ProductInput {
  title: string
  telugu_title: string | null
  slug: string
  description: string | null
  category_id: string
  mrp: number
  sale_price: number
  jewellery_type: JewelleryType
  plating_type: string | null
  warranty_details: string | null
  available_sizes: string[]
  stock_count: number
  in_stock: boolean
  featured: boolean
}

export interface MediaInput {
  media_type: MediaType
  url: string
  is_thumbnail: boolean
}

export async function listAdminProducts(): Promise<Product[]> {
  if (!supabase) {
    await delay(100)
    return mockDb().products.map(withCategory).sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeProduct)
}

export async function fetchAdminProduct(id: string): Promise<Product | null> {
  if (!supabase) {
    const p = mockDb().products.find((x) => x.id === id)
    return p ? withCategory(p) : null
  }
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? normalizeProduct(data) : null
}

/** Creates or updates a product and replaces its media list. */
export async function saveProduct(input: ProductInput, media: MediaInput[], id?: string): Promise<string> {
  const ordered = media.map((m, i) => ({ ...m, display_order: i }))

  if (!supabase) {
    await delay(200)
    const db = mockDb()
    if (db.products.some((p) => p.slug === input.slug && p.id !== id)) throw new Error(`Slug "${input.slug}" already exists`)
    const productId = id ?? uid()
    const mediaRows: ProductMedia[] = ordered.map((m) => ({ ...m, id: uid(), product_id: productId }))
    const existing = db.products.find((p) => p.id === productId)
    if (existing) Object.assign(existing, input, { media: mediaRows })
    else db.products.unshift({ ...input, id: productId, created_at: new Date().toISOString(), media: mediaRows })
    commitMockDb()
    return productId
  }

  const { data, error } = id
    ? await supabase.from('products').update(input).eq('id', id).select('id').single()
    : await supabase.from('products').insert(input).select('id').single()
  if (error) throw error
  const productId = data.id as string

  const { error: delError } = await supabase.from('product_media').delete().eq('product_id', productId)
  if (delError) throw delError
  if (ordered.length) {
    const { error: mediaError } = await supabase
      .from('product_media')
      .insert(ordered.map((m) => ({ ...m, product_id: productId })))
    if (mediaError) throw mediaError
  }
  return productId
}

export async function updateProductFlags(id: string, patch: Partial<Pick<Product, 'in_stock' | 'featured' | 'stock_count'>>) {
  if (!supabase) {
    const p = mockDb().products.find((x) => x.id === id)
    if (p) Object.assign(p, patch)
    commitMockDb()
    return
  }
  const { error } = await supabase.from('products').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteProduct(id: string) {
  if (!supabase) {
    const db = mockDb()
    db.products = db.products.filter((p) => p.id !== id)
    commitMockDb()
    return
  }
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function existingSlugs(): Promise<Set<string>> {
  if (!supabase) return new Set(mockDb().products.map((p) => p.slug))
  const { data, error } = await supabase.from('products').select('slug')
  if (error) throw error
  return new Set((data ?? []).map((r) => r.slug as string))
}

export interface BulkProductRow {
  product: ProductInput
  imageUrls: string[]
  reelUrl: string | null
}

/** Inserts validated CSV rows. Products go in one batch; media rows follow in a second batch. */
export async function bulkInsertProducts(rows: BulkProductRow[]): Promise<number> {
  const toMedia = (r: BulkProductRow): MediaInput[] => [
    ...r.imageUrls.map((url, i) => ({ media_type: 'image' as const, url, is_thumbnail: i === 0 })),
    ...(r.reelUrl ? [{ media_type: 'video_reel' as const, url: r.reelUrl, is_thumbnail: false }] : []),
  ]

  if (!supabase) {
    for (const r of rows) await saveProduct(r.product, toMedia(r))
    return rows.length
  }

  const { data, error } = await supabase
    .from('products')
    .insert(rows.map((r) => r.product))
    .select('id, slug')
  if (error) throw error

  const idBySlug = new Map((data ?? []).map((d) => [d.slug as string, d.id as string]))
  const media = rows.flatMap((r) =>
    toMedia(r).map((m, i) => ({ ...m, display_order: i, product_id: idBySlug.get(r.product.slug)! })),
  )
  if (media.length) {
    const { error: mediaError } = await supabase.from('product_media').insert(media)
    if (mediaError) throw mediaError
  }
  return data?.length ?? 0
}

export { fetchCategories }

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export interface OrderFilters {
  paymentStatus: PaymentStatus | 'ALL'
  orderStatus: OrderStatus | 'ALL'
  paymentMode: PaymentMode | 'ALL'
  search: string
}

export async function listOrders(filters: OrderFilters): Promise<Order[]> {
  const term = filters.search.trim()
  if (!supabase) {
    await delay(150)
    return mockDb().orders.filter(
      (o) =>
        (filters.paymentStatus === 'ALL' || o.payment_status === filters.paymentStatus) &&
        (filters.orderStatus === 'ALL' || o.order_status === filters.orderStatus) &&
        (filters.paymentMode === 'ALL' || o.payment_mode === filters.paymentMode) &&
        (!term ||
          [o.order_number, o.customer_name, o.customer_phone, o.awb_number ?? ''].some((v) =>
            v.toLowerCase().includes(term.toLowerCase()),
          )),
    )
  }

  let q = supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(200)
  if (filters.paymentStatus !== 'ALL') q = q.eq('payment_status', filters.paymentStatus)
  if (filters.orderStatus !== 'ALL') q = q.eq('order_status', filters.orderStatus)
  if (filters.paymentMode !== 'ALL') q = q.eq('payment_mode', filters.paymentMode)
  if (term) {
    const safe = term.replace(/[,()%]/g, '')
    q = q.or(`order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_phone.ilike.%${safe}%,awb_number.ilike.%${safe}%`)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(normalizeOrder)
}

export type OrderPatch = Partial<
  Pick<Order, 'order_status' | 'payment_status' | 'advance_paid' | 'payment_gateway_ref' | 'shipping_provider' | 'awb_number' | 'tracking_url'>
>

export async function updateOrder(id: string, patch: OrderPatch): Promise<Order> {
  if (!supabase) {
    const db = mockDb()
    const order = db.orders.find((o) => o.id === id)
    if (!order) throw new Error('Order not found')
    if (patch.order_status === 'CANCELLED' && order.order_status !== 'CANCELLED') {
      for (const item of order.items ?? []) {
        const p = db.products.find((x) => x.id === item.product_id)
        if (p) {
          p.stock_count += item.quantity
          p.in_stock = true
        }
      }
    }
    Object.assign(order, patch)
    commitMockDb()
    return { ...order }
  }
  const { data, error } = await supabase.from('orders').update(patch).eq('id', id).select(ORDER_SELECT).single()
  if (error) throw error
  return normalizeOrder(data)
}

export interface DashboardStats {
  ordersToday: number
  revenue30d: number
  awaitingDispatch: number
  pendingPayment: number
  codBalanceOutstanding: number
  lowStock: Product[]
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [orders, products] = await Promise.all([
    listOrders({ paymentStatus: 'ALL', orderStatus: 'ALL', paymentMode: 'ALL', search: '' }),
    listAdminProducts(),
  ])
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const since30 = Date.now() - 30 * 86_400_000
  const live = orders.filter((o) => o.order_status !== 'CANCELLED')

  return {
    ordersToday: live.filter((o) => new Date(o.created_at) >= startOfDay).length,
    revenue30d: live
      .filter((o) => new Date(o.created_at).getTime() >= since30 && o.payment_status !== 'PENDING' && o.payment_status !== 'FAILED')
      .reduce((sum, o) => sum + o.final_amount, 0),
    awaitingDispatch: live.filter((o) => ['PLACED', 'CONFIRMED'].includes(o.order_status) && o.payment_status !== 'PENDING').length,
    pendingPayment: live.filter((o) => o.payment_status === 'PENDING').length,
    codBalanceOutstanding: live
      .filter((o) => o.order_status !== 'DELIVERED')
      .reduce((sum, o) => sum + o.balance_due_on_delivery, 0),
    lowStock: products.filter((p) => p.stock_count <= 3).slice(0, 6),
  }
}

export async function categoriesForSelect() {
  const all = await fetchCategories(true)
  return all
    .filter((c) => !c.parent_id)
    .flatMap((parent) => [
      { ...parent, label: parent.name },
      ...all.filter((c) => c.parent_id === parent.id).map((c) => ({ ...c, label: `— ${c.name}` })),
    ])
}
