import { Link, useParams } from 'react-router'
import { CheckCircle2, Clock, PackageCheck, Truck, Video, XCircle } from 'lucide-react'
import { GuaranteeCard } from '@/components/orders/GuaranteeCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useAsync } from '@/hooks/useAsync'
import { PAYMENT_RULES } from '@/config/site'
import { formatDay, formatINR } from '@/lib/format'
import { useSeo } from '@/lib/seo'
import { whatsappLink } from '@/lib/whatsapp'
import { amountDueNow, fetchOrderByNumber } from '@/services/orders'

const STEPS = [
  { icon: PackageCheck, title: 'Quality check & insured packing', body: 'Within 24 hours' },
  { icon: Truck, title: 'Dispatched with tracking on WhatsApp', body: '2–3 days to AP & Telangana' },
  { icon: Video, title: 'Record your unboxing video', body: 'Required for any damage claim' },
]

export default function OrderSuccessPage() {
  const { orderNumber = '' } = useParams()
  useSeo({ title: `Order ${orderNumber}`, noindex: true })
  const { data: order, loading } = useAsync(() => fetchOrderByNumber(orderNumber), [orderNumber])

  const cancelled = order?.order_status === 'CANCELLED'
  const failed = order?.payment_status === 'FAILED' && !cancelled
  const dueNow = order ? amountDueNow(order) : 0
  // Cash-on-delivery orders are pending payment by design; nothing is awaited online.
  const delivered = order?.order_status === 'DELIVERED'
  const awaitingPayment = order?.payment_status === 'PENDING' && !cancelled && !delivered && dueNow > 0
  const payOnDelivery = order?.payment_mode === 'COD' && !cancelled && !delivered

  if (!loading && !order)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary">Order not found</h1>
        <p className="mt-3 text-ink-muted">
          We couldn't find order <strong className="font-mono">{orderNumber}</strong> for this mobile number. Message us on WhatsApp and we'll help.
        </p>
        <a href={whatsappLink(`Hi Alankrita Jewels, I need help with order ${orderNumber}.`)} target="_blank" rel="noopener noreferrer" className="ak-btn-whatsapp mt-6 py-3.5">
          <WhatsAppIcon className="size-5" /> Chat on WhatsApp
        </a>
      </div>
    )

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6" data-clarity-mask="True">
      {!order ? (
        <div className="space-y-3 text-center">
          <Skeleton className="mx-auto size-16 rounded-full" />
          <Skeleton className="mx-auto h-10 w-2/3" />
        </div>
      ) : (
        <div className="text-center">
          {awaitingPayment ? (
            <Clock className="mx-auto size-16 text-amber-600" />
          ) : cancelled || failed ? (
            <XCircle className="mx-auto size-16 text-red-600" />
          ) : (
            <CheckCircle2 className="mx-auto size-16 text-emerald-600" />
          )}
          <h1 className="mt-4 font-display text-4xl font-bold text-primary">
            {awaitingPayment ? 'Order received' : cancelled ? 'Order cancelled' : failed ? 'Payment failed' : 'Dhanyavaadalu!'}
          </h1>
          <p lang="te" className="text-lg text-ink-muted">
            {awaitingPayment
              ? 'మీ ఆర్డర్ అందింది'
              : cancelled
                ? 'ఈ ఆర్డర్ రద్దు చేయబడింది'
                : failed
                  ? 'చెల్లింపు విఫలమైంది'
                  : delivered
                    ? 'మీ ఆర్డర్ డెలివరీ అయింది'
                    : 'మీ ఆర్డర్ నిర్ధారించబడింది'}
          </p>
          <p className="mt-3">
            Order <strong className="font-mono">{orderNumber}</strong>{' '}
            {awaitingPayment
              ? 'will be confirmed once payment is received.'
              : cancelled
                ? 'has been cancelled.'
                  : failed
                  ? 'is not confirmed because the payment did not go through. Message us on WhatsApp and we will help you complete it.'
                  : delivered
                    ? `was delivered${order!.delivered_at ? ` on ${formatDay(order!.delivered_at)}` : ''}.`
                    : payOnDelivery
                      ? `is placed. Pay ${formatINR(order!.balance_due_on_delivery)} in cash or UPI to the courier on delivery.`
                      : 'is confirmed.'}
          </p>
          {failed && (
            <a
              href={whatsappLink(`Hi Alankrita Jewels, the payment for my order ${orderNumber} failed. Please help me complete it.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="ak-btn-whatsapp mx-auto mt-5 inline-flex px-6 py-3.5"
            >
              <WhatsAppIcon className="size-5" /> Get help on WhatsApp
            </a>
          )}
        </div>
      )}

      {awaitingPayment && (
        <div className="mt-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950">
          <p className="text-sm font-semibold tracking-wide uppercase">Complete your payment</p>
          <p className="mt-1 text-3xl font-bold">{formatINR(dueNow)}</p>
          <p className="mt-2 text-sm">
            {order?.payment_mode === 'PARTIAL_COD'
              ? `Pay the ${formatINR(dueNow)} advance by UPI to reserve your piece. The balance is paid to the courier on delivery.`
              : 'Pay by any UPI app (GPay, PhonePe, Paytm).'}{' '}
            Tap below to message us on WhatsApp — we'll reply with our UPI details and confirm your order as soon as payment arrives.
          </p>
          <p className="mt-2 text-xs text-amber-900/80">Unpaid orders are cancelled automatically after {PAYMENT_RULES.unpaidHoldHours} hours.</p>
          <a
            href={whatsappLink(
              `Hi Alankrita Jewels, I placed order ${orderNumber} and would like to pay ${formatINR(dueNow)} by UPI. Please share the payment details.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="ak-btn-whatsapp mt-4 w-full py-3.5"
          >
            <WhatsAppIcon className="size-5" /> Pay {formatINR(dueNow)} via WhatsApp
          </a>
        </div>
      )}

      {loading && !order && <Skeleton className="mt-8 h-48 w-full" />}

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
            {order.offer_label && order.offer_discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>{order.offer_label}</dt>
                <dd>−{formatINR(order.offer_discount)}</dd>
              </div>
            )}
            {order.prepaid_discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>UPI offer (5%)</dt>
                <dd>−{formatINR(order.prepaid_discount)}</dd>
              </div>
            )}
            {order.cod_fee > 0 && (
              <div className="flex justify-between">
                <dt>Cash on delivery handling</dt>
                <dd>+{formatINR(order.cod_fee)}</dd>
              </div>
            )}
            {order.gift_wrap_fee > 0 && (
              <div className="flex justify-between">
                <dt>Gift wrap</dt>
                <dd>+{formatINR(order.gift_wrap_fee)}</dd>
              </div>
            )}
            {order.gift_card_amount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Gift card</dt>
                <dd>−{formatINR(order.gift_card_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Order total</dt>
              <dd className="font-semibold">{formatINR(order.final_amount)}</dd>
            </div>
            {order.advance_paid > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Paid</dt>
                <dd>{formatINR(order.advance_paid)}</dd>
              </div>
            )}
            {order.balance_due_on_delivery > 0 && !cancelled && !delivered && order.payment_status !== 'PAID' && (
              <div className="flex justify-between font-semibold">
                <dt>Pay courier on delivery</dt>
                <dd>{formatINR(order.balance_due_on_delivery)}</dd>
              </div>
            )}
            {(order.gift_wrap || order.free_gift) && (
              <p className="pt-1 text-xs text-ink-muted">
                {[order.gift_wrap && 'Gift wrapped, no prices in the parcel', order.free_gift && `Free ${order.free_gift.toLowerCase()} included`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
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

      {order && <GuaranteeCard order={order} />}

      {order && !cancelled && !failed && !delivered && (
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
      )}

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <a
          href={whatsappLink(
            delivered ? `Hi Alankrita Jewels, I have a question about order ${orderNumber}.` : `Hi Alankrita Jewels, I just placed order ${orderNumber}.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="ak-btn-whatsapp py-3.5"
        >
          <WhatsAppIcon className="size-5" /> {delivered ? 'Chat with us on WhatsApp' : 'Get updates on WhatsApp'}
        </a>
        <Link to="/" className="ak-btn-outline py-3.5">
          Continue shopping
        </Link>
      </div>
      <Link to="/orders" className="mt-4 block text-center text-sm font-semibold text-primary underline underline-offset-4">
        View all my orders
      </Link>
    </div>
  )
}
