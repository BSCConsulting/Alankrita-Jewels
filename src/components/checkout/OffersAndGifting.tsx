import { useState } from 'react'
import { Gift, Loader2, TicketPercent, X } from 'lucide-react'
import { OFFER_RULES } from '@/config/site'
import { formatGiftCardCode, formatINR } from '@/lib/format'
import type { CouponRule, OrderTotals } from '@/lib/pricing'
import { toCustomerMessage } from '@/lib/supabase'
import { checkCoupon, checkGiftCard, type CodeCheck } from '@/services/orders'

export interface AppliedGiftCard {
  code: string
  balance: number
}

interface Props {
  phone: string | null
  totals: OrderTotals
  coupon: CouponRule | null
  onCoupon: (coupon: CouponRule | null) => void
  giftCard: AppliedGiftCard | null
  onGiftCard: (card: AppliedGiftCard | null) => void
  giftWrap: boolean
  onGiftWrap: (on: boolean) => void
  giftMessage: string
  onGiftMessage: (message: string) => void
}

export function OffersAndGifting(props: Props) {
  const { totals, coupon, giftCard, giftWrap, giftMessage } = props

  return (
    <section className="ak-card space-y-5 p-5 sm:p-7">
      <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <TicketPercent className="size-5 text-primary" /> Offers & gifting
      </h2>

      {totals.offer && totals.offer.kind !== 'coupon' && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {totals.offer.label} applied: <strong>−{formatINR(totals.offer.amount)}</strong>
        </p>
      )}

      <CodeField
        label="Coupon code"
        placeholder="e.g. WELCOME10"
        applied={coupon ? `${coupon.code}${coupon.description ? ` · ${coupon.description}` : ''}` : null}
        note={totals.couponNote}
        check={(code) => checkCoupon(code, props.phone)}
        onApply={props.onCoupon}
        onRemove={() => props.onCoupon(null)}
      />

      <CodeField
        label="Gift card"
        placeholder="12-character code"
        applied={giftCard ? `${formatGiftCardCode(giftCard.code)} · ${formatINR(totals.giftCardAmount)} used of ${formatINR(giftCard.balance)}` : null}
        check={checkGiftCard}
        onApply={props.onGiftCard}
        onRemove={() => props.onGiftCard(null)}
      />

      <div className="space-y-3 rounded-xl border border-line p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--ak-primary)]" checked={giftWrap} onChange={(e) => props.onGiftWrap(e.target.checked)} />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-semibold">
              <Gift className="size-4 text-primary" /> Gift wrap this order (+{formatINR(OFFER_RULES.giftWrapFee)})
            </span>
            <span className="text-ink-muted">Festive box with a handwritten card. Prices are never shown in the parcel.</span>
          </span>
        </label>
        {giftWrap && (
          <label className="block">
            <span className="ak-label">Message on the card (optional)</span>
            <textarea
              className="ak-input min-h-20"
              maxLength={OFFER_RULES.giftMessageMaxLength}
              value={giftMessage}
              onChange={(e) => props.onGiftMessage(e.target.value)}
              placeholder="Happy Varalakshmi Vratham, Amma!"
            />
            <span className="mt-1 block text-right text-xs text-ink-muted">
              {giftMessage.length}/{OFFER_RULES.giftMessageMaxLength}
            </span>
          </label>
        )}
      </div>

      {totals.freeGift && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          🎁 A free <strong>{totals.freeGift.toLowerCase()}</strong> comes with this order.
        </p>
      )}
    </section>
  )
}

function CodeField<T>({
  label,
  placeholder,
  applied,
  note,
  check,
  onApply,
  onRemove,
}: {
  label: string
  placeholder: string
  applied: string | null
  note?: string | null
  check: (code: string) => Promise<CodeCheck<T>>
  onApply: (value: T) => void
  onRemove: () => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const apply = async () => {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await check(code)
      if (result.valid) {
        onApply(result.value)
        setCode('')
      } else setMessage(result.message)
    } catch (e) {
      setMessage(toCustomerMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (applied)
    return (
      <div>
        <span className="ak-label">{label}</span>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="min-w-0 break-words">{applied}</span>
          <button type="button" onClick={onRemove} className="shrink-0 rounded p-1 hover:bg-emerald-100" aria-label={`Remove ${label.toLowerCase()}`}>
            <X className="size-4" />
          </button>
        </div>
        {note && <p className="mt-1 text-xs text-amber-800">{note}</p>}
      </div>
    )

  return (
    <div>
      <label className="ak-label" htmlFor={`code-${label}`}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={`code-${label}`}
          className="ak-input uppercase placeholder:normal-case"
          value={code}
          maxLength={30}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder={placeholder}
          onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
          onKeyDown={(e) => {
            // Enter applies the code instead of submitting the whole checkout form.
            if (e.key === 'Enter') {
              e.preventDefault()
              void apply()
            }
          }}
        />
        <button type="button" onClick={() => void apply()} disabled={busy || !code} className="ak-btn-outline shrink-0 px-4">
          {busy ? <Loader2 className="size-4 animate-spin" /> : 'Apply'}
        </button>
      </div>
      {message && <p className="ak-error mt-1 block">{message}</p>}
    </div>
  )
}
