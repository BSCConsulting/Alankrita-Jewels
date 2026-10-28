// POST /api/track — anonymous shopping-funnel steps for the admin dashboard (see src/lib/analytics.ts).
// Stores only the step, a random per-tab id, the product id and the page path: no IP, phone or name.
import type { Env } from '../_lib/env'
import { allow, clientIp, isBot, sameOrigin } from '../_lib/rateLimit'
import { hasSupabase } from '../_lib/supabase'

const EVENTS = new Set(['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'phone_verified', 'order_placed', 'payment_done'])
const SESSION = /^[A-Za-z0-9-]{8,64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BODY_BYTES = 1024
const done = () => new Response(null, { status: 204 })

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (!hasSupabase(env) || !sameOrigin(request) || isBot(request)) return done()
  if (!allow(`track:${clientIp(request)}`, 60, 10 * 60 * 1000)) return done()

  let body: { e?: unknown; s?: unknown; p?: unknown; u?: unknown }
  try {
    body = JSON.parse((await request.text()).slice(0, MAX_BODY_BYTES))
  } catch {
    return done()
  }
  if (typeof body.e !== 'string' || !EVENTS.has(body.e) || typeof body.s !== 'string' || !SESSION.test(body.s)) return done()

  const row = {
    event: body.e,
    session_id: body.s,
    product_id: typeof body.p === 'string' && UUID.test(body.p) ? body.p : null,
    path: typeof body.u === 'string' && body.u.startsWith('/') ? body.u.split(/[?#]/)[0].slice(0, 200) : null,
  }
  waitUntil(
    fetch(`${env.SUPABASE_URL}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    })
      .then(async (res) => {
        if (!res.ok) console.error('track insert failed', res.status, (await res.text()).slice(0, 300))
      })
      .catch((err) => console.error('track insert failed', err)),
  )
  return done()
}
