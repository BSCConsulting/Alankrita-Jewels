// POST /api/notify/whatsapp  (admin only)
// Sends a dispatch/tracking message through the WhatsApp Cloud API.
// Env: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TRACKING_TEMPLATE (approved template, required
// for business-initiated messages outside the 24h customer-service window).
import type { Env } from '../../_lib/env'
import { error, json, readJson } from '../../_lib/http'
import { requireAdmin } from '../../_lib/supabase'

interface NotifyBody {
  to: string
  message: string
  orderNumber: string
  customerName: string
  trackingUrl: string | null
  awb: string | null
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const live = Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID)
  const denied = await requireAdmin(env, request, live)
  if (denied) return denied

  const body = await readJson<NotifyBody>(request)
  const to = body.to?.replace(/\D/g, '')
  if (!to || to.length < 12 || !body.message) return error('Recipient and message are required', 400)
  if (!live) return json({ mode: 'mock' })

  const payload = env.WHATSAPP_TRACKING_TEMPLATE
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: env.WHATSAPP_TRACKING_TEMPLATE,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [body.customerName, body.orderNumber, body.awb, body.trackingUrl].map((text) => ({ type: 'text', text: text || '-' })),
            },
          ],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: body.message, preview_url: true } }

  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } }
  if (!res.ok) return error(`WhatsApp: ${result.error?.message ?? 'send failed'}`, 502)

  return json({ mode: 'live', messageId: result.messages?.[0]?.id })
}
