import { useState } from 'react'
import { Link } from 'react-router'
import {
  AlertTriangle,
  BadgeIndianRupee,
  BellRing,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  MessageSquareHeart,
  PackageOpen,
  Send,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useAsync } from '@/hooks/useAsync'
import { callApi } from '@/integrations/apiClient'
import { cn, formatDay, formatINR, maskPhone } from '@/lib/format'
import { FUNNEL_STEPS, type FunnelEvent } from '@/lib/analytics'
import { ENDING_SOON_DAYS } from '@/lib/guarantee'
import { toErrorMessage } from '@/lib/supabase'
import { whatsappLink } from '@/lib/whatsapp'
import { fetchDashboardStats, fetchFunnel, listGuaranteesEndingSoon, type ExpiringGuarantee } from '@/services/admin'
import { productThumbnail } from '@/services/catalog'
import { countPendingReviews } from '@/services/reviews'
import { listPendingStockAlerts } from '@/services/stockAlerts'

export default function AdminDashboard() {
  const { data: stats, loading, error } = useAsync(fetchDashboardStats, [])

  const cards = stats
    ? [
        { label: 'Orders today', value: String(stats.ordersToday), icon: PackageOpen, to: '/admin/orders' },
        { label: 'Revenue (30 days)', value: formatINR(stats.revenue30d), icon: BadgeIndianRupee, to: '/admin/orders' },
        { label: 'Awaiting dispatch', value: String(stats.awaitingDispatch), icon: Truck, to: '/admin/orders' },
        { label: 'Payment pending', value: String(stats.pendingPayment), icon: Clock, to: '/admin/orders' },
      ]
    : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">Today’s snapshot of Alankrita Jewels.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error.message}</p>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      <AttentionStrip />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
            <Icon className="size-5 text-slate-400" />
            <p className="mt-3 text-2xl font-bold">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
          </Link>
        ))}
      </div>

      {stats && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Cash to collect on delivery</h2>
            <p className="mt-2 text-3xl font-bold">{formatINR(stats.codBalanceOutstanding)}</p>
            <p className="text-sm text-slate-500">Across undelivered COD and Partial COD orders — reconcile with courier remittances.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-amber-500" /> Low stock (≤ 3)
            </h2>
            {stats.lowStock.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">All products are well stocked.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {stats.lowStock.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <img src={productThumbnail(p)} alt="" className="size-10 rounded object-cover" />
                    <Link to={`/admin/products/${p.id}/edit`} className="flex-1 truncate text-sm hover:underline">
                      {p.title}
                    </Link>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{p.stock_count} left</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <FunnelCard />

      <GuaranteeReminders />

      <TelegramAlertsCard />
    </div>
  )
}

const FUNNEL_LABEL: Record<FunnelEvent, string> = {
  page_view: 'Visited the shop',
  view_item: 'Viewed a product',
  add_to_cart: 'Added to bag',
  begin_checkout: 'Opened checkout',
  phone_verified: 'Verified mobile',
  order_placed: 'Placed an order',
  payment_done: 'Paid online',
}
/** Cash-on-delivery orders never pay online, so the last step is not a drop-off. */
const DROP_STEPS = FUNNEL_STEPS.filter((s) => s !== 'payment_done')

