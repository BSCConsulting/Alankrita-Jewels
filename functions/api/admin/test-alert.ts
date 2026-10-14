// POST /api/admin/test-alert  (admin only)
// Sends a sample message to the owner's Telegram chat so the TELEGRAM_* secrets can be checked without an order.
import { alertsEnabled, sendAlert } from '../../_lib/alerts'
import type { Env } from '../../_lib/env'
import { json } from '../../_lib/http'
import { requireAdmin } from '../../_lib/supabase'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await requireAdmin(env, request, true)
  if (denied) return denied

  if (!alertsEnabled(env)) {
    const missing = (['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'] as const).filter((k) => !env[k])
    return json({ sent: false, reason: `Missing in Cloudflare: ${missing.join(', ')}. Add them as secrets, then redeploy.` })
  }

  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  const result = await sendAlert(env, `✅ <b>Alankrita alerts are working</b>\nTest sent from the admin panel · ${time}`)
  return json({ sent: result.ok, reason: result.reason })
}
