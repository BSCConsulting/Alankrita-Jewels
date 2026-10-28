/** Microsoft Clarity project id (Clarity → Settings → Overview). Off until VITE_CLARITY_ID is set at build time. */
const raw = (import.meta.env.VITE_CLARITY_ID as string | undefined)?.trim() ?? ''
export const CLARITY_ID = /^[a-z0-9]{6,20}$/i.test(raw) ? raw : null

let loaded = false

/** Loads Clarity once the page is idle, for shoppers only: the admin panel is never recorded. */
export function loadClarity(): void {
  if (loaded || !CLARITY_ID || !import.meta.env.PROD || location.pathname.startsWith('/admin') || navigator.webdriver) return
  loaded = true
  const start = () => {
    const w = window as unknown as { clarity?: ((...args: unknown[]) => void) & { q?: unknown[] } }
    w.clarity ??= Object.assign((...args: unknown[]) => void (w.clarity!.q ??= []).push(args), {})
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`
    document.head.appendChild(script)
  }
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 4000 })
  else setTimeout(start, 2000)
}
