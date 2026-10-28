import { useEffect, useState, type ReactNode } from 'react'
import { Ban, BadgeCheck, ChevronDown, Download, ExternalLink, Gift, HandCoins, Loader2, Phone, RefreshCw, Search, Send, Star, Truck } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { PAYMENT_RULES } from '@/config/site'
import { useAsync } from '@/hooks/useAsync'
import { createDelhiveryShipment, createShiprocketOrder } from '@/integrations/logistics'
import { sendTrackingNotification } from '@/integrations/whatsappNotify'
import { datedFilename, downloadCsv, ordersToCsv } from '@/lib/csv'
import { cn, formatDate, formatINR, safeHttpUrl } from '@/lib/format'
import { toErrorMessage } from '@/lib/supabase'
import { SITE_URL } from '@/lib/seo'
import { whatsappLink } from '@/lib/whatsapp'
import { exportOrders, listOrders, ORDER_TRANSITIONS, setCodBlocked, updateOrder } from '@/services/admin'
import { amountDueNow } from '@/services/orders'
import { useAdminStore } from '@/stores/useAdminStore'
import { ORDER_STATUSES, PAYMENT_MODES, PAYMENT_STATUSES, type Order, type OrderStatus, type PaymentMode, type PaymentStatus } from '@/types'

const MODE_LABEL: Record<PaymentMode, string> = { PREPAID_UPI: 'UPI Prepaid', PARTIAL_COD: 'Partial COD', COD: 'Cash on delivery' }

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

const reviewRequestText = (o: Order) =>
  `Namaste ${o.customer_name.split(' ')[0]} garu 🙏 Hope you loved your Alankrita Jewels order ${o.order_number}! ` +
  `If you have a minute, please share a review (a photo wearing it would be lovely): ${SITE_URL}/orders — open "My orders" and tap "Write a review". Thank you!`

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

  /** Cash (or UPI) the courier collected on delivery: full COD, or the Partial COD balance. */
  const markCollected = (order: Order) =>
    run(`${order.id}:COLLECTED`, async () => {
      if (!confirm(`Confirm the courier collected ${formatINR(order.balance_due_on_delivery)} for ${order.order_number}?`)) return
      replace(await updateOrder(order.id, { payment_status: 'PAID' }))
      toast.success(`${order.order_number}: payment collected`)
    })

  const blockCod = (order: Order) =>
    run(`${order.id}:BLOCK`, async () => {
      if (!order.user_id) return
      if (!confirm(`Stop cash on delivery for ${order.customer_name} (${order.customer_phone})? They can still pay online or use Partial COD.`)) return
      await setCodBlocked(order.user_id, true)
      toast.success(`Cash on delivery turned off for ${order.customer_phone}`)
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
        Unpaid online orders are cancelled automatically {PAYMENT_RULES.unpaidHoldHours} hours after they are placed, and their
        stock is returned. Mark an order as paid before then to keep it. Cash-on-delivery orders are never auto-cancelled.
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
        <FilterSelect label="Mode" value={filters.paymentMode} options={PAYMENT_MODES} labels={MODE_LABEL} onChange={(v) => setFilter('paymentMode', v)} />
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
          <OrderCard
            key={o.id}
            order={o}
            busy={busy}
            onShip={ship}
            onNotify={notify}
            onStatus={setStatus}
            onMarkPaid={markPaid}
            onCollected={markCollected}
            onBlockCod={blockCod}
          />
        ))}
      </div>
    </div>
  )
}

function FilterSelect<T extends string>({
  label: name,
  value,
  options,
  labels,
  onChange,
}: {
  label: string
  value: T | 'ALL'
  options: readonly T[]
  labels?: Record<T, string>
  onChange: (v: T | 'ALL') => void
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T | 'ALL')} className="ak-input py-2.5 text-sm" aria-label={`${name} filter`}>
      <option value="ALL">{name}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? label(o)}
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
  onCollected: (o: Order) => void
  onBlockCod: (o: Order) => void
}

