import { PAYMENT_RULES } from '@/config/site'
import { computeTotals, paymentModeBlocker, type CouponRule } from '@/lib/pricing'
import { customerDb } from '@/lib/customerSession'
import type { Coupon, Order, OrderItem, PaymentMode, PaymentStatus, ShippingAddress } from '@/types'
import { commitMockDb, delay, mockDb, uid } from './mockDb'

export interface PlaceOrderInput {
  items: Array<{ product_id: string; quantity: number; selected_size: string | null }>
  customerName: string
  customerPhone: string
  address: ShippingAddress
  paymentMode: PaymentMode
  couponCode?: string | null
  giftCardCode?: string | null
  giftWrap?: boolean
  giftMessage?: string | null
  /** The shopper's unpaid order from an earlier attempt; it is cancelled so its stock and coupon are reused. */
  replacesOrderId?: string | null
}

export const ORDER_SELECT = '*, items:order_items(*)'

const NUMERIC_FIELDS = [
  'total_mrp',
  'subtotal',
  'discount_amount',
  'offer_discount',
  'prepaid_discount',
  'cod_fee',
  'gift_wrap_fee',
  'gift_card_amount',
  'final_amount',
  'advance_paid',
  'balance_due_on_delivery',
] as const

/** PostgREST returns numeric columns as strings; orders saved before migration 005 lack the newer fields. */
export function normalizeOrder(row: Record<string, unknown>): Order {
  const o = row as unknown as Order
  const numbers = Object.fromEntries(NUMERIC_FIELDS.map((f) => [f, Number(row[f] ?? 0)]))
  return {
    ...o,
    ...numbers,
    offer_label: o.offer_label ?? null,
    coupon_code: o.coupon_code ?? null,
    gift_wrap: Boolean(o.gift_wrap),
    gift_message: o.gift_message ?? null,
    free_gift: o.free_gift ?? null,
    delivered_at: o.delivered_at ?? null,
    items: (o.items ?? []).map((i) => ({ ...i, unit_price: Number(i.unit_price) })),
  }
}

/** Amount the customer pays online right now for this order (0 for full COD or a gift card that covers it). */
export const amountDueNow = (order: Pick<Order, 'payment_mode' | 'final_amount' | 'balance_due_on_delivery'>) =>
  Math.max(0, order.final_amount - order.balance_due_on_delivery)

export const normalizeCode = (code: string | null | undefined) => (code ?? '').trim().toUpperCase() || null

export type CodeCheck<T> = { valid: true; value: T } | { valid: false; message: string }

/** `phone` is only used in mock mode, where it stands in for the signed-in customer. */
export async function checkCoupon(code: string, phone: string | null = null): Promise<CodeCheck<CouponRule>> {
  const normalized = normalizeCode(code)
  if (!normalized) return { valid: false, message: 'Enter a coupon code' }
  if (customerDb) {
    const { data, error } = await customerDb.rpc('check_coupon', { p_code: normalized })
    if (error) throw error
    const r = data as { valid: boolean; message?: string } & CouponRule
    if (!r.valid) return { valid: false, message: r.message ?? 'This coupon code is not valid' }
    return {
      valid: true,
      value: {
        code: r.code,
        kind: r.kind,
        value: Number(r.value),
        min_subtotal: Number(r.min_subtotal),
        max_discount: r.max_discount == null ? null : Number(r.max_discount),
        description: r.description ?? null,
      },
    }
  }
  await delay(150)
  const coupon = mockDb().coupons.find((c) => c.code === normalized)
  if (!coupon) return { valid: false, message: 'This coupon code is not valid' }
  const problem = mockCouponProblem(coupon, phone)
  return problem ? { valid: false, message: problem } : { valid: true, value: coupon }
}

export async function checkGiftCard(code: string): Promise<CodeCheck<{ code: string; balance: number }>> {
  const normalized = normalizeCode(code)
  if (!normalized) return { valid: false, message: 'Enter a gift card code' }
  if (customerDb) {
    const { data, error } = await customerDb.rpc('check_gift_card', { p_code: normalized })
    if (error) throw error
    const r = data as { valid: boolean; message?: string; code: string; balance: number }
    if (!r.valid) return { valid: false, message: r.message ?? 'This gift card is not valid or has no balance left' }
    return { valid: true, value: { code: r.code, balance: Number(r.balance) } }
  }
  await delay(150)
  const card = mockUsableGiftCard(normalized)
  return card ? { valid: true, value: { code: card.code, balance: card.balance } } : { valid: false, message: 'This gift card is not valid or has no balance left' }
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (customerDb) {
    const { data, error } = await customerDb.rpc('place_order', {
      p_items: input.items,
      p_customer_name: input.customerName,
      p_shipping_address: input.address,
      p_payment_mode: input.paymentMode,
      p_coupon_code: normalizeCode(input.couponCode),
      p_gift_card_code: normalizeCode(input.giftCardCode),
      p_gift_wrap: Boolean(input.giftWrap),
      p_gift_message: input.giftMessage?.trim() || null,
      p_replaces_order_id: input.replacesOrderId ?? null,
    })
    if (error) throw error
    return normalizeOrder(data as Record<string, unknown>)
  }
  return placeMockOrder(input)
}

