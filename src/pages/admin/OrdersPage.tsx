import { useEffect, useState, type ReactNode } from 'react'
import { BadgeCheck, ChevronDown, Download, ExternalLink, Loader2, Phone, RefreshCw, Search, Send, Truck } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { PAYMENT_RULES } from '@/config/site'
import { useAsync } from '@/hooks/useAsync'
import { createDelhiveryShipment, createShiprocketOrder } from '@/integrations/logistics'
import { sendTrackingNotification } from '@/integrations/whatsappNotify'
import { datedFilename, downloadCsv, ordersToCsv } from '@/lib/csv'
import { cn, formatDate, formatINR, safeHttpUrl } from '@/lib/format'
import { toErrorMessage } from '@/lib/supabase'
import { exportOrders, listOrders, ORDER_TRANSITIONS, updateOrder } from '@/services/admin'
import { amountDueNow } from '@/services/orders'
import { useAdminStore } from '@/stores/useAdminStore'
import { ORDER_STATUSES, PAYMENT_MODES, PAYMENT_STATUSES, type Order, type OrderStatus, type PaymentStatus } from '@/types'

const PAYMENT_TONE: Record<PaymentStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  PARTIAL_PAID: 'bg-sky-100 text-sky-800',
  FAILED: 'bg-red-100 text-red-800',
}
const STATUS_TONE: Record<OrderStatus, string> = {
  PLACED: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-800',
  DISPATCHED: 'bg-violet-100 text-violet-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-700',
}
const label = (s: string) => s.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())

export default function OrdersPage() {
  const { filters, setFilter, resetFilters } = useAdminStore()
  const [search, setSearch] = useState(filters.search)
  const { data, loading, error, reload } = useAsync(() => listOrders(filters), [filters])
  const [orders, setOrders] = useState<Order[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => setOrders(data ?? []), [data])
  useEffect(() => {
    const t = setTimeout(() => search !== filters.search && setFilter('search', search), 350)
    return () => clearTimeout(t)
  }, [search, filters.search, setFilter])

  const filtersActive =
    filters.paymentStatus !== 'ALL' || filters.orderStatus !== 'ALL' || filters.paymentMode !== 'ALL' || filters.search.trim() !== ''

  const replace = (o: Order) => setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, ...o } : x)))

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast.error(toErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const ship = (order: Order, provider: 'SHIPROCKET' | 'DELHIVERY') =>
    run(`${order.id}:${provider}`, async () => {
      const shipment = provider === 'SHIPROCKET' ? await createShiprocketOrder(order) : await createDelhiveryShipment(order)
      const patch = {
        shipping_provider: shipment.provider,
        awb_number: shipment.awb,
        tracking_url: shipment.trackingUrl,
        order_status: 'DISPATCHED' as const,
      }
      try {
        replace(await updateOrder(order.id, patch))
      } catch (e) {
        // The courier already has the shipment: keep the AWB on screen so it is not booked twice.
        replace({ ...order, ...patch })
        throw new Error(`AWB ${shipment.awb} was created with ${label(provider)} but could not be saved (${toErrorMessage(e)}). Note it down before refreshing.`)
      }
      toast.success(`${label(provider)} AWB ${shipment.awb} generated${shipment.mock ? ' (mock)' : ''}`)
    })

  const notify = (order: Order) => {
    // Open the tab synchronously so popup blockers allow the wa.me fallback after the await.
    const fallbackTab = window.open('', '_blank')
    if (fallbackTab) fallbackTab.opener = null
    return run(`${order.id}:WA`, async () => {
      try {
        const result = await sendTrackingNotification(order)
        if (result.sent) {
          fallbackTab?.close()
          toast.success(`Tracking sent to ${order.customer_phone} via WhatsApp`)
        } else if (fallbackTab) {
          fallbackTab.location.href = result.waLink
        } else {
          window.location.href = result.waLink
        }
      } catch (e) {
        fallbackTab?.close()
        throw e
      }
    })
  }

  const markPaid = (order: Order) =>
    run(`${order.id}:PAID`, async () => {
      const amount = amountDueNow(order)
      if (!confirm(`Confirm you have received ${formatINR(amount)} for ${order.order_number}?`)) return
      replace(
        await updateOrder(order.id, {
          payment_status: order.payment_mode === 'PARTIAL_COD' ? 'PARTIAL_PAID' : 'PAID',
          advance_paid: amount,
          payment_gateway_ref: order.payment_gateway_ref ?? 'manual_upi',
          order_status: order.order_status === 'PLACED' ? 'CONFIRMED' : order.order_status,
        }),
      )
      toast.success(`${order.order_number} marked as paid`)
    })

  const exportCsv = () =>
    run('EXPORT', async () => {
      const all = await exportOrders(filters)
      downloadCsv(datedFilename('alankrita-orders'), ordersToCsv(all))
      toast.success(`Exported ${all.length} ${all.length === 1 ? 'order' : 'orders'}`)
    })

  const setStatus = (order: Order, order_status: OrderStatus) =>
    run(`${order.id}:STATUS`, async () => {
      if (order_status === 'CANCELLED' && !confirm(`Cancel ${order.order_number}? Stock will be returned to inventory.`)) return
      replace(await updateOrder(order.id, { order_status }))
      toast.success(`${order.order_number} → ${label(order_status)}`)
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders & logistics</h1>
          <p className="text-sm text-slate-500">{orders.length} {orders.length === 1 ? 'order matches' : 'orders match'} your filters</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCsv}
            disabled={busy === 'EXPORT'}
            title="Download every order matching the filters (works as a backup)"
            className="ak-btn-outline bg-white py-2.5"
          >
            {busy === 'EXPORT' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export CSV
          </button>
          <button onClick={reload} className="ak-btn-outline bg-white py-2.5">
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
        Unpaid orders are cancelled automatically {PAYMENT_RULES.unpaidHoldHours} hours after they are placed, and their stock
        is returned. Mark an order as paid before then to keep it.
      </p>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,180px)_auto]">
        <label className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order #, name, phone, AWB"
            className="ak-input py-2.5 pl-9 text-sm"
          />
        </label>
        <FilterSelect label="Payment" value={filters.paymentStatus} options={PAYMENT_STATUSES} onChange={(v) => setFilter('paymentStatus', v)} />
        <FilterSelect label="Delivery" value={filters.orderStatus} options={ORDER_STATUSES} onChange={(v) => setFilter('orderStatus', v)} />
        <FilterSelect label="Mode" value={filters.paymentMode} options={PAYMENT_MODES} onChange={(v) => setFilter('paymentMode', v)} />
        <button
          onClick={() => {
            resetFilters()
            setSearch('')
          }}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Reset
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error.message}</p>}
      {!loading && !error && !orders.length && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {filtersActive ? 'No orders match these filters.' : 'No orders yet. Place a test order from the storefront to see it here.'}
        </p>
      )}

      <div className="space-y-3">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} busy={busy} onShip={ship} onNotify={notify} onStatus={setStatus} onMarkPaid={markPaid} />
        ))}
      </div>
    </div>
  )
}

