import { Link, useParams } from 'react-router'
import { CheckCircle2, Clock, PackageCheck, Truck, Video } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useAsync } from '@/hooks/useAsync'
import { formatINR } from '@/lib/format'
import { useSeo } from '@/lib/seo'
import { whatsappLink } from '@/lib/whatsapp'
import { fetchOrderByNumber } from '@/services/orders'

const STEPS = [
  { icon: PackageCheck, title: 'Quality check & insured packing', body: 'Within 24 hours' },
  { icon: Truck, title: 'Dispatched with tracking on WhatsApp', body: '2–3 days to AP & Telangana' },
  { icon: Video, title: 'Record your unboxing video', body: 'Required for any damage claim' },
]

export default function OrderSuccessPage() {
  const { orderNumber = '' } = useParams()
  useSeo({ title: `Order ${orderNumber}`, noindex: true })
  const { data: order, loading } = useAsync(() => fetchOrderByNumber(orderNumber), [orderNumber])

  const isPaid = order && order.payment_status !== 'PENDING' && order.payment_status !== 'FAILED'

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-16 text-emerald-600" />
        <h1 className="mt-4 font-display text-4xl font-bold text-primary">Dhanyavaadalu!</h1>
        <p lang="te" className="text-lg text-ink-muted">
          మీ ఆర్డర్ నిర్ధారించబడింది
        </p>
        <p className="mt-3">
          Order <strong className="font-mono">{orderNumber}</strong> {isPaid || !order ? 'is confirmed.' : 'is awaiting payment confirmation.'}
        </p>
      </div>

      {loading && <Skeleton className="mt-8 h-48 w-full" />}

      {order && (
        <div className="ak-card mt-8 divide-y divide-line">
          <div className="p-5">
            <ul className="space-y-2 text-sm">
              {order.items?.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    {i.product_title} {i.selected_size && <span className="text-ink-muted">· {i.selected_size}</span>} × {i.quantity}
                  </span>
                  <span className="font-medium">{formatINR(i.unit_price * i.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
          <dl className="space-y-1.5 p-5 text-sm">
            <div className="flex justify-between">
              <dt>Order total</dt>
              <dd className="font-semibold">{formatINR(order.final_amount)}</dd>
            </div>
            <div className="flex justify-between text-emerald-700">
              <dt>Paid online</dt>
              <dd>{formatINR(order.advance_paid)}</dd>
            </div>
            {order.balance_due_on_delivery > 0 && (
              <div className="flex justify-between font-semibold">
                <dt>Pay courier on delivery</dt>
                <dd>{formatINR(order.balance_due_on_delivery)}</dd>
              </div>
            )}
          </dl>
          <div className="p-5 text-sm">
            <p className="font-semibold">Delivering to {order.customer_name}</p>
            <p className="text-ink-muted">
              {order.shipping_address.address_line}
              {order.shipping_address.landmark ? `, ${order.shipping_address.landmark}` : ''}, {order.shipping_address.city},{' '}
              {order.shipping_address.state} – {order.shipping_address.pincode}
            </p>
          </div>
        </div>
      )}

      <ol className="mt-8 space-y-4">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="flex items-center gap-1 text-sm text-ink-muted">
                <Clock className="size-3.5" /> {body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <a
          href={whatsappLink(`Hi Alankrita Jewels, I just placed order ${orderNumber}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="ak-btn-whatsapp py-3.5"
        >
          <WhatsAppIcon className="size-5" /> Get updates on WhatsApp
        </a>
        <Link to="/" className="ak-btn-outline py-3.5">
          Continue shopping
        </Link>
      </div>
    </div>
  )
}
