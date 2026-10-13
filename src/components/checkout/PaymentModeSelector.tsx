import { Ban, BadgeIndianRupee, Check, ShieldCheck, Zap } from 'lucide-react'
import { PAYMENT_RULES } from '@/config/site'
import { cn, formatINR } from '@/lib/format'
import type { OrderTotals } from '@/lib/pricing'
import type { PaymentMode } from '@/types'

interface Props {
  value: PaymentMode
  onChange: (mode: PaymentMode) => void
  prepaid: OrderTotals
  partial: OrderTotals
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', checked ? 'border-primary bg-primary' : 'border-line')}>
      {checked && <Check className="size-3 text-primary-ink" strokeWidth={3} />}
    </span>
  )
}

export function PaymentModeSelector({ value, onChange, prepaid, partial }: Props) {
  const advance = PAYMENT_RULES.partialCodAdvance
  const partialAvailable = partial.finalAmount > advance

  return (
    <div className="space-y-3" role="radiogroup" aria-label="Payment method">
      <button
        type="button"
        role="radio"
        aria-checked={value === 'PREPAID_UPI'}
        onClick={() => onChange('PREPAID_UPI')}
        className={cn(
          'w-full rounded-xl border-2 p-4 text-left transition',
          value === 'PREPAID_UPI' ? 'border-primary bg-primary/5 shadow-md' : 'border-line hover:border-primary/50',
        )}
      >
        <div className="flex items-start gap-3">
          <Radio checked={value === 'PREPAID_UPI'} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Instant UPI / Online Payment (5% Instant Discount)</p>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">RECOMMENDED</span>
            </div>
            <p className="mt-2 flex gap-1.5 rounded-lg bg-gradient-to-r from-amber-100 to-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              <Zap className="mt-0.5 size-3.5 shrink-0" />
              Shubha Aarambham Offer: Save 5% instantly on online payment & receive insured priority dispatch!
            </p>
            <p className="mt-2 text-sm">
              Pay <strong>{formatINR(prepaid.finalAmount)}</strong>{' '}
              <span className="text-emerald-700">(you save an extra {formatINR(prepaid.prepaidDiscount)})</span>
            </p>
            <p className="mt-1 text-xs text-ink-muted">UPI · GPay · PhonePe · Paytm · Cards · Netbanking</p>
          </div>
        </div>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === 'PARTIAL_COD'}
        disabled={!partialAvailable}
        onClick={() => onChange('PARTIAL_COD')}
        className={cn(
          'w-full rounded-xl border-2 p-4 text-left transition disabled:opacity-50',
          value === 'PARTIAL_COD' ? 'border-primary bg-primary/5 shadow-md' : 'border-line hover:border-primary/50',
        )}
      >
        <div className="flex items-start gap-3">
          <Radio checked={value === 'PARTIAL_COD'} />
          <div className="flex-1">
            <p className="font-semibold">Partial COD (Reserve with ₹{advance} Advance)</p>
            <p className="mt-2 text-sm">
              Pay <strong>₹{advance}</strong> now via UPI to lock piece and verify order; pay remaining{' '}
              <strong>{formatINR(partial.balanceOnDelivery)}</strong> in cash/UPI to courier on delivery.
            </p>
            <p className="mt-2 flex gap-1.5 text-xs text-ink-muted">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              Eliminates bogus orders and ensures safe insured courier dispatch.
            </p>
            {!partialAvailable && <p className="mt-1 text-xs text-red-700">Available on orders above ₹{advance}.</p>}
          </div>
        </div>
      </button>

      <div className="flex items-start gap-3 rounded-xl border-2 border-dashed border-line p-4 opacity-60" aria-disabled="true">
        <Ban className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold line-through">Full Cash on Delivery</p>
          <p className="text-xs text-ink-muted">
            Not available — disabled to prevent return-to-origin (RTO) losses and keep our prices low for genuine customers.
          </p>
        </div>
        <BadgeIndianRupee className="ml-auto size-5 shrink-0" />
      </div>
    </div>
  )
}
