// GET /api/health — for an uptime monitor (e.g. UptimeRobot): 200 when the site can reach the database, 503 when not.
// Reports only up/down and timing; no configuration or secrets.
import type { Env } from '../_lib/env'
import { json } from '../_lib/http'
import { hasSupabase } from '../_lib/supabase'

const TIMEOUT_MS = 5000

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!hasSupabase(env)) return json({ ok: false, database: 'not configured' }, 503)
  const started = Date.now()
  let database: 'ok' | 'down' = 'down'
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/categories?select=id&limit=1`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.ok) database = 'ok'
    else console.error('health: database responded', res.status)
  } catch (err) {
    console.error('health: database unreachable', err)
  }
  const ok = database === 'ok'
  return json({ ok, database, ms: Date.now() - started, time: new Date().toISOString() }, ok ? 200 : 503)
}

/** Many uptime monitors check with HEAD by default. */
export const onRequestHead = onRequestGet
