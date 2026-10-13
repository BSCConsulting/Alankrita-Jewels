// POST /api/payments/webhook — configure in Razorpay Dashboard → Webhooks with event `payment.captured`.
// Safety net for shoppers who close the tab before the browser-side /verify call completes.
import type { Env } from '../../_lib/env'
import { error, hmacSha256Hex, json, safeEqual } from '../../_lib/http'
import { hasSupabase, markOrderPaid, rest, type OrderRow } from '../../_lib/supabase'

interface PaymentCapturedEvent {
  event: string
  payload: { payment: { entity: { id: string; order_id: string } } }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !hasSupabase(env)) return error('Webhook not configured', 503)

  const raw = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''
  const expected = await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, raw)
  if (!safeEqual(expected, signature)) return error('Invalid signature', 401)

  const event = JSON.parse(raw) as PaymentCapturedEvent
  if (event.event !== 'payment.captured') return json({ ignored: event.event })

  const { id: paymentId, order_id: rzpOrderId } = event.payload.payment.entity
  const [order] = await rest<OrderRow[]>(env, `orders?payment_gateway_ref=eq.${encodeURIComponent(rzpOrderId)}&select=*`)
  if (order) await markOrderPaid(env, order, `${rzpOrderId}/${paymentId}`)

  return json({ ok: true })
}