function FunnelCard() {
  const [days, setDays] = useState(30)
  const { data, error } = useAsync(() => fetchFunnel(days), [days])
  const top = data ? Math.max(1, ...Object.values(data)) : 1
  let worst: { from: FunnelEvent; to: FunnelEvent; lost: number } | null = null
  if (data)
    for (let i = 1; i < DROP_STEPS.length; i++) {
      const prev = data[DROP_STEPS[i - 1]]
      const lost = prev > 0 ? 1 - data[DROP_STEPS[i]] / prev : 0
      if (prev >= 5 && (!worst || lost > worst.lost)) worst = { from: DROP_STEPS[i - 1], to: DROP_STEPS[i], lost }
    }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Filter className="size-4 text-slate-400" /> Where shoppers drop off
          </h2>
          <p className="text-sm text-slate-500">Browser visits reaching each step. Anonymous: no names or numbers are recorded.</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ak-input w-auto bg-white py-1.5 text-sm" aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-700">{error.message}</p>
      ) : !data ? (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      ) : data.page_view === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No visits recorded yet for this period.</p>
      ) : (
        <>
          <ol className="mt-4 space-y-2">
            {FUNNEL_STEPS.map((step, i) => {
              const count = data[step]
              const prev = i > 0 ? data[FUNNEL_STEPS[i - 1]] : 0
              return (
                <li key={step} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_7rem]">
                  <span className="truncate text-slate-600">{FUNNEL_LABEL[step]}</span>
                  <span className="h-6 overflow-hidden rounded bg-slate-100">
                    <span className="block h-full rounded bg-slate-800" style={{ width: `${(count / top) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">
                    <strong>{count}</strong>
                    {i > 0 && prev > 0 && <span className="ml-1.5 text-xs text-slate-500">{Math.round((count / prev) * 100)}%</span>}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="mt-3 text-xs text-slate-500">% is of the step above. Cash on delivery orders don't pay online, so “Paid online” is lower by design.</p>
          {worst && worst.lost > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Biggest drop: {Math.round(worst.lost * 100)}% leave between “{FUNNEL_LABEL[worst.from]}” and “{FUNNEL_LABEL[worst.to]}”.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** One reminder per order, listing every piece whose cover ends soon. */
function guaranteeReminderText(pieces: ExpiringGuarantee[]) {
  const [first] = pieces
  const lines = pieces.map((g) => `• ${g.title}${g.size ? ` (${g.size})` : ''}: ${g.text}, ends ${formatDay(g.endsAt.toISOString())}`)
  return [
    `Namaste ${first.customerName}, this is Alankrita Jewels. The guarantee on ${pieces.length === 1 ? 'this piece' : 'these pieces'} from your order ${first.orderNumber} ends soon:`,
    ...lines,
    `If anything needs care, reply here and we'll arrange it under the guarantee.`,
  ].join('\n')
}

function GuaranteeReminders() {
  const { data, error } = useAsync(() => listGuaranteesEndingSoon(), [])
  const groups = new Map<string, ExpiringGuarantee[]>()
  for (const g of data ?? []) groups.set(g.orderNumber, [...(groups.get(g.orderNumber) ?? []), g])
  const byOrder = [...groups.values()]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-4 text-slate-400" /> Guarantees ending in the next {ENDING_SOON_DAYS} days
      </h2>
      <p className="text-sm text-slate-500">A quick WhatsApp reminder before the cover ends builds trust and brings customers back.</p>
      {error ? (
        <p className="mt-3 text-sm text-red-700">{error.message}</p>
      ) : !data ? (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      ) : byOrder.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">None right now.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {byOrder.map((pieces) => {
            const [first] = pieces
            return (
              <li key={first.orderNumber} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {first.customerName} <span className="font-normal text-slate-500">· {maskPhone(first.customerPhone)} · {first.orderNumber}</span>
                  </p>
                  {pieces.map((g) => (
                    <p key={g.key} className="truncate text-xs text-slate-500">
                      {g.title} — ends {formatDay(g.endsAt.toISOString())} ({g.daysLeft} {g.daysLeft === 1 ? 'day' : 'days'})
                    </p>
                  ))}
                </div>
                <a
                  href={whatsappLink(guaranteeReminderText(pieces), first.customerPhone.replace(/\D/g, ''))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ak-btn-whatsapp px-3 py-2 text-xs"
                >
                  <WhatsAppIcon className="size-4" /> Remind
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Customer actions waiting on the owner; hidden when there is nothing to do. */
function AttentionStrip() {
  const { data } = useAsync(async () => {
    const [pendingReviews, alerts] = await Promise.all([countPendingReviews(), listPendingStockAlerts().catch(() => [])])
    const restocked = alerts.filter((g) => g.product.in_stock && g.product.stock_count > 0)
    return { pendingReviews, restocked: restocked.reduce((n, g) => n + g.alerts.length, 0) }
  }, [])
  if (!data || (!data.pendingReviews && !data.restocked)) return null
  return (
    <div className="flex flex-wrap gap-3">
      {data.pendingReviews > 0 && (
        <Link to="/admin/reviews" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <MessageSquareHeart className="size-4" /> {data.pendingReviews} review{data.pendingReviews > 1 ? 's' : ''} waiting for approval
        </Link>
      )}
      {data.restocked > 0 && (
        <Link to="/admin/stock-alerts" className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <BellRing className="size-4" /> {data.restocked} customer{data.restocked > 1 ? 's' : ''} to message: their piece is back in stock
        </Link>
      )}
    </div>
  )
}

function TelegramAlertsCard() {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const sendTest = async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await callApi<{ sent: boolean; reason?: string }>('/api/admin/test-alert', {}, 'admin')
      if (!res.available) setResult({ ok: false, text: 'Test alerts only work on the live site.' })
      else if (res.data.sent) setResult({ ok: true, text: 'Sent — check your Telegram.' })
      else setResult({ ok: false, text: res.data.reason ?? 'Telegram did not accept the message.' })
    } catch (e) {
      setResult({ ok: false, text: toErrorMessage(e) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-semibold">
          <BellRing className="size-4 text-slate-400" /> Telegram order alerts
        </h2>
        <p className="text-sm text-slate-500">New orders, payments, refunds needed and site errors are sent to your Telegram.</p>
        {result && (
          <p className={cn('mt-2 flex items-center gap-1.5 text-sm font-medium', result.ok ? 'text-emerald-700' : 'text-red-700')}>
            {result.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
            {result.text}
          </p>
        )}
      </div>
      <button onClick={sendTest} disabled={sending} className="ak-btn-outline bg-white py-2.5">
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send test alert
      </button>
    </div>
  )
}
