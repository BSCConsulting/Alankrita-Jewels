// Minimal Supabase REST client using the service-role key. Server-side only — bypasses RLS.
import type { Env } from './env'
import { error } from './http'
import { verifyHs256 } from './jwt'

export interface OrderRow {
  id: string
  order_number: string
  user_id: string | null
  customer_name: string
  customer_phone: string
  shipping_address: { address_line: string; landmark?: string; city: string; state: string; pincode: string }
  final_amount: number
  payment_mode: 'PREPAID_UPI' | 'PARTIAL_COD' | 'COD'
  balance_due_on_delivery: number
  advance_paid: number
  cod_fee?: number
  gift_wrap?: boolean
  gift_message?: string | null
  free_gift?: string | null
  offer_label?: string | null
  payment_status: 'PENDING' | 'PAID' | 'PARTIAL_PAID' | 'FAILED'
  order_status: 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'
  payment_gateway_ref: string | null
  awb_number?: string | null
  created_at?: string
  items?: Array<{ id: string; product_id: string | null; product_title: string; quantity: number; unit_price: number }>
}

export const hasSupabase = (env: Env) => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)

export async function rest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

export async function getUserId(env: Env, request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  if (env.SUPABASE_JWT_SECRET) {
    const claims = await verifyHs256(token, env.SUPABASE_JWT_SECRET)
    if (claims) return claims.aud === 'authenticated' && typeof claims.sub === 'string' ? claims.sub : null
  }
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const user = (await res.json()) as { id?: string }
  return user.id ?? null
}

/**
 * Admin gate for logistics/notification endpoints. Without Supabase configured we only allow
 * calls while the provider itself is mocked, so a misconfigured deploy can't expose live couriers.
 */
export async function requireAdmin(env: Env, request: Request, providerIsLive: boolean): Promise<Response | null> {
  if (!hasSupabase(env)) {
    return providerIsLive ? error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for live providers', 503) : null
  }
  const userId = await getUserId(env, request)
  if (!userId) return error('Sign in required', 401)
  const rows = await rest<Array<{ role: string }>>(env, `profiles?id=eq.${userId}&select=role`)
  return rows[0]?.role === 'admin' ? null : error('Admin access required', 403)
}

export async function fetchOrder(env: Env, orderId: string): Promise<OrderRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null
  const rows = await rest<OrderRow[]>(env, `orders?id=eq.${orderId}&select=*,items:order_items(*)`)
  return rows[0] ?? null
}

/** Amount payable online now: the advance for partial COD, nothing for full COD. */
export const amountDueNow = (o: Pick<OrderRow, 'payment_mode' | 'final_amount' | 'balance_due_on_delivery'>) =>
  o.payment_mode === 'PREPAID_UPI' ? Number(o.final_amount) : Number(o.final_amount) - Number(o.balance_due_on_delivery)

/** An order can take a payment only while it is unpaid and has not been cancelled or shipped. */
export const isPayable = (o: Pick<OrderRow, 'payment_status' | 'order_status'>) =>
  o.payment_status === 'PENDING' && (o.order_status === 'PLACED' || o.order_status === 'CONFIRMED')

/**
 * Idempotent: only transitions orders that are still payable. Returns false when nothing was updated,
 * e.g. the order was cancelled (or already paid) between the checkout and the payment confirmation.
 */
export async function markOrderPaid(env: Env, order: OrderRow, gatewayRef: string): Promise<boolean> {
  const rows = await rest<OrderRow[]>(env, `orders?id=eq.${order.id}&payment_status=eq.PENDING&order_status=in.(PLACED,CONFIRMED)`, {
    method: 'PATCH',
    body: JSON.stringify({
      payment_status: order.payment_mode === 'PARTIAL_COD' ? 'PARTIAL_PAID' : 'PAID',
      advance_paid: amountDueNow(order),
      order_status: 'CONFIRMED',
      payment_gateway_ref: gatewayRef,
    }),
  })
  return rows.length > 0
}

export type SettleOutcome = 'paid' | 'already_paid' | 'refund_needed'

/**
 * Records a captured Razorpay payment. The browser's /verify call and the webhook race each other,
 * so when the update loses we re-read the order: if this same payment already settled it there is
 * nothing to do; otherwise (cancelled order, or a second payment for a paid order) it needs a refund.
 */
export async function settleCapturedPayment(env: Env, order: OrderRow, rzpOrderId: string, paymentId: string): Promise<SettleOutcome> {
  const ref = `${rzpOrderId}/${paymentId}`
  const paid = (o: OrderRow) => o.payment_status === 'PAID' || o.payment_status === 'PARTIAL_PAID'
  if (!paid(order) && (await markOrderPaid(env, order, ref))) return 'paid'
  const current = paid(order) ? order : await fetchOrder(env, order.id)
  return current && paid(current) && current.payment_gateway_ref === ref ? 'already_paid' : 'refund_needed'
}
