import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Loader2, Lock, MapPin, ShoppingBag } from 'lucide-react'
import { MobileVerificationStep } from '@/components/checkout/MobileVerificationStep'
import { MockPaymentSheet } from '@/components/checkout/MockPaymentSheet'
import { OffersAndGifting, type AppliedGiftCard } from '@/components/checkout/OffersAndGifting'
import { OrderSummary } from '@/components/checkout/OrderSummary'
import { PaymentModeSelector } from '@/components/checkout/PaymentModeSelector'
import { OTHER_STATES, PRIORITY_STATES, stateFromPincode } from '@/config/states'
import { collectPayment, fetchPaymentMode, type PaymentGatewayMode } from '@/integrations/razorpay'
import { track } from '@/lib/analytics'
import { cn, formatINR, maskPhone } from '@/lib/format'
import { computeTotals, paymentModeBlocker, type CouponRule } from '@/lib/pricing'
import { customerAccessToken } from '@/lib/customerSession'
import { useSeo } from '@/lib/seo'
import { isAuthError, isSupabaseConfigured, toCustomerMessage } from '@/lib/supabase'
import { toast } from '@/components/ui/Toaster'
import { syncCartWithCatalog } from '@/services/cartSync'
import { placeOrder } from '@/services/orders'
import { useAuthStore } from '@/stores/useAuthStore'
import { toPricedLines, useCartStore } from '@/stores/useCartStore'
import { useCheckoutStore } from '@/stores/useCheckoutStore'
import type { Order, PaymentMode } from '@/types'

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name').max(80),
  address_line: z.string().trim().min(8, 'Please add house no., street and area').max(200),
  landmark: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2, 'City is required').max(60),
  state: z.string().min(2, 'Select your state'),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  paymentMode: z.enum(['PREPAID_UPI', 'PARTIAL_COD', 'COD']),
})
type DetailsForm = z.infer<typeof detailsSchema>

