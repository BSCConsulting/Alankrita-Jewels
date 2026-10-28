// POST /api/payments/verify
// { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }  — live Razorpay
// { orderId, mock: true }                                                  — dev only (ALLOW_MOCK_PAYMENTS=true)
import { mockPaymentsAllowed, type Env } from '../../_lib/env'
import { error, hmacSha256Hex, json, readJson, safeEqual } from '../../_lib/http'
import { alertPaid, alertRefundNeeded } from '../../_lib/alerts'
import { fetchOrder, getUserId, hasSupabase, isPayable, markOrderPaid, settleCapturedPayment } from '../../_lib/supabase'

const CANCELLED_MESSAGE =
  'This order was cancelled or already paid before this payment was confirmed. Please contact us on WhatsApp and we will refund it.'

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

  const razorpayLive = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)

  if (body.mock) {
    if (razorpayLive || !mockPaymentsAllowed(env, request)) return error('Mock payments are disabled', 403)
    if (order.payment_status === 'PAID' || order.payment_status === 'PARTIAL_PAID') return json({ ok: true, alreadyPaid: true })
    if (!isPayable(order) || !(await markOrderPaid(env, order, `mock_${Date.now()}`))) return error('This order was cancelled', 409)
    return json({ ok: true, mode: 'mock' })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body
  if (!razorpayLive || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return error('Invalid payment payload', 400)
  const ref = order.payment_gateway_ref ?? ''
  if (ref !== razorpay_order_id && !ref.startsWith(`${razorpay_order_id}/`)) return error('Payment does not match this order', 400)

  const expected = await hmacSha256Hex(env.RAZORPAY_KEY_SECRET!, `${razorpay_order_id}|${razorpay_payment_id}`)
  if (!safeEqual(expected, razorpay_signature)) return error('Payment signature verification failed', 400)

  const outcome = await settleCapturedPayment(env, order, razorpay_order_id, razorpay_payment_id)
  if (outcome === 'paid') {
    waitUntil(alertPaid(env, order, razorpay_payment_id))
    return json({ ok: true, mode: 'live' })
  }
  if (outcome === 'already_paid') return json({ ok: true, alreadyPaid: true })

  console.error(`REFUND NEEDED: payment ${razorpay_payment_id} could not be applied to order ${order.order_number}`)
  waitUntil(alertRefundNeeded(env, order.order_number, razorpay_payment_id))
  return error(CANCELLED_MESSAGE, 409)
}
