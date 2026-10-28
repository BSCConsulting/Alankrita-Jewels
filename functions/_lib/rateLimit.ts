// Per-isolate fixed-window limiter for cheap, unauthenticated endpoints. Cloudflare runs many isolates, so this
// is a flood damper rather than an exact quota; it needs no storage and adds no latency.
const MAX_KEYS = 5000
const windows = new Map<string, { start: number; count: number }>()

export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const w = windows.get(key)
  if (!w || now - w.start >= windowMs) {
    if (windows.size >= MAX_KEYS) {
      for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k)
      if (windows.size >= MAX_KEYS) windows.clear()
    }
    windows.set(key, { start: now, count: 1 })
    return true
  }
  w.count++
  return w.count <= max
}

export const clientIp = (request: Request) => request.headers.get('cf-connecting-ip') ?? 'unknown'

/** Rejects cross-site posts; browsers always send Origin on POST, so a missing one is a script and is allowed through the other checks. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp/i
export const isBot = (request: Request) => BOT_UA.test(request.headers.get('user-agent') ?? '')

const BROWSER_NAMES: Record<string, string> = { Edg: 'Edge', OPR: 'Opera', CriOS: 'Chrome', FxiOS: 'Firefox', SamsungBrowser: 'Samsung Internet' }

/** "Chrome 130 on Android" — enough to reproduce a bug, without storing the full user agent. */
export function describeBrowser(ua: string): string {
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iPhone/iPad'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown system'
  const m = ua.match(/(Edg|SamsungBrowser|OPR|Firefox|FxiOS|CriOS|Chrome)\/(\d+)/)
  if (m) return `${BROWSER_NAMES[m[1]] ?? m[1]} ${m[2]} on ${os}`
  const safari = ua.match(/Version\/(\d+)[^ ]* (Mobile\/\S+ )?Safari\//)
  return safari ? `Safari ${safari[1]} on ${os}` : `Browser on ${os}`
}
