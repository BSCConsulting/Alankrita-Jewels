// POST /api/payments/verify
// { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }  — live Razorpay
// { orderId, mock: true }                                                  — dev only (ALLOW_MOCK_PAYMENTS=true)
import type { Env } from '../../_lib/env'
import { error, hmacSha256Hex, json, readJson, safeEqual } from '../../_lib/http'
import { alertPaid, alertRefundNeeded } from '../../_lib/alerts'
import { fetchOrder, getUserId, hasSupabase, isPayable, markOrderPaid } from '../../_lib/supabase'

const CANCELLED_MESSAGE = 'This order was cancelled before your payment was confirmed. Please contact us on WhatsApp for a refund.'

interface VerifyBody {
  orderId: string
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  mock: boolean
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const body = await readJson<VerifyBody>(request)
  if (!body.orderId) return error('orderId is required', 400)

  // Nothing to persist server-side when the storefront runs on the local mock database.
  if (!hasSupabase(env)) return json({ ok: true, mode: 'mock' })

  const userId = await getUserId(env, request)
  if (!userId) return error('Please verify your mobile number again', 401)
  const order = await fetchOrder(env, body.orderId)
  if (!order || order.user_id !== userId) return error('Order not found', 404)
  if (order.payment_status === 'PAID' || order.payment_status === 'PARTIAL_PAID') return json({ ok: true, alreadyPaid: true })

  const razorpayLive = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)

  if (body.mock) {
    if (razorpayLive || env.ALLOW_MOCK_PAYMENTS !== 'true') return error('Mock payments are disabled', 403)
    if (!isPayable(order) || !(await markOrderPaid(env, order, `mock_${Date.now()}`))) return error('This order was cancelled', 409)
    return json({ ok: true, mode: 'mock' })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body
  if (!razorpayLive || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return error('Invalid payment payload', 400)
  if (order.payment_gateway_ref !== razorpay_order_id) return error('Payment does not match this order', 400)

  const expected = await hmacSha256Hex(env.RAZORPAY_KEY_SECRET!, `${razorpay_order_id}|${razorpay_payment_id}`)
  if (!safeEqual(expected, razorpay_signature)) return error('Payment signature verification failed', 400)

  if (await markOrderPaid(env, order, `${razorpay_order_id}/${razorpay_payment_id}`)) {
    waitUntil(alertPaid(env, order, razorpay_payment_id))
    return json({ ok: true, mode: 'live' })
  }

  const current = await fetchOrder(env, order.id)
  if (current?.payment_status === 'PAID' || current?.payment_status === 'PARTIAL_PAID') return json({ ok: true, alreadyPaid: true })
  console.error(`REFUND NEEDED: payment ${razorpay_payment_id} captured for unpayable order ${order.order_number}`)
  waitUntil(alertRefundNeeded(env, order.order_number, razorpay_payment_id))
  return error(CANCELLED_MESSAGE, 409)
}
