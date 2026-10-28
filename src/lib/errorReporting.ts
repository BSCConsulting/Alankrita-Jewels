const MAX_REPORTS_PER_PAGE = 3
let reported = 0
const seen = new Set<string>()

/** Noise from browser extensions, old in-app browsers and blocked third-party scripts, which we can't fix. */
const IGNORED = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /extension:\/\//i,
  /Non-Error promise rejection captured/i,
  /Load failed$/i,
  /NetworkError when attempting to fetch/i,
  /Failed to fetch$/i,
  /AbortError/i,
]

/** True for the error a stale tab hits when a new release has replaced the page's code files. */
export const isStaleChunkError = (message: string) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message)

export function reportError(error: unknown, source = ''): void {
  try {
    if (!import.meta.env.PROD || /^(localhost|127\.)/.test(location.hostname) || navigator.webdriver) return
    const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 300)
    const stackLine = error instanceof Error ? (error.stack?.split('\n').find((l) => /\/assets\//.test(l))?.trim() ?? '') : ''
    const where = source || stackLine
    if (!message || IGNORED.some((re) => re.test(message) || re.test(where)) || isStaleChunkError(message)) return
    if (seen.has(message) || reported >= MAX_REPORTS_PER_PAGE) return
    seen.add(message)
    reported++
    const body = JSON.stringify({ m: message, s: where.slice(0, 200), u: location.pathname })
    if (!navigator.sendBeacon?.('/api/client-error', body)) void fetch('/api/client-error', { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // Reporting must never cause an error of its own.
  }
}

export function installErrorReporting(): void {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, e.filename ? `${e.filename}:${e.lineno}` : ''))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason))
}
