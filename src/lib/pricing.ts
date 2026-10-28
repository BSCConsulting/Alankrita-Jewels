import { OFFER_RULES, PAYMENT_RULES } from '../config/site'
import type { JewelleryType, PaymentMode } from '../types'

export interface PricedLine {
  mrp: number
  sale_price: number
  quantity: number
  /** Needed for the bridal set saving; lines without it simply don't count towards a set. */
  product_id?: string
  jewellery_type?: JewelleryType
}

export interface CouponRule {
  code: string
  kind: 'percent' | 'flat'
  value: number
  min_subtotal: number
  max_discount: number | null
  description?: string | null
}

export type OfferKind = 'tier' | 'bundle' | 'coupon'

export interface AppliedOffer {
  kind: OfferKind
  label: string
  amount: number
}

export interface PricingOptions {
  coupon?: CouponRule | null
  giftWrap?: boolean
  /** Remaining balance of a validated gift card. */
  giftCardBalance?: number
}

export interface OrderTotals {
  totalMrp: number
  subtotal: number
  productSavings: number
  /** The single best automatic offer or coupon; offers never stack with each other. */
  offer: AppliedOffer | null
  /** Why an entered coupon is not being used, if it isn't. */
  couponNote: string | null
  prepaidDiscount: number
  codFee: number
  giftWrapFee: number
  /** Before the gift card. */
  orderTotal: number
  giftCardAmount: number
  /** What the customer pays in total (online now + on delivery). */
  finalAmount: number
  /** All price reductions from MRP: product discount, offer and the UPI discount. */
  discountAmount: number
  payNow: number
  balanceOnDelivery: number
  freeGift: string | null
}

const BUNDLE_TYPES: readonly string[] = OFFER_RULES.bundleTypes

export function tierDiscount(subtotal: number): number {
  let best = 0
  for (const t of OFFER_RULES.tiers) if (subtotal >= t.minSubtotal) best = Math.max(best, t.discount)
  return best
}

/** Distinct traditional pieces in the bag; quantity of one design does not make a set. */
export function bundlePieces(lines: PricedLine[]): number {
  return new Set(lines.filter((l) => l.product_id && l.jewellery_type && BUNDLE_TYPES.includes(l.jewellery_type)).map((l) => l.product_id)).size
}

export function bundleRate(pieces: number): number {
  let rate = 0
  for (const s of OFFER_RULES.bundleSteps) if (pieces >= s.minPieces) rate = Math.max(rate, s.rate)
  return rate
}

/** Largest bridal set saving, as a whole percentage (for banners). */
export const BRIDAL_MAX_PERCENT = Math.round(Math.max(...OFFER_RULES.bundleSteps.map((s) => s.rate)) * 100)

/** The next bridal set step this many pieces haven't reached yet, or null once the top step is reached. */
export function nextBundleStep(pieces: number): { more: number; percent: number } | null {
  const next = OFFER_RULES.bundleSteps.find((s) => s.minPieces > pieces)
  return next ? { more: next.minPieces - pieces, percent: Math.round(next.rate * 100) } : null
}

export function couponDiscount(coupon: CouponRule, subtotal: number): number {
  if (subtotal < coupon.min_subtotal) return 0
  const raw = coupon.kind === 'percent' ? Math.round((subtotal * coupon.value) / 100) : coupon.value
  const capped = coupon.max_discount != null ? Math.min(raw, coupon.max_discount) : raw
  return Math.max(0, Math.min(capped, subtotal))
}

/** Picks the largest saving. On a tie the coupon is not consumed, so it stays usable for a later order. */
export function bestOffer(lines: PricedLine[], subtotal: number, coupon: CouponRule | null): { offer: AppliedOffer | null; couponNote: string | null } {
  const candidates: AppliedOffer[] = []
  const tier = tierDiscount(subtotal)
  if (tier > 0) candidates.push({ kind: 'tier', label: `Cart value saving`, amount: tier })
  const pieces = bundlePieces(lines)
  const rate = bundleRate(pieces)
  if (rate > 0) candidates.push({ kind: 'bundle', label: `Bridal set saving (${Math.round(rate * 100)}% on ${pieces} pieces)`, amount: Math.round(subtotal * rate) })

  let couponNote: string | null = null
  if (coupon) {
    const amount = couponDiscount(coupon, subtotal)
    if (amount === 0) couponNote = `${coupon.code} needs a bag value of ₹${coupon.min_subtotal.toLocaleString('en-IN')} or more`
    else candidates.push({ kind: 'coupon', label: `Coupon ${coupon.code}`, amount })
  }

  let offer: AppliedOffer | null = null
  for (const c of candidates) if (!offer || c.amount > offer.amount) offer = c
  if (coupon && !couponNote && offer?.kind !== 'coupon') couponNote = `A bigger saving is already applied, so ${coupon.code} is kept for later`
  return { offer, couponNote }
}

