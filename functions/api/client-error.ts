// POST /api/client-error — JavaScript errors from shoppers' browsers (see src/lib/errorReporting.ts), sent to the
// owner's Telegram so a broken page is noticed before customers complain.
import { alertClientError } from '../_lib/alerts'
import type { Env } from '../_lib/env'
import { allow, clientIp, describeBrowser, isBot, sameOrigin } from '../_lib/rateLimit'

const MAX_BODY_BYTES = 4 * 1024
const done = () => new Response(null, { status: 204 })

/** Phone numbers and e-mail addresses never reach the alert. */
const redact = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\+?\d[\d\s-]{8,}\d/g, '[number]')

const text = (v: unknown, max: number) => (typeof v === 'string' ? redact(v.replace(/\s+/g, ' ').trim()).slice(0, max) : '')

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (!sameOrigin(request) || isBot(request)) return done()
  if (!allow(`client-error:${clientIp(request)}`, 5, 10 * 60 * 1000)) return done()

  let body: { m?: unknown; s?: unknown; u?: unknown }
  try {
    body = JSON.parse((await request.text()).slice(0, MAX_BODY_BYTES))
  } catch {
    return done()
  }
  const message = text(body.m, 300)
  if (!message) return done()
  const page = typeof body.u === 'string' && body.u.startsWith('/') ? body.u.split(/[?#]/)[0].slice(0, 200) : '?'
  console.warn('client error', message, page)
  waitUntil(alertClientError(env, { message, source: text(body.s, 200), page, browser: describeBrowser(request.headers.get('user-agent') ?? '') }))
  return done()
}
