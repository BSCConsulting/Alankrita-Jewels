import type { ReactNode } from 'react'
import { Check, ShieldCheck, Truck, Zap } from 'lucide-react'
import { PAYMENT_RULES } from '@/config/site'
import { cn, formatINR } from '@/lib/format'
import { paymentModeBlocker, type OrderTotals } from '@/lib/pricing'
import type { PaymentMode } from '@/types'

interface Props {
  value: PaymentMode
  onChange: (mode: PaymentMode) => void
  prepaid: OrderTotals
  partial: OrderTotals
  cod: OrderTotals
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', checked ? 'border-primary bg-primary' : 'border-line')}>
      {checked && <Check className="size-3 text-primary-ink" strokeWidth={3} />}
    </span>
  )
}

function Option({
  mode,
  value,
  onChange,
  blocker,
  children,
}: {
  mode: PaymentMode
  value: PaymentMode
  onChange: (mode: PaymentMode) => void
  blocker: string | null
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={value === mode}
      disabled={Boolean(blocker)}
      onClick={() => onChange(mode)}
      className={cn(
        'w-full rounded-xl border-2 p-4 text-left transition disabled:opacity-50',
        value === mode ? 'border-primary bg-primary/5 shadow-md' : 'border-line hover:border-primary/50',
      )}
    >
      <div className="flex items-start gap-3">
        <Radio checked={value === mode} />
        <div className="flex-1">
          {children}
          {blocker && <p className="mt-1 text-xs text-red-700">{blocker}</p>}
        </div>
      </div>
    </button>
  )
}

export function PaymentModeSelector({ value, onChange, prepaid, partial, cod }: Props) {
  const advance = PAYMENT_RULES.partialCodAdvance
  const coveredByGiftCard = prepaid.finalAmount === 0 && prepaid.giftCardAmount > 0

  return (
    <div className="space-y-3" role="radiogroup" aria-label="Payment method">
      <Option mode="PREPAID_UPI" value={value} onChange={onChange} blocker={null}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Instant UPI / Online Payment (5% Instant Discount)</p>
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">RECOMMENDED</span>
        </div>
        <p className="mt-2 flex gap-1.5 rounded-lg bg-gradient-to-r from-amber-100 to-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          <Zap className="mt-0.5 size-3.5 shrink-0" />
          Shubha Aarambham Offer: Save 5% instantly on online payment & receive insured priority dispatch!
        </p>
        <p className="mt-2 text-sm">
          {coveredByGiftCard ? (
            <>Fully covered by your gift card — nothing to pay.</>
          ) : (
            <>
              Pay <strong>{formatINR(prepaid.finalAmount)}</strong>{' '}
              <span className="text-emerald-700">(you save an extra {formatINR(prepaid.prepaidDiscount)})</span>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-ink-muted">UPI · GPay · PhonePe · Paytm · Cards · Netbanking</p>
      </Option>

      <Option mode="PARTIAL_COD" value={value} onChange={onChange} blocker={paymentModeBlocker('PARTIAL_COD', partial)}>
        <p className="font-semibold">Partial COD (Reserve with ₹{advance} Advance)</p>
        <p className="mt-2 text-sm">
          Pay <strong>₹{advance}</strong> now via UPI to lock your piece; pay the remaining{' '}
          <strong>{formatINR(partial.balanceOnDelivery)}</strong> in cash/UPI to the courier on delivery.
        </p>
        <p className="mt-2 flex gap-1.5 text-xs text-ink-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Your advance confirms the order straight away for priority dispatch.
        </p>
      </Option>

      <Option mode="COD" value={value} onChange={onChange} blocker={paymentModeBlocker('COD', cod)}>
        <p className="font-semibold">Cash on Delivery (+{formatINR(PAYMENT_RULES.codFee)} handling)</p>
        <p className="mt-2 text-sm">
          Pay <strong>{formatINR(cod.finalAmount)}</strong> in cash or UPI to the courier when your parcel arrives. Nothing to pay now.
        </p>
        <p className="mt-2 flex gap-1.5 text-xs text-ink-muted">
          <Truck className="mt-0.5 size-3.5 shrink-0" />
          Available on orders up to {formatINR(PAYMENT_RULES.codMaxAmount)}.
        </p>
      </Option>
    </div>
  )
}
