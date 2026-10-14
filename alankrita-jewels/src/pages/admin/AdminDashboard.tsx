import { useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, BadgeIndianRupee, BellRing, CheckCircle2, Clock, Loader2, PackageOpen, Send, Truck, XCircle } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { callApi } from '@/integrations/apiClient'
import { cn, formatINR } from '@/lib/format'
import { toErrorMessage } from '@/lib/supabase'
import { fetchDashboardStats } from '@/services/admin'
import { productThumbnail } from '@/services/catalog'

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
            <h2 className="font-semibold">Partial COD balance to collect</h2>
            <p className="mt-2 text-3xl font-bold">{formatINR(stats.codBalanceOutstanding)}</p>
            <p className="text-sm text-slate-500">Across undelivered Partial COD orders — reconcile with courier remittances.</p>
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

      <TelegramAlertsCard />
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