export default function CheckoutPage() {
  useSeo({ title: 'Secure Checkout', noindex: true })
  const navigate = useNavigate()
  const { items, clear } = useCartStore()
  const phone = useAuthStore((s) => s.phone)
  const signOut = useAuthStore((s) => s.signOut)
  const { details, paymentMode, saveDetails, setPaymentMode } = useCheckoutStore()

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [mockAmount, setMockAmount] = useState<number | null>(null)
  const [gateway, setGateway] = useState<PaymentGatewayMode>('live')
  const [coupon, setCoupon] = useState<CouponRule | null>(null)
  const [giftCard, setGiftCard] = useState<AppliedGiftCard | null>(null)
  const [giftWrap, setGiftWrap] = useState(false)
  const [giftMessage, setGiftMessage] = useState('')
  const mockResolver = useRef<((ok: boolean) => void) | null>(null)
  // Re-use an already-created order if the shopper retries payment with the same bag, address, payment
  // mode and offers, so stock isn't reserved twice. Any change places a fresh order that replaces it.
  const pendingOrder = useRef<{ order: Order; key: string } | null>(null)
  const pricesChecked = useRef(false)

  const form = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      fullName: details.fullName ?? '',
      address_line: details.address_line ?? '',
      landmark: details.landmark ?? '',
      city: details.city ?? '',
      state: details.state ?? 'Telangana',
      pincode: details.pincode ?? '',
      paymentMode,
    },
  })
  const { register, handleSubmit, watch, setValue, formState } = form
  const mode = watch('paymentMode') as PaymentMode
  const pincode = watch('pincode')

  useEffect(() => {
    const derived = stateFromPincode(pincode ?? '')
    if (derived) setValue('state', derived, { shouldValidate: true })
  }, [pincode, setValue])

  useEffect(() => {
    void fetchPaymentMode().then(setGateway)
  }, [])

  const hasItems = items.length > 0
  useEffect(() => {
    if (hasItems) track('begin_checkout')
  }, [hasItems])

  const lines = toPricedLines(items)
  const pricing = { coupon, giftWrap, giftCardBalance: giftCard?.balance ?? 0 }
  const totals = computeTotals(lines, mode, pricing)
  const prepaidTotals = computeTotals(lines, 'PREPAID_UPI', pricing)
  const partialTotals = computeTotals(lines, 'PARTIAL_COD', pricing)
  const codTotals = computeTotals(lines, 'COD', pricing)
  const modeBlocked = mode !== 'PREPAID_UPI' && Boolean(paymentModeBlocker(mode, mode === 'COD' ? codTotals : partialTotals))

  // A saved COD / Partial COD choice can become unavailable as the bag or gift card changes.
  useEffect(() => {
    if (modeBlocked) setValue('paymentMode', 'PREPAID_UPI')
  }, [modeBlocked, setValue])

  const requestMockPayment = (amount: number) =>
    new Promise<boolean>((resolve) => {
      mockResolver.current = resolve
      setMockAmount(amount)
    })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    const { paymentMode: selectedMode, fullName, ...address } = values
    saveDetails({ fullName, ...address })
    setPaymentMode(selectedMode)

    try {
      // No token can also mean a network blip, so keep the login (a fresh OTP costs an SMS); the server's 401 signs out below.
      if (isSupabaseConfigured && !(await customerAccessToken())) {
        setSubmitError("We couldn't confirm your mobile verification. Check your connection and try again, or tap Change to verify again.")
        return
      }

      const lineItems = useCartStore.getState().items
      const message = giftWrap ? giftMessage.trim() : ''
      const key = JSON.stringify([
        lineItems.map((i) => [i.key, i.quantity]),
        selectedMode,
        fullName,
        address,
        coupon?.code ?? null,
        giftCard?.code ?? null,
        giftWrap,
        message,
      ])
      let order = pendingOrder.current?.key === key ? pendingOrder.current.order : null

      if (!order) {
        // Prices can change while the bag sits in the browser; never charge a total the shopper hasn't seen.
        if (!pricesChecked.current) {
          pricesChecked.current = true
          if (await syncCartWithCatalog()) {
            setSubmitError('Your bag was updated with the latest prices and stock. Please review the total and tap the button again.')
            return
          }
        }
        const shownTotal = computeTotals(toPricedLines(lineItems), selectedMode, pricing).finalAmount
        const previous = pendingOrder.current?.order
        order = await placeOrder({
          items: lineItems.map((i) => ({ product_id: i.productId, quantity: i.quantity, selected_size: i.size })),
          customerName: fullName,
          customerPhone: phone!,
          address: { ...address, landmark: address.landmark || undefined },
          paymentMode: selectedMode,
          couponCode: coupon?.code,
          giftCardCode: giftCard?.code,
          giftWrap,
          giftMessage: message || null,
          replacesOrderId: previous?.id,
        })
        pendingOrder.current = { order, key }
        track('order_placed')
        if (previous) toast.success(`Your earlier unpaid order ${previous.order_number} was replaced by ${order.order_number}.`)
        if (order.final_amount !== shownTotal) {
          pricesChecked.current = false
          setSubmitError(
            `The order total is now ${formatINR(order.final_amount)} because prices or offers changed. Your order ${order.order_number} is on hold — review the summary and tap the button again.`,
          )
          void syncCartWithCatalog().catch(() => {})
          return
        }
      }

      const outcome = await collectPayment({ order, onMockPayment: requestMockPayment })
      if (outcome.status === 'paid') track('payment_done')
      if (outcome.status === 'paid' || outcome.status === 'offline' || outcome.status === 'none') {
        pendingOrder.current = null
        clear()
        navigate(`/order/${order.order_number}`, { replace: true })
      } else if (outcome.status === 'dismissed') {
        setSubmitError(`Payment not completed. Your order ${order.order_number} is on hold — tap the button again to pay.`)
      } else {
        setSubmitError(`Payment failed: ${outcome.reason}. Please try again or use another UPI app.`)
      }
    } catch (e) {
      if (isAuthError(e)) await signOut()
      setSubmitError(toCustomerMessage(e))
    }
  })

  if (items.length === 0)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <ShoppingBag className="size-12 text-ink-muted" />
        <h1 className="font-display text-3xl font-bold">Your bag is empty</h1>
        <Link to="/" className="ak-btn-primary">
          Explore jewellery
        </Link>
      </div>
    )

  const step = phone ? 2 : 1
  const err = formState.errors

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6" data-clarity-mask="True">
      <h1 className="font-display text-3xl font-bold text-primary sm:text-4xl">Secure Checkout</h1>
      <ol className="mt-4 flex items-center gap-3 text-sm">
        {['Mobile', 'Address & Payment'].map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full text-xs font-bold',
                step > i + 1 ? 'bg-emerald-600 text-white' : step === i + 1 ? 'bg-primary text-primary-ink' : 'bg-surface-muted text-ink-muted',
              )}
            >
              {step > i + 1 ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={step === i + 1 ? 'font-semibold' : 'text-ink-muted'}>{label}</span>
            {i === 0 && <span className="h-px w-8 bg-line" />}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {step === 1 ? (
            <MobileVerificationStep />
          ) : (
            <>
              <div className="ak-card flex items-center justify-between gap-3 p-4">
                <p className="flex items-center gap-2 text-sm">
                  <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-white">
                    <Check className="size-3.5" />
                  </span>
                  Verified <strong>{maskPhone(phone!)}</strong>
                </p>
                <button onClick={() => void signOut()} className="text-sm font-medium text-primary hover:underline">
                  Change
                </button>
              </div>

              <form onSubmit={onSubmit} className="space-y-6" noValidate>
                <section className="ak-card space-y-4 p-5 sm:p-7">
                  <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                    <MapPin className="size-5 text-primary" /> Delivery address
                  </h2>
                  <Field label="Full name" error={err.fullName?.message}>
                    <input className="ak-input" autoComplete="name" {...register('fullName')} />
                  </Field>
                  <Field label="House no., street, area" error={err.address_line?.message}>
                    <input className="ak-input" autoComplete="street-address" {...register('address_line')} />
                  </Field>
                  <Field label="Landmark (optional)" error={err.landmark?.message}>
                    <input className="ak-input" placeholder="Near temple, school, etc." {...register('landmark')} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Pincode" error={err.pincode?.message}>
                      <input className="ak-input" inputMode="numeric" maxLength={6} autoComplete="postal-code" {...register('pincode')} />
                    </Field>
                    <Field label="City / Town" error={err.city?.message}>
                      <input className="ak-input" autoComplete="address-level2" {...register('city')} />
                    </Field>
                    <Field label="State" error={err.state?.message}>
                      <select className="ak-input" autoComplete="address-level1" {...register('state')}>
                        <optgroup label="Express 2–3 day delivery">
                          {PRIORITY_STATES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Rest of India (4–7 days)">
                          {OTHER_STATES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </optgroup>
                      </select>
                    </Field>
                  </div>
                </section>

                <OffersAndGifting
                  phone={phone}
                  totals={totals}
                  coupon={coupon}
                  onCoupon={setCoupon}
                  giftCard={giftCard}
                  onGiftCard={setGiftCard}
                  giftWrap={giftWrap}
                  onGiftWrap={setGiftWrap}
                  giftMessage={giftMessage}
                  onGiftMessage={setGiftMessage}
                />

                <section className="ak-card space-y-4 p-5 sm:p-7">
                  <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                    <Lock className="size-5 text-primary" /> Payment
                  </h2>
                  <PaymentModeSelector
                    value={mode}
                    onChange={(m) => setValue('paymentMode', m)}
                    prepaid={prepaidTotals}
                    partial={partialTotals}
                    cod={codTotals}
                  />
                </section>

                {submitError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>}

                <div className="lg:hidden">
                  <OrderSummary items={items} totals={totals} mode={mode} />
                </div>

                <button type="submit" disabled={formState.isSubmitting} className="ak-btn-primary w-full py-4 text-base sm:text-lg">
                  {formState.isSubmitting ? (
                    <>
                      <Loader2 className="size-5 animate-spin" /> Processing…
                    </>
                  ) : totals.payNow === 0 ? (
                    mode === 'COD' ? (
                      `Place Order · Pay ${formatINR(totals.balanceOnDelivery)} on Delivery`
                    ) : (
                      'Place Order'
                    )
                  ) : gateway === 'offline' ? (
                    `Place Order · Pay ${formatINR(totals.payNow)} via UPI`
                  ) : mode === 'PARTIAL_COD' ? (
                    `Pay ${formatINR(totals.payNow)} & Confirm Order`
                  ) : (
                    `Pay ${formatINR(totals.payNow)} & Place Order`
                  )}
                </button>
                <p className="text-center text-xs text-ink-muted">
                  {totals.payNow === 0
                    ? mode === 'COD'
                      ? 'Keep cash or a UPI app ready when the courier arrives.'
                      : 'Your gift card covers this order — nothing more to pay.'
                    : gateway === 'offline'
                      ? 'Next, pay by UPI (GPay, PhonePe, Paytm). We share our UPI details on WhatsApp and confirm your order once payment is received.'
                      : 'One-click confirm · Secured by Razorpay · 100% safe UPI payments'}
                </p>
                <p className="text-center text-xs text-ink-muted">
                  By placing this order you agree to our{' '}
                  <Link to="/policies/terms" className="underline">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link to="/policies/returns" className="underline">
                    Returns policy
                  </Link>
                  .
                </p>
              </form>
            </>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-32">
            <OrderSummary items={items} totals={totals} mode={mode} />
          </div>
        </aside>
      </div>

      <MockPaymentSheet
        amount={mockAmount}
        onResult={(ok) => {
          setMockAmount(null)
          mockResolver.current?.(ok)
          mockResolver.current = null
        }}
      />
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="ak-label">{label}</span>
      {children}
      {error && <span className="ak-error block">{error}</span>}
    </label>
  )
}
