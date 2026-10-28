import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { isStaleChunkError, reportError } from '@/lib/errorReporting'
import { whatsappLink } from '@/lib/whatsapp'

const RELOAD_KEY = 'ak-stale-reload'
/** A second failure this soon after the automatic reload means the problem is not a stale tab. */
const RELOAD_WINDOW_MS = 60_000

/** Shown instead of a blank page when a route crashes or its code can't be loaded. */
export function RouteError() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error)
  const stale = isStaleChunkError(message)

  useEffect(() => {
    if (stale) {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
      if (Date.now() - last > RELOAD_WINDOW_MS) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
        location.reload()
        return
      }
    }
    reportError(error, 'route')
  }, [error, stale])

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-2xl font-bold text-primary">Alankrita Jewels</p>
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="text-ink-muted">
        {stale ? 'We have just updated the site. Reloading usually fixes this.' : 'This page hit a problem. Your bag is safe — please reload, or message us and we will help.'}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => location.reload()} className="ak-btn-primary px-6 py-3">
          <RefreshCw className="size-4" /> Reload page
        </button>
        <a href="/" className="ak-btn-outline px-6 py-3">
          Go to home
        </a>
      </div>
      <a
        href={whatsappLink(`Hi Alankrita Jewels, a page on your website isn't working: ${location.pathname}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="ak-btn-whatsapp mt-2 px-6 py-3"
      >
        <WhatsAppIcon className="size-5" /> Message us on WhatsApp
      </a>
    </main>
  )
}
