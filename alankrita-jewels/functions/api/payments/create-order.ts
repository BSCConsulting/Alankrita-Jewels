// POST /api/payments/create-order  { orderId }
// Creates a Razorpay order for the amount due *now* (full amount for UPI prepaid, ₹150 for Partial COD).
// The amount is always read from the database — never from the client.
import type { Env } from '../../_lib/env'
import { error, json, readJson } from '../../_lib/http'
import { amountDueNow, fetchOrder, getUserId, hasSupabase, rest } from '../../_lib/supabase'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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
  if (order.payment_status !== 'PENDING') return error('This order is already paid', 409)

  const amount = amountDueNow(order)
  if (!razorpayLive) return json({ mode: 'mock', amount })

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

  await rest(env, `orders?id=eq.${order.id}`, { method: 'PATCH', body: JSON.stringify({ payment_gateway_ref: rzp.id }) })

  return json({ mode: 'live', keyId: env.RAZORPAY_KEY_ID, razorpayOrderId: rzp.id, amount: rzp.amount, currency: 'INR' })
}
