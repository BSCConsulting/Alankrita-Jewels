import { useEffect } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Loader2, LogOut, PackageSearch } from 'lucide-react'
import { MobileVerificationStep } from '@/components/checkout/MobileVerificationStep'
import { useAsync } from '@/hooks/useAsync'
import { cn, formatDate, formatINR, maskPhone } from '@/lib/format'
import { useSeo } from '@/lib/seo'
import { amountDueNow, fetchMyOrders } from '@/services/orders'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCheckoutStore } from '@/stores/useCheckoutStore'
import type { Order } from '@/types'

const STATUS: Record<Order['order_status'], { label: string; tone: string }> = {
  PLACED: { label: 'Placed', tone: 'bg-slate-100 text-slate-700' },
  CONFIRMED: { label: 'Confirmed', tone: 'bg-indigo-100 text-indigo-800' },
  DISPATCHED: { label: 'Shipped', tone: 'bg-violet-100 text-violet-800' },
  DELIVERED: { label: 'Delivered', tone: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-red-100 text-red-700' },
}

export default function MyOrdersPage() {
  useSeo({ title: 'My orders', noindex: true })
  const { userId, phone, initialized, init, signOut } = useAuthStore()

  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-16 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">My orders</h1>
          <p lang="te" className="text-sm text-ink-muted">
            నా ఆర్డర్లు
          </p>
        </div>
        {userId && (
          <button
            type="button"
            onClick={() => {
              useCheckoutStore.getState().forgetDetails()
              void signOut()
            }}
            className="flex items-center gap-1.5 py-2 text-sm text-ink-muted hover:text-primary">
            <LogOut className="size-4" /> Sign out
          </button>
        )}
      </div>

      {!initialized ? (
        <Loader2 className="mx-auto mt-16 size-8 animate-spin text-ink-muted" />
      ) : userId ? (
        <OrderList phone={phone} />
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-muted">Verify the mobile number you ordered with to see your orders and their status.</p>
          <MobileVerificationStep />
        </>
      )}
    </div>
  )
}

function OrderList({ phone }: { phone: string | null }) {
  const { data, loading, error } = useAsync(() => fetchMyOrders(phone), [phone])

  if (loading) return <Loader2 className="mx-auto mt-16 size-8 animate-spin text-ink-muted" />
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Couldn’t load your orders: {error.message}</p>

  return (
    <>
      {phone && <p className="mb-4 text-sm text-ink-muted">Signed in as {maskPhone(phone)}</p>}
      {!data?.length ? (
        <div className="ak-card flex flex-col items-center gap-3 p-10 text-center">
          <PackageSearch className="size-10 text-ink-muted" />
          <p className="font-medium">No orders yet</p>
          <Link to="/" className="ak-btn-primary mt-2">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((o) => (
            <li key={o.id}>
              <OrderRow order={o} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function OrderRow({ order: o }: { order: Order }) {
  const awaitingPayment = o.payment_status === 'PENDING' && o.order_status !== 'CANCELLED'
  const items = o.items ?? []
  const status = STATUS[o.order_status]
  const summary = items.length ? `${items[0].product_title}${items.length > 1 ? ` + ${items.length - 1} more` : ''}` : ''

  return (
    <Link to={`/order/${o.order_number}`} className="ak-card flex items-center gap-4 p-4 transition hover:border-accent">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-semibold">{o.order_number}</p>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', status.tone)}>{status.label}</span>
          {awaitingPayment && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Pay {formatINR(amountDueNow(o))}</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm">{summary}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{formatDate(o.created_at)}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold">{formatINR(o.final_amount)}</p>
        <ChevronRight className="ml-auto size-4 text-ink-muted" />
      </div>
    </Link>
  )
}