function FilterSelect<T extends string>({
  label: name,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | 'ALL'
  options: readonly T[]
  onChange: (v: T | 'ALL') => void
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T | 'ALL')} className="ak-input py-2.5 text-sm" aria-label={`${name} filter`}>
      <option value="ALL">{name}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  )
}

interface OrderCardProps {
  order: Order
  busy: string | null
  onShip: (o: Order, p: 'SHIPROCKET' | 'DELHIVERY') => void
  onNotify: (o: Order) => void
  onStatus: (o: Order, s: OrderStatus) => void
  onMarkPaid: (o: Order) => void
}

function OrderCard({ order: o, busy, onShip, onNotify, onStatus, onMarkPaid }: OrderCardProps) {
  const [open, setOpen] = useState(false)
  const unpaid = o.payment_status === 'PENDING' || o.payment_status === 'FAILED'
  const cancelled = o.order_status === 'CANCELLED'
  const payable = unpaid && (o.order_status === 'PLACED' || o.order_status === 'CONFIRMED')
  const nextStatuses = ORDER_TRANSITIONS[o.order_status].filter((s) => !(unpaid && s === 'DISPATCHED'))
  const shipBlocked = cancelled
    ? 'Order is cancelled'
    : unpaid
      ? 'Payment not received yet'
      : o.awb_number
        ? 'AWB already generated'
        : !ORDER_TRANSITIONS[o.order_status].includes('DISPATCHED')
          ? `Order is already ${label(o.order_status).toLowerCase()}`
          : null
  const isBusy = (k: string) => busy === `${o.id}:${k}`

  return (
    <article className="rounded-2xl border border-slate-200 bg-white">
      <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono font-semibold">{o.order_number}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_TONE[o.order_status])}>{label(o.order_status)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{formatDate(o.created_at)}</p>
          <p className="mt-2 text-sm font-medium">{o.customer_name}</p>
          <a href={`tel:${o.customer_phone}`} className="flex items-center gap-1 text-xs text-slate-500 hover:underline">
            <Phone className="size-3" /> {o.customer_phone} · {o.shipping_address.city}, {o.shipping_address.state}
          </a>
        </div>

        <div className="text-sm">
          <p className="text-lg font-bold">{formatINR(o.final_amount)}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">{o.payment_mode === 'PREPAID_UPI' ? 'UPI Prepaid' : 'Partial COD'}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', PAYMENT_TONE[o.payment_status])}>{label(o.payment_status)}</span>
          </div>
          {o.balance_due_on_delivery > 0 && <p className="mt-1 text-xs text-slate-500">Collect on delivery: {formatINR(o.balance_due_on_delivery)}</p>}
        </div>

        <div className="text-sm">
          {o.awb_number ? (
            <>
              <p className="text-xs text-slate-500">{o.shipping_provider}</p>
              <p className="font-mono">{o.awb_number}</p>
              {safeHttpUrl(o.tracking_url) && (
                <a href={safeHttpUrl(o.tracking_url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline">
                  Tracking <ExternalLink className="size-3" />
                </a>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400">Not shipped</p>
          )}
          <select
            value={o.order_status}
            onChange={(e) => onStatus(o, e.target.value as OrderStatus)}
            disabled={isBusy('STATUS') || !nextStatuses.length}
            className="mt-2 w-full rounded-md border border-slate-200 px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-500"
            aria-label="Order status"
          >
            {[o.order_status, ...nextStatuses].map((s) => (
              <option key={s} value={s}>
                {s === o.order_status ? label(s) : `Move to: ${label(s)}`}
              </option>
            ))}
          </select>
        </div>

        <button onClick={() => setOpen((v) => !v)} className="justify-self-start text-xs font-medium text-slate-500 lg:justify-self-end" aria-expanded={open}>
          Details <ChevronDown className={cn('inline size-4 transition', open && 'rotate-180')} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
        {payable && (
          <ActionButton
            onClick={() => onMarkPaid(o)}
            disabled={false}
            title="Use after confirming the UPI payment in your bank or UPI app"
            busy={isBusy('PAID')}
            icon={<BadgeCheck className="size-4" />}
            className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          >
            Mark payment received ({formatINR(amountDueNow(o))})
          </ActionButton>
        )}
        <ActionButton onClick={() => onShip(o, 'SHIPROCKET')} disabled={!!shipBlocked} title={shipBlocked} busy={isBusy('SHIPROCKET')} icon={<Truck className="size-4" />}>
          Create Shiprocket Order / Generate AWB
        </ActionButton>
        <ActionButton onClick={() => onShip(o, 'DELHIVERY')} disabled={!!shipBlocked} title={shipBlocked} busy={isBusy('DELHIVERY')} icon={<Send className="size-4" />}>
          Create Delhivery Shipment
        </ActionButton>
        <ActionButton
          onClick={() => onNotify(o)}
          disabled={!o.awb_number}
          title={o.awb_number ? null : 'Generate an AWB first'}
          busy={isBusy('WA')}
          icon={<WhatsAppIcon className="size-4" />}
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
        >
          Send WhatsApp Tracking Notification
        </ActionButton>
      </div>

      {open && (
        <div className="grid gap-4 border-t border-slate-100 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Items</p>
            <ul className="space-y-1">
              {o.items?.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>
                    {i.product_title}
                    {i.selected_size && <span className="text-slate-500"> · {i.selected_size}</span>} × {i.quantity}
                  </span>
                  <span>{formatINR(i.unit_price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              MRP {formatINR(o.total_mrp)} · Discount {formatINR(o.discount_amount)} · Advance paid {formatINR(o.advance_paid)}
            </p>
            {o.payment_gateway_ref && <p className="mt-1 font-mono text-xs text-slate-400">Ref: {o.payment_gateway_ref}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Ship to</p>
            <p>{o.customer_name}</p>
            <p className="text-slate-600">
              {o.shipping_address.address_line}
              {o.shipping_address.landmark && `, ${o.shipping_address.landmark}`}
              <br />
              {o.shipping_address.city}, {o.shipping_address.state} – {o.shipping_address.pincode}
            </p>
          </div>
        </div>
      )}
    </article>
  )
}

function ActionButton({
  children,
  icon,
  busy,
  title,
  className,
  ...props
}: {
  children: ReactNode
  icon: ReactNode
  busy: boolean
  title: string | null
  className?: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      title={title ?? undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}