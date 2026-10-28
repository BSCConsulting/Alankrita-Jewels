import { isSupabaseConfigured } from './supabase'

/** Shopping steps counted for the admin funnel; mirrors the check constraint on public.analytics_events. */
export const FUNNEL_STEPS = ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'phone_verified', 'order_placed', 'payment_done'] as const
export type FunnelEvent = (typeof FUNNEL_STEPS)[number]

const SESSION_KEY = 'ak-sid'
const SENT_KEY = 'ak-sent'
export const MOCK_EVENTS_KEY = 'ak-mock-events'
const MOCK_EVENTS_MAX = 2000

/** Anonymous id for this browser tab; never linked to a phone number or name. */
function sessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/** The funnel counts sessions, so each step is sent once per tab (once per product for item steps). */
function firstInSession(key: string): boolean {
  const sent = new Set<string>(JSON.parse(sessionStorage.getItem(SENT_KEY) ?? '[]'))
  if (sent.has(key)) return false
  sent.add(key)
  sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-200)))
  return true
}

export function track(event: FunnelEvent, productId?: string): void {
  try {
    if (navigator.webdriver) return
    if (!firstInSession(productId ? `${event}:${productId}` : event)) return
    const payload = { e: event, s: sessionId(), p: productId ?? null, u: location.pathname.slice(0, 200) }
    if (!isSupabaseConfigured) {
      const events = JSON.parse(localStorage.getItem(MOCK_EVENTS_KEY) ?? '[]') as Array<typeof payload & { t: number }>
      events.push({ ...payload, t: Date.now() })
      localStorage.setItem(MOCK_EVENTS_KEY, JSON.stringify(events.slice(-MOCK_EVENTS_MAX)))
      return
    }
    const body = JSON.stringify(payload)
    if (!navigator.sendBeacon?.('/api/track', body)) void fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // Storage blocked (private mode) or quota full: analytics must never break shopping.
  }
}
