// Store-owner alerts over Telegram. Every function is a no-op until TELEGRAM_BOT_TOKEN and
// TELEGRAM_CHAT_ID are set, and never throws: an alert must not break checkout.
import type { Env } from './env'
import { escapeHtml } from './http'
import { amountDueNow, type OrderRow } from './supabase'

const DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60
const ERROR_ALERT_INTERVAL_MS = 5 * 60 * 1000
const lastErrorAlert = new Map<string, number>()

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`

export const alertsEnabled = (env: Env) => Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)

/** Resolves with Telegram's verdict so the admin test button can explain a wrong token or chat id. */
export async function sendAlert(env: Env, html: string): Promise<{ ok: boolean; reason?: string }> {
  if (!alertsEnabled(env)) return { ok: false, reason: 'not configured' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN!.trim()}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID!.trim(), text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
    if (res.ok) return { ok: true }
    const body = await res.text()
    console.error('Telegram alert failed', res.status, body)
    let reason = `Telegram error ${res.status}`
    try {
      reason = (JSON.parse(body) as { description?: string }).description ?? reason
    } catch {
      // keep the status-only reason
    }
    return { ok: false, reason }
  } catch (err) {
    console.error('Telegram alert failed', err)
    return { ok: false, reason: 'Telegram could not be reached' }
  }
}

/**
 * True the first time it is called for `key` (per Cloudflare location, for a week). Checkout retries
 * call create-order again, and the owner should get one alert per order, not one per attempt.
 */
async function firstTime(key: string): Promise<boolean> {
  try {
    const cache = (caches as unknown as { default: Cache }).default
    const url = `https://alerts.alankrita.internal/${encodeURIComponent(key)}`
    if (await cache.match(url)) return false
    await cache.put(url, new Response('1', { headers: { 'cache-control': `max-age=${DEDUPE_TTL_SECONDS}` } }))
  } catch {
    // Cache API unavailable (local dev): prefer a duplicate alert over a missed one.
  }
  return true
}

export async function alertNewOrder(env: Env, order: OrderRow, adminUrl: string): Promise<void> {
  if (!alertsEnabled(env) || !(await firstTime(`order:${order.id}`))) return
  const a = order.shipping_address
  const items = (order.items ?? []).map((i) => `• ${escapeHtml(i.product_title)} × ${i.quantity} — ${inr(i.unit_price * i.quantity)}`).join('\n')
  const mode = order.payment_mode === 'PARTIAL_COD' ? `Partial COD (advance ${inr(amountDueNow(order))})` : 'UPI prepaid'
  await sendAlert(
    env,
    [
      `🛍️ <b>New order ${escapeHtml(order.order_number)}</b> — ${inr(order.final_amount)}`,
      '',
      `👤 ${escapeHtml(order.customer_name)} · ${escapeHtml(order.customer_phone)}`,
      `📍 ${escapeHtml(a.city)}, ${escapeHtml(a.state)} ${escapeHtml(a.pincode)}`,
      `💳 ${mode} · <b>awaiting ${inr(amountDueNow(order))}</b>`,
      '',
      items,
      '',
      `<a href="${escapeHtml(adminUrl)}/admin/orders">Open orders</a> · <a href="https://wa.me/${order.customer_phone.replace(/\D/g, '')}">WhatsApp customer</a>`,
    ].join('\n'),
  )
}

export async function alertPaid(env: Env, order: OrderRow, ref: string): Promise<void> {
  if (!alertsEnabled(env) || !(await firstTime(`paid:${order.id}`))) return
  await sendAlert(env, `💰 <b>Payment received</b> for ${escapeHtml(order.order_number)} — ${inr(amountDueNow(order))}\nRef: <code>${escapeHtml(ref)}</code>`)
}

export async function alertRefundNeeded(env: Env, orderNumber: string, paymentId: string): Promise<void> {
  await sendAlert(
    env,
    `🚨 <b>Refund needed</b>\nPayment <code>${escapeHtml(paymentId)}</code> was captured for order ${escapeHtml(orderNumber)}, which was already cancelled. Refund it from the Razorpay dashboard.`,
  )
}

/** At most one alert per path every 5 minutes per isolate, so an outage does not flood the chat. */
export async function alertServerError(env: Env, method: string, path: string, err: unknown): Promise<void> {
  const key = `${method} ${path}`
  const now = Date.now()
  if (now - (lastErrorAlert.get(key) ?? 0) < ERROR_ALERT_INTERVAL_MS) return
  lastErrorAlert.set(key, now)
  const message = err instanceof Error ? err.message : String(err)
  await sendAlert(env, `⚠️ <b>Server error</b> on <code>${escapeHtml(key)}</code>\n${escapeHtml(message.slice(0, 500))}`)
}
