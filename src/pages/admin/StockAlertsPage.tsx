import { useState } from 'react'
import { Link } from 'react-router'
import { BellRing, Check, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useAsync } from '@/hooks/useAsync'
import { cn, formatDay, maskPhone } from '@/lib/format'
import { SITE_URL } from '@/lib/seo'
import { toErrorMessage } from '@/lib/supabase'
import { whatsappLink } from '@/lib/whatsapp'
import { listPendingStockAlerts, markStockAlertsNotified, type PendingStockAlerts } from '@/services/stockAlerts'

const restockMessage = (g: PendingStockAlerts) =>
  `Namaste 🙏 Good news from Alankrita Jewels: "${g.product.title}" is back in stock! ` +
  `You can order it here: ${SITE_URL}/product/${g.product.slug}`

export default function StockAlertsPage() {
  const [version, setVersion] = useState(0)
  const { data, loading, error } = useAsync(() => listPendingStockAlerts(), [version])
  const [messaged, setMessaged] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  const finish = async (g: PendingStockAlerts) => {
    setBusy(g.product.id)
    try {
      await markStockAlertsNotified(g.alerts.map((a) => a.id))
      toast.success(`${g.product.title}: marked as notified`)
      setVersion((v) => v + 1)
    } catch (e) {
      toast.error(toErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Back-in-stock requests</h1>
      <p className="mt-1 text-sm text-slate-500">
        Customers who asked to be told when a sold-out piece returns. Restock the piece in Products, message each customer below, then mark it done.
      </p>

      {loading && !data ? (
        <Loader2 className="mx-auto mt-16 size-8 animate-spin text-slate-400" />
      ) : error ? (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">Couldn’t load requests: {toErrorMessage(error)}</p>
      ) : !data?.length ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No one is waiting. Requests appear when customers tap “Notify me” on a sold-out piece.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {data.map((g) => {
            const restocked = g.product.in_stock && g.product.stock_count > 0
            return (
              <li key={g.product.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to={`/admin/products/${g.product.id}/edit`} className="font-semibold hover:underline">
                      {g.product.title}
                    </Link>
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <BellRing className="size-3.5" /> {g.alerts.length} waiting
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-semibold',
                          restocked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
                        )}
                      >
                        {restocked ? `Back in stock (${g.product.stock_count})` : 'Still sold out'}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => finish(g)}
                    disabled={!restocked || busy === g.product.id}
                    title={restocked ? undefined : 'Restock the piece first'}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    <Check className="size-4" /> Mark all as notified
                  </button>
                </div>
                {restocked && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {g.alerts.map((a) => (
                      <li key={a.id}>
                        <a
                          href={whatsappLink(restockMessage(g), a.phone.replace(/\D/g, ''))}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMessaged((s) => new Set(s).add(a.id))}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold',
                            messaged.has(a.id) ? 'border-slate-200 text-slate-400' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
                          )}
                          title={`Requested ${formatDay(a.created_at)}`}
                        >
                          {messaged.has(a.id) ? <Check className="size-3.5" /> : <WhatsAppIcon className="size-3.5" />} {maskPhone(a.phone)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
