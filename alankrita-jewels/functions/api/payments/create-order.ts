// POST /api/payments/create-order  { orderId }
// Creates a Razorpay order for the amount due *now* (full amount for UPI prepaid, ₹150 for Partial COD).
// The amount is always read from the database — never from the client.
// Without Razorpay keys the order stays PENDING and is paid over WhatsApp/UPI ("offline"), unless
// ALLOW_MOCK_PAYMENTS=true enables the simulated payment sheet for testing.
import { alertNewOrder } from '../../_lib/alerts'
import { siteUrl, type Env } from '../../_lib/env'
import { error, json, readJson } from '../../_lib/http'
import { amountDueNow, fetchOrder, getUserId, hasSupabase, isPayable, rest } from '../../_lib/supabase'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const { orderId } = await readJson<{ orderId: string }>(request)
  if (!orderId) return error('orderId is required', 400)

  const razorpayLive = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)

  if (!hasSupabase(env)) {
    if (razorpayLive) return error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for live payments', 503)
    return json({ mode: 'mock', amount: 0 })
  }

  const userId = await getUserId(env, request)
  if (!userId) return error('Please verify your mobile number again', 401)

  const order = await fetchOrder(env, orderId)
  if (!order || order.user_id !== userId) return error('Order not found', 404)
  if (order.payment_status === 'PAID' || order.payment_status === 'PARTIAL_PAID') return error('This order is already paid', 409)
  if (!isPayable(order)) return error('This order was cancelled. Please place a new order.', 409)

  // Every checkout calls this endpoint straight after place_order, so it doubles as the new-order hook.
  waitUntil(alertNewOrder(env, order, siteUrl(env, request)))

  const amount = amountDueNow(order)
  if (!razorpayLive) return json({ mode: env.ALLOW_MOCK_PAYMENTS === 'true' ? 'mock' : 'offline', amount })

  // Retrying checkout reuses the same Razorpay order, so a payment on an earlier attempt still matches.
  if (order.payment_gateway_ref?.startsWith('order_')) {
    return json({ mode: 'live', keyId: env.RAZORPAY_KEY_ID, razorpayOrderId: order.payment_gateway_ref, amount: Math.round(amount * 100), currency: 'INR' })
  }

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: order.order_number,
      notes: { order_id: order.id, order_number: order.order_number, payment_mode: order.payment_mode },
    }),
  })
  if (!res.ok) {
    console.error('Razorpay order create failed', res.status, await res.text())
    return error('Payment gateway is unavailable. Please try again.', 502)
  }
  const rzp = (await res.json()) as { id: string; amount: number }

  const saved = await rest<Array<{ payment_gateway_ref: string }>>(
    env,
    `orders?id=eq.${order.id}&payment_status=eq.PENDING&payment_gateway_ref=is.null&select=payment_gateway_ref`,
    { method: 'PATCH', body: JSON.stringify({ payment_gateway_ref: rzp.id }) },
  )
  if (!saved.length) {
    // A parallel request stored its Razorpay order first; use that one so verify/webhook can match it.
    const current = await fetchOrder(env, order.id)
    if (!current || !isPayable(current) || !current.payment_gateway_ref?.startsWith('order_')) {
      return error('This order can no longer be paid. Please refresh the page.', 409)
    }
    return json({ mode: 'live', keyId: env.RAZORPAY_KEY_ID, razorpayOrderId: current.payment_gateway_ref, amount: rzp.amount, currency: 'INR' })
  }

  return json({ mode: 'live', keyId: env.RAZORPAY_KEY_ID, razorpayOrderId: rzp.id, amount: rzp.amount, currency: 'INR' })
}
