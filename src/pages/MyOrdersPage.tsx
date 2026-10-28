import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Loader2, LogOut, PackageSearch, ShieldCheck, Star } from 'lucide-react'
import { MobileVerificationStep } from '@/components/checkout/MobileVerificationStep'
import { ReviewForm } from '@/components/reviews/ReviewForm'
import { useAsync } from '@/hooks/useAsync'
import { cn, formatDate, formatDay, formatINR, maskPhone } from '@/lib/format'
import { orderGuarantees } from '@/lib/guarantee'
import { useSeo } from '@/lib/seo'
import { amountDueNow, fetchMyOrders } from '@/services/orders'
import { fetchMyUnpublishedReviews } from '@/services/reviews'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCheckoutStore } from '@/stores/useCheckoutStore'
import type { Order, ReviewStatus } from '@/types'

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
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-16 sm:px-6" data-clarity-mask="True">
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
            className="flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-primary">
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
  const userId = useAuthStore((s) => s.userId)
  const { data, loading, error } = useAsync(() => fetchMyOrders(phone), [phone])
  const [reviewed, setReviewed] = useState<Map<string, ReviewStatus>>(new Map())
  const [reviewing, setReviewing] = useState<{ productId: string; title: string } | null>(null)

  useEffect(() => {
    fetchMyUnpublishedReviews(userId).then(setReviewed, () => {})
  }, [userId])

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
              {o.order_status === 'DELIVERED' && (
                <ReviewStrip order={o} reviewed={reviewed} onReview={(productId, title) => setReviewing({ productId, title })} />
              )}
            </li>
          ))}
        </ul>
      )}
      {reviewing && (
        <ReviewForm
          open
          productId={reviewing.productId}
          productTitle={reviewing.title}
          onClose={() => setReviewing(null)}
          onSubmitted={() => setReviewed((m) => new Map(m).set(reviewing.productId, 'pending'))}
        />
      )}
    </>
  )
}

const REVIEW_STATE: Partial<Record<ReviewStatus, string>> = {
  pending: 'Review received, awaiting approval',
  rejected: 'Review not published',
}

function ReviewStrip({
  order,
  reviewed,
  onReview,
}: {
  order: Order
  reviewed: Map<string, ReviewStatus>
  onReview: (productId: string, title: string) => void
}) {
  // One row per piece, even if it was bought in two sizes.
  const pieces = [...new Map((order.items ?? []).filter((i) => i.product_id).map((i) => [i.product_id!, i.product_title])).entries()]
  if (!pieces.length) return null
  const cover = new Map(orderGuarantees(order).map((g) => [g.productId, g]))
  return (
    <ul className="-mt-2 space-y-2 rounded-b-2xl border border-t-0 border-line bg-surface-muted/60 px-4 pt-4 pb-3">
      {pieces.map(([productId, title]) => {
        const state = reviewed.get(productId)
        const g = cover.get(productId)
        return (
          <li key={productId} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate">{title}</span>
              {g && (
                <Link to={`/order/${order.order_number}`} className="ak-hit relative flex items-center gap-1 text-xs text-ink-muted hover:text-primary">
                  <ShieldCheck className="size-3.5 shrink-0" />
                  {g.status === 'ended' ? `Guarantee ended ${formatDay(g.endsAt.toISOString())}` : `Guarantee till ${formatDay(g.endsAt.toISOString())}`}
                </Link>
              )}
            </span>
            {state && REVIEW_STATE[state] ? (
              <span className="shrink-0 text-xs text-ink-muted">{REVIEW_STATE[state]}</span>
            ) : (
              <button type="button" onClick={() => onReview(productId, title)} className="ak-hit relative flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Star className="size-3.5" /> Write a review
              </button>
            )}
          </li>
        )
      })}
    </ul>
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