// ---------------------------------------------------------------------------
// Mock mode: same rules as place_order() in supabase/migrations/005_growth_features.sql.
// In mock mode the verified phone number stands in for the customer account.
// ---------------------------------------------------------------------------

const liveOrders = (phone: string | null) => mockDb().orders.filter((o) => o.order_status !== 'CANCELLED' && (phone === null || o.customer_phone === phone))

function mockCouponProblem(c: Coupon, phone: string | null): string | null {
  const now = Date.now()
  if (!c.active) return 'This coupon is no longer active'
  if (c.starts_at && now < Date.parse(c.starts_at)) return 'This coupon is not active yet'
  if (c.ends_at && now > Date.parse(c.ends_at)) return 'This coupon has expired'
  if (c.usage_limit != null && liveOrders(null).filter((o) => o.coupon_code === c.code).length >= c.usage_limit) return 'This coupon has been fully redeemed'
  if (phone === null) return null
  const mine = liveOrders(phone)
  if (mine.filter((o) => o.coupon_code === c.code).length >= c.per_customer_limit) return 'You have already used this coupon'
  if (c.first_order_only && mine.length > 0) return 'This coupon is for your first order only'
  return null
}

function mockUsableGiftCard(code: string) {
  const card = mockDb().giftCards.find((g) => g.code === code)
  if (!card || !card.active || card.balance <= 0 || (card.expires_at && Date.now() > Date.parse(card.expires_at))) return null
  return card
}

/** Mock-mode counterpart of the restock and gift-card release triggers that run when an order is cancelled. */
export function releaseMockOrderHolds(order: Order) {
  const db = mockDb()
  for (const item of order.items ?? []) {
    const product = db.products.find((p) => p.id === item.product_id)
    if (product) {
      // Like restock_cancelled_order(): a piece the admin switched off by hand stays off.
      product.in_stock = product.in_stock || product.stock_count === 0
      product.stock_count += item.quantity
    }
  }
  if (order.gift_card_amount > 0) {
    const card = db.giftCards.find((g) => g.id === order.gift_card_id)
    if (card) card.balance = Math.min(card.initial_amount, card.balance + order.gift_card_amount)
  }
}

function cancelMockOrder(order: Order) {
  if (order.order_status === 'CANCELLED') return
  releaseMockOrderHolds(order)
  order.order_status = 'CANCELLED'
  order.payment_status = 'FAILED'
}

async function placeMockOrder(input: PlaceOrderInput): Promise<Order> {
  await delay(400)
  const db = mockDb()
  const phone = input.customerPhone
  const snapshot = JSON.stringify(db)
  try {
    return buildMockOrder(input, phone)
  } catch (e) {
    // Undo a replaced order's cancellation (and anything else) when the new order fails, like the database rollback.
    Object.assign(db, JSON.parse(snapshot))
    throw e
  }
}

