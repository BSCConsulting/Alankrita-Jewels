// POST /api/payments/webhook — configure in Razorpay Dashboard → Webhooks with event `payment.captured`.
// Safety net for shoppers who close the tab before the browser-side /verify call completes.
import type { Env } from '../../_lib/env'
import { error, hmacSha256Hex, json, safeEqual } from '../../_lib/http'
import { alertPaid, alertRefundNeeded } from '../../_lib/alerts'
import { hasSupabase, rest, settleCapturedPayment, type OrderRow } from '../../_lib/supabase'

interface PaymentCapturedEvent {
  event: string
  payload?: { payment?: { entity?: { id?: string; order_id?: string } } }
}

const RAZORPAY_ID = /^[A-Za-z0-9_]{1,64}$/

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !hasSupabase(env)) return error('Webhook not configured', 503)

  const raw = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''
  const expected = await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, raw)
  if (!safeEqual(expected, signature)) return error('Invalid signature', 401)

  let event: PaymentCapturedEvent
  try {
    event = JSON.parse(raw) as PaymentCapturedEvent
  } catch {
    return error('Invalid JSON', 400)
  }
  if (event.event !== 'payment.captured') return json({ ignored: event.event })

  const { id: paymentId = '', order_id: rzpOrderId = '' } = event.payload?.payment?.entity ?? {}
  if (!RAZORPAY_ID.test(paymentId) || !RAZORPAY_ID.test(rzpOrderId)) return error('Invalid payment payload', 400)

  const [order] = await rest<OrderRow[]>(
    env,
    `orders?or=(payment_gateway_ref.eq.${rzpOrderId},payment_gateway_ref.like.${rzpOrderId}/*)&select=*`,
  )
  if (!order) {
    console.error(`Webhook: no order matches Razorpay order ${rzpOrderId} (payment ${paymentId})`)
    return json({ ok: true, matched: false })
  }

  const outcome = await settleCapturedPayment(env, order, rzpOrderId, paymentId)
  if (outcome === 'paid') await alertPaid(env, order, paymentId)
  if (outcome === 'refund_needed') {
    console.error(`REFUND NEEDED: payment ${paymentId} could not be applied to order ${order.order_number}`)
    await alertRefundNeeded(env, order.order_number, paymentId)
  }
  return json({ ok: true })
}