function OrderCard({ order: o, busy, onShip, onNotify, onStatus, onMarkPaid, onCollected, onBlockCod }: OrderCardProps) {
  const [open, setOpen] = useState(false)
  const isCod = o.payment_mode === 'COD'
  const unpaid = o.payment_status === 'PENDING' || o.payment_status === 'FAILED'
  // Full COD ships unpaid; the courier collects the cash.
  const awaitingPayment = unpaid && !(isCod && o.payment_status === 'PENDING')
  const cancelled = o.order_status === 'CANCELLED'
  const payable = awaitingPayment && amountDueNow(o) > 0 && (o.order_status === 'PLACED' || o.order_status === 'CONFIRMED')
  const collectable =
    !cancelled &&
    o.balance_due_on_delivery > 0 &&
    (o.order_status === 'DISPATCHED' || o.order_status === 'DELIVERED') &&
    ((isCod && o.payment_status === 'PENDING') || o.payment_status === 'PARTIAL_PAID')
  const nextStatuses = ORDER_TRANSITIONS[o.order_status].filter((s) => !(awaitingPayment && s === 'DISPATCHED'))
  const shipBlocked = cancelled
    ? 'Order is cancelled'
    : awaitingPayment
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
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">{MODE_LABEL[o.payment_mode]}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', PAYMENT_TONE[o.payment_status])}>{label(o.payment_status)}</span>
            {o.gift_wrap && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                <Gift className="size-3" /> Gift wrap
              </span>
            )}
          </div>
          {o.balance_due_on_delivery > 0 && o.payment_status !== 'PAID' && (
            <p className="mt-1 text-xs text-slate-500">Collect on delivery: {formatINR(o.balance_due_on_delivery)}</p>
          )}
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
        {collectable && (
          <ActionButton
            onClick={() => onCollected(o)}
            disabled={false}
            title="Use once the courier has remitted (or confirmed) the amount collected on delivery"
            busy={isBusy('COLLECTED')}
            icon={<HandCoins className="size-4" />}
            className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          >
            Mark {isCod ? 'cash' : 'balance'} collected ({formatINR(o.balance_due_on_delivery)})
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
        {o.order_status === 'DELIVERED' && (
          <a
            href={whatsappLink(reviewRequestText(o), o.customer_phone.replace(/\D/g, ''))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50"
          >
            <Star className="size-4" /> Ask for a review on WhatsApp
          </a>
        )}
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
            <p className="mt-1 text-xs text-slate-500">
              {[
                o.offer_label && `${o.offer_label} −${formatINR(o.offer_discount)}`,
                o.cod_fee > 0 && `COD fee +${formatINR(o.cod_fee)}`,
                o.gift_wrap_fee > 0 && `Gift wrap +${formatINR(o.gift_wrap_fee)}`,
                o.gift_card_amount > 0 && `Gift card −${formatINR(o.gift_card_amount)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {o.free_gift && <p className="mt-1 text-xs font-semibold text-amber-800">Pack free gift: {o.free_gift}</p>}
            {o.payment_gateway_ref && <p className="mt-1 font-mono text-xs text-slate-400">Ref: {o.payment_gateway_ref}</p>}
            {isCod && o.user_id && (
              <button
                type="button"
                onClick={() => onBlockCod(o)}
                disabled={isBusy('BLOCK')}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
              >
                <Ban className="size-3.5" /> Stop COD for this customer (refused parcel)
              </button>
            )}
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
            {o.gift_wrap && (
              <div className="mt-3 rounded-lg bg-rose-50 p-3 text-rose-900">
                <p className="text-xs font-semibold uppercase">Gift wrap · no prices in the parcel</p>
                {o.gift_message && <p className="mt-1 whitespace-pre-line">“{o.gift_message}”</p>}
              </div>
            )}
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