function buildMockOrder(input: PlaceOrderInput, phone: string): Order {
  const db = mockDb()
  if (input.replacesOrderId) {
    const previous = db.orders.find(
      (o) => o.id === input.replacesOrderId && o.customer_phone === phone && o.payment_status === 'PENDING' && o.order_status === 'PLACED' && o.payment_mode !== 'COD',
    )
    if (previous) cancelMockOrder(previous)
  }

  const unpaid = liveOrders(phone).filter((o) => o.payment_status === 'PENDING' && o.order_status === 'PLACED' && o.payment_mode !== 'COD')
  if (unpaid.length >= 3) {
    throw new Error('You already have 3 orders awaiting payment. Please pay for them or message us on WhatsApp before placing another.')
  }
  if (input.paymentMode === 'COD') {
    const openCod = liveOrders(phone).filter((o) => o.payment_mode === 'COD' && o.payment_status === 'PENDING' && o.order_status !== 'DELIVERED')
    if (openCod.length >= PAYMENT_RULES.maxOpenCodOrders) {
      throw new Error(`You already have ${PAYMENT_RULES.maxOpenCodOrders} cash-on-delivery orders on the way. Please pay online for this one.`)
    }
  }

  const couponCode = normalizeCode(input.couponCode)
  let coupon: Coupon | null = null
  if (couponCode) {
    coupon = db.coupons.find((c) => c.code === couponCode) ?? null
    if (!coupon) throw new Error('This coupon code is not valid')
    const problem = mockCouponProblem(coupon, phone)
    if (problem) throw new Error(problem)
  }

  const orderId = uid()
  const lines = input.items.map((item) => {
    const product = db.products.find((p) => p.id === item.product_id)
    if (!product) throw new Error('A product in your bag is no longer available')
    if (!product.in_stock || product.stock_count < item.quantity) throw new Error(`${product.title} is out of stock`)
    if (product.available_sizes.length && !product.available_sizes.includes(item.selected_size ?? '')) {
      throw new Error(`Please choose a valid size for ${product.title}`)
    }
    return { product, item }
  })

  const priced = lines.map(({ product, item }) => ({
    mrp: product.mrp,
    sale_price: product.sale_price,
    quantity: item.quantity,
    product_id: product.id,
    jewellery_type: product.jewellery_type,
  }))
  const before = computeTotals(priced, input.paymentMode, { coupon, giftWrap: input.giftWrap })

  const cardCode = normalizeCode(input.giftCardCode)
  const card = cardCode ? mockUsableGiftCard(cardCode) : null
  if (cardCode && !card) throw new Error('This gift card is not valid or has no balance left')
  const totals = computeTotals(priced, input.paymentMode, { coupon, giftWrap: input.giftWrap, giftCardBalance: card?.balance ?? 0 })
  if (before.orderTotal <= 0) throw new Error('This order total is not valid. Please contact us on WhatsApp.')
  const blocker = paymentModeBlocker(input.paymentMode, totals)
  if (blocker) throw new Error(blocker)

  const items: OrderItem[] = lines.map(({ product, item }) => {
    product.stock_count -= item.quantity
    product.in_stock = product.stock_count > 0
    return {
      id: uid(),
      order_id: orderId,
      product_id: product.id,
      product_title: product.title,
      quantity: item.quantity,
      unit_price: product.sale_price,
      selected_size: item.selected_size,
    }
  })
  if (card) card.balance -= totals.giftCardAmount

  let orderNumber: string
  do orderNumber = `ALK-${Math.floor(10000 + Math.random() * 90000)}`
  while (db.orders.some((o) => o.order_number === orderNumber))

  const settledByCard = totals.finalAmount === 0 && totals.giftCardAmount > 0
  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    user_id: null,
    customer_phone: phone,
    customer_name: input.customerName.trim(),
    shipping_address: input.address,
    total_mrp: totals.totalMrp,
    subtotal: totals.subtotal,
    discount_amount: totals.discountAmount,
    offer_label: totals.offer?.label ?? null,
    offer_discount: totals.offer?.amount ?? 0,
    prepaid_discount: totals.prepaidDiscount,
    coupon_code: totals.offer?.kind === 'coupon' ? coupon!.code : null,
    cod_fee: totals.codFee,
    gift_wrap: Boolean(input.giftWrap),
    gift_wrap_fee: totals.giftWrapFee,
    gift_message: input.giftMessage?.trim() || null,
    gift_card_id: card && totals.giftCardAmount > 0 ? card.id : null,
    gift_card_amount: totals.giftCardAmount,
    free_gift: totals.freeGift,
    final_amount: totals.finalAmount,
    payment_mode: input.paymentMode,
    advance_paid: 0,
    balance_due_on_delivery: totals.balanceOnDelivery,
    payment_gateway_ref: null,
    payment_status: settledByCard ? 'PAID' : 'PENDING',
    order_status: settledByCard ? 'CONFIRMED' : 'PLACED',
    shipping_provider: null,
    awb_number: null,
    tracking_url: null,
    delivered_at: null,
    created_at: new Date().toISOString(),
    items,
  }
  db.orders.unshift(order)
  commitMockDb()
  return order
}

/** Mock-mode only: the Pages Function performs this update (with signature checks) in production. */
export async function markMockOrderPaid(orderId: string, gatewayRef: string): Promise<void> {
  const order = mockDb().orders.find((o) => o.id === orderId)
  if (!order) return
  const status: PaymentStatus = order.payment_mode === 'PARTIAL_COD' ? 'PARTIAL_PAID' : 'PAID'
  Object.assign(order, {
    payment_status: status,
    advance_paid: amountDueNow(order),
    payment_gateway_ref: gatewayRef,
    order_status: 'CONFIRMED',
  } satisfies Partial<Order>)
  commitMockDb()
}

/** The signed-in customer's orders, newest first. RLS limits rows to the customer's own orders. */
export async function fetchMyOrders(phone: string | null): Promise<Order[]> {
  if (!customerDb) {
    await delay(150)
    return mockDb()
      .orders.filter((o) => o.customer_phone === phone)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((o) => normalizeOrder(o as unknown as Record<string, unknown>))
  }
  const { data, error } = await customerDb.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []).map(normalizeOrder)
}

export async function fetchOrderByNumber(orderNumber: string): Promise<Order | null> {
  if (!customerDb) {
    await delay(100)
    const order = mockDb().orders.find((o) => o.order_number === orderNumber)
    return order ? normalizeOrder(order as unknown as Record<string, unknown>) : null
  }
  const { data, error } = await customerDb.from('orders').select(ORDER_SELECT).eq('order_number', orderNumber).maybeSingle()
  if (error) throw error
  return data ? normalizeOrder(data) : null
}