/**
 * Client-side mirror of the pricing in public.place_order() (supabase/migrations/005_growth_features.sql).
 * The database result is authoritative; this drives the live checkout UI and mock mode.
 */
export function computeTotals(lines: PricedLine[], mode: PaymentMode | null, options: PricingOptions = {}): OrderTotals {
  const totalMrp = lines.reduce((sum, l) => sum + l.mrp * l.quantity, 0)
  const subtotal = lines.reduce((sum, l) => sum + l.sale_price * l.quantity, 0)
  const { offer, couponNote } = bestOffer(lines, subtotal, options.coupon ?? null)
  const afterOffer = subtotal - (offer?.amount ?? 0)
  const prepaidDiscount = mode === 'PREPAID_UPI' ? Math.round(afterOffer * PAYMENT_RULES.prepaidDiscountRate) : 0
  const codFee = mode === 'COD' && subtotal > 0 ? PAYMENT_RULES.codFee : 0
  const giftWrapFee = options.giftWrap && subtotal > 0 ? OFFER_RULES.giftWrapFee : 0
  const orderTotal = afterOffer - prepaidDiscount + codFee + giftWrapFee
  const giftCardAmount = Math.min(Math.max(0, options.giftCardBalance ?? 0), orderTotal)
  const finalAmount = orderTotal - giftCardAmount

  let payNow = finalAmount
  let balanceOnDelivery = 0
  if (mode === 'PARTIAL_COD' && finalAmount > PAYMENT_RULES.partialCodAdvance) {
    payNow = PAYMENT_RULES.partialCodAdvance
    balanceOnDelivery = finalAmount - payNow
  } else if (mode === 'COD') {
    payNow = 0
    balanceOnDelivery = finalAmount
  }

  return {
    totalMrp,
    subtotal,
    productSavings: totalMrp - subtotal,
    offer,
    couponNote,
    prepaidDiscount,
    codFee,
    giftWrapFee,
    orderTotal,
    giftCardAmount,
    finalAmount,
    discountAmount: totalMrp - subtotal + (offer?.amount ?? 0) + prepaidDiscount,
    payNow,
    balanceOnDelivery,
    freeGift: subtotal >= OFFER_RULES.freeGiftMinSubtotal ? OFFER_RULES.freeGift : null,
  }
}

/** Why a payment mode can't be used for these totals, or null when it can. Mirrors the checks in place_order(). */
export function paymentModeBlocker(mode: PaymentMode, totals: OrderTotals): string | null {
  if (mode === 'PARTIAL_COD' && totals.finalAmount <= PAYMENT_RULES.partialCodAdvance)
    return `Available on orders above ₹${PAYMENT_RULES.partialCodAdvance}`
  if (mode === 'COD') {
    if (totals.finalAmount <= 0) return 'Nothing to collect on delivery'
    if (totals.finalAmount > PAYMENT_RULES.codMaxAmount)
      return `Available up to ₹${PAYMENT_RULES.codMaxAmount.toLocaleString('en-IN')} — please pay online or choose Partial COD`
  }
  return null
}

/**
 * The next automatic reward the shopper can unlock by adding to the bag, for the progress nudge.
 * Offers don't stack, so a tier no bigger than the offer already applied is not a reward.
 */
export function nextReward(subtotal: number, currentOffer = 0): { remaining: number; reward: string } | null {
  const options: Array<{ at: number; reward: string }> = OFFER_RULES.tiers
    .filter((t) => t.discount > currentOffer)
    .map((t) => ({ at: t.minSubtotal, reward: `₹${t.discount} off` }))
  options.push({ at: OFFER_RULES.freeGiftMinSubtotal, reward: `a free ${OFFER_RULES.freeGift.toLowerCase()}` })
  const next = options.filter((o) => o.at > subtotal).sort((a, b) => a.at - b.at)[0]
  return next ? { remaining: next.at - subtotal, reward: next.reward } : null
}

export const discountPercent = (mrp: number, sale: number) => (mrp > sale ? Math.round(((mrp - sale) / mrp) * 100) : 0)
