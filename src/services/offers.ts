import { supabase } from '@/lib/supabase'
import type { Coupon, GiftCard } from '@/types'
import { commitMockDb, delay, mockDb, uid } from './mockDb'

const SESSION_EXPIRED = 'Your admin session has expired. Please sign in again.'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export interface CouponInput {
  code: string
  description: string | null
  kind: 'percent' | 'flat'
  value: number
  min_subtotal: number
  max_discount: number | null
  first_order_only: boolean
  usage_limit: number | null
  per_customer_limit: number
  ends_at: string | null
}

/** Same rules as the coupons table checks in migration 005, so admins see the problem before saving. */
export function couponProblem(c: CouponInput): string | null {
  if (!/^[A-Z0-9]{3,20}$/.test(c.code)) return 'Code must be 3–20 capital letters or digits, no spaces'
  if (!(c.value > 0)) return 'Discount must be more than 0'
  if (c.kind === 'percent' && c.value > 50) return 'Percentage discounts can be at most 50%'
  if (c.kind === 'flat' && c.min_subtotal > 0 && c.value >= c.min_subtotal) return 'A flat discount must be less than the minimum order value'
  if (c.min_subtotal < 0) return 'Minimum order value cannot be negative'
  if (c.max_discount !== null && !(c.max_discount > 0)) return 'Maximum discount must be more than 0, or left empty'
  if (c.usage_limit !== null && !(c.usage_limit > 0)) return 'Total uses must be more than 0, or left empty'
  if (!(c.per_customer_limit > 0)) return 'Uses per customer must be at least 1'
  if (c.ends_at && new Date(c.ends_at) <= new Date()) return 'End date must be in the future'
  if ((c.description ?? '').length > 120) return 'Description can be at most 120 characters'
  return null
}

export async function listCoupons(): Promise<Coupon[]> {
  if (!supabase) {
    await delay(80)
    const used = new Map<string, number>()
    for (const o of mockDb().orders) {
      if (o.coupon_code && o.order_status !== 'CANCELLED') used.set(o.coupon_code, (used.get(o.coupon_code) ?? 0) + 1)
    }
    return [...mockDb().coupons].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((c) => ({ ...c, times_used: used.get(c.code) ?? 0 }))
  }
  const [coupons, usage] = await Promise.all([
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    supabase.from('orders').select('coupon_id').not('coupon_id', 'is', null).neq('order_status', 'CANCELLED').limit(10000),
  ])
  if (coupons.error) throw coupons.error
  const used = new Map<string, number>()
  for (const r of usage.data ?? []) used.set(r.coupon_id as string, (used.get(r.coupon_id as string) ?? 0) + 1)
  return (coupons.data ?? []).map((c) => ({
    ...(c as Coupon),
    value: Number(c.value),
    min_subtotal: Number(c.min_subtotal),
    max_discount: num(c.max_discount),
    times_used: used.get(c.id as string) ?? 0,
  }))
}

export async function createCoupon(input: CouponInput): Promise<void> {
  const problem = couponProblem(input)
  if (problem) throw new Error(problem)
  if (!supabase) {
    const db = mockDb()
    if (db.coupons.some((c) => c.code === input.code)) throw new Error('A coupon with this code already exists')
    db.coupons.push({ ...input, id: uid(), starts_at: null, active: true, created_at: new Date().toISOString() })
    commitMockDb()
    return
  }
  const { error } = await supabase.from('coupons').insert(input)
  if (error) throw error.code === '23505' ? new Error('A coupon with this code already exists') : error
}

export async function setCouponActive(id: string, active: boolean): Promise<void> {
  if (!supabase) {
    const c = mockDb().coupons.find((x) => x.id === id)
    if (c) c.active = active
    commitMockDb()
    return
  }
  const { data, error } = await supabase.from('coupons').update({ active }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(SESSION_EXPIRED)
}

// ---------------------------------------------------------------------------
// Gift cards
// ---------------------------------------------------------------------------
// 32 symbols without look-alikes (0/O, 1/I): a random byte maps onto it with no bias.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 12 random characters (60 bits): far beyond guessing, even before the 10-attempts-per-hour limit. */
export function generateGiftCardCode(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return [...bytes].map((b) => CODE_ALPHABET[b % 32]).join('')
}

export { formatGiftCardCode } from '@/lib/format'

export interface GiftCardInput {
  amount: number
  recipient_name: string | null
  note: string | null
  expires_at: string | null
}

export async function listGiftCards(): Promise<GiftCard[]> {
  if (!supabase) {
    await delay(80)
    return [...mockDb().giftCards].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  const { data, error } = await supabase.from('gift_cards').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return (data ?? []).map((g) => ({ ...(g as GiftCard), initial_amount: Number(g.initial_amount), balance: Number(g.balance) }))
}

export async function createGiftCard(input: GiftCardInput): Promise<GiftCard> {
  if (!(input.amount >= 100 && input.amount <= 50000)) throw new Error('Gift card value must be between ₹100 and ₹50,000')
  if (input.expires_at && new Date(input.expires_at) <= new Date()) throw new Error('Expiry date must be in the future')
  const row = {
    code: generateGiftCardCode(),
    initial_amount: Math.round(input.amount),
    balance: Math.round(input.amount),
    recipient_name: input.recipient_name?.trim().slice(0, 80) || null,
    note: input.note?.trim().slice(0, 200) || null,
    expires_at: input.expires_at,
  }
  if (!supabase) {
    const card: GiftCard = { ...row, id: uid(), active: true, created_at: new Date().toISOString() }
    mockDb().giftCards.push(card)
    commitMockDb()
    return card
  }
  const { data, error } = await supabase.from('gift_cards').insert(row).select('*').single()
  if (error) throw error
  return { ...(data as GiftCard), initial_amount: Number(data.initial_amount), balance: Number(data.balance) }
}

export async function setGiftCardActive(id: string, active: boolean): Promise<void> {
  if (!supabase) {
    const g = mockDb().giftCards.find((x) => x.id === id)
    if (g) g.active = active
    commitMockDb()
    return
  }
  const { data, error } = await supabase.from('gift_cards').update({ active }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(SESSION_EXPIRED)
}
