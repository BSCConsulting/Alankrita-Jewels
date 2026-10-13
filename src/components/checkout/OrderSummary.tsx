import { formatINR } from '@/lib/format'
import type { OrderTotals } from '@/lib/pricing'
import type { CartItem } from '@/stores/useCartStore'
import type { PaymentMode } from '@/types'

export function OrderSummary({ items, totals, mode }: { items: CartItem[]; totals: OrderTotals; mode: PaymentMode }) {
  return (
    <div className="ak-card p-5">
      <h2 className="font-display text-xl font-semibold">Order summary</h2>
      <ul className="mt-4 space-y-3">
        {items.map((i) => (
          <li key={i.key} className="flex gap-3">
            <div className="relative shrink-0">
              <img src={i.image} alt="" className="size-14 rounded-md border border-line object-cover" />
              <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">
                {i.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="line-clamp-1 font-medium">{i.title}</p>
              {i.size && <p className="text-xs text-ink-muted">Size {i.size}</p>}
            </div>
            <p className="text-sm font-semibold">{formatINR(i.salePrice * i.quantity)}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        <Row label="MRP total" value={formatINR(totals.totalMrp)} muted />
        <Row label="Product discount" value={`−${formatINR(totals.productSavings)}`} positive />
        {mode === 'PREPAID_UPI' && <Row label="Shubha Aarambham UPI offer (5%)" value={`−${formatINR(totals.prepaidDiscount)}`} positive />}
        <Row label="Insured shipping" value="FREE" positive />
        <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
          <dt>Order total</dt>
          <dd>{formatINR(totals.finalAmount)}</dd>
        </div>
        <div className="mt-2 space-y-1.5 rounded-lg bg-surface-muted p-3">
          <Row label="Pay now (UPI)" value={formatINR(totals.payNow)} strong />
          {mode === 'PARTIAL_COD' && <Row label="Pay on delivery (cash/UPI)" value={formatINR(totals.balanceOnDelivery)} />}
        </div>
        <p className="pt-1 text-center text-xs font-semibold text-emerald-700">
          You save {formatINR(totals.discountAmount)} on this order
        </p>
      </dl>
    </div>
  )
}

function Row({ label, value, muted, positive, strong }: { label: string; value: string; muted?: boolean; positive?: boolean; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-ink-muted' : ''} ${positive ? 'text-emerald-700' : ''} ${strong ? 'font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
