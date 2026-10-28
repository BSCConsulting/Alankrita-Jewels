import { describe, expect, it } from 'vitest'
import { amountDueNow, isPayable } from '../functions/_lib/supabase'
import { OFFER_RULES, PAYMENT_RULES } from '../src/config/site'
import { bestOffer, bundlePieces, computeTotals, couponDiscount, discountPercent, nextReward, paymentModeBlocker, tierDiscount, type CouponRule, type PricedLine } from '../src/lib/pricing'

const lines: PricedLine[] = [
  { mrp: 2000, sale_price: 1499, quantity: 2 },
  { mrp: 999, sale_price: 599, quantity: 1 },
]
const welcome: CouponRule = { code: 'WELCOME10', kind: 'percent', value: 10, min_subtotal: 999, max_discount: 300 }
const piece = (id: string, sale: number, type: PricedLine['jewellery_type'] = '1-gram-gold'): PricedLine => ({
  product_id: id,
  jewellery_type: type,
  mrp: sale * 2,
  sale_price: sale,
  quantity: 1,
})

describe('computeTotals', () => {
  it('applies the best offer before the UPI discount', () => {
    const t = computeTotals(lines, 'PREPAID_UPI')
    expect(t.subtotal).toBe(3597)
    expect(t.offer).toEqual({ kind: 'tier', label: 'Cart value saving', amount: 150 })
    expect(t.prepaidDiscount).toBe(Math.round((3597 - 150) * PAYMENT_RULES.prepaidDiscountRate))
    expect(t.finalAmount).toBe(3597 - 150 - t.prepaidDiscount)
    expect(t.payNow).toBe(t.finalAmount)
    expect(t.balanceOnDelivery).toBe(0)
    expect(t.discountAmount).toBe(t.totalMrp - t.finalAmount)
  })

  it('takes only the fixed advance for partial COD', () => {
    const t = computeTotals(lines, 'PARTIAL_COD')
    expect(t.prepaidDiscount).toBe(0)
    expect(t.payNow).toBe(PAYMENT_RULES.partialCodAdvance)
    expect(t.payNow + t.balanceOnDelivery).toBe(t.finalAmount)
  })

  it('adds the COD fee and collects everything on delivery', () => {
    const t = computeTotals(lines, 'COD')
    expect(t.codFee).toBe(PAYMENT_RULES.codFee)
    expect(t.prepaidDiscount).toBe(0)
    expect(t.finalAmount).toBe(3597 - 150 + PAYMENT_RULES.codFee)
    expect(t.payNow).toBe(0)
    expect(t.balanceOnDelivery).toBe(t.finalAmount)
  })

  it('adds gift wrap and takes the gift card last, never below zero', () => {
    const t = computeTotals(lines, 'PREPAID_UPI', { giftWrap: true, giftCardBalance: 500 })
    expect(t.giftWrapFee).toBe(OFFER_RULES.giftWrapFee)
    expect(t.giftCardAmount).toBe(500)
    expect(t.finalAmount).toBe(t.orderTotal - 500)

    const covered = computeTotals(lines, 'PREPAID_UPI', { giftCardBalance: 100_000 })
    expect(covered.giftCardAmount).toBe(covered.orderTotal)
    expect(covered.finalAmount).toBe(0)
    expect(covered.payNow).toBe(0)
  })

  it('adds the free gift from the threshold', () => {
    expect(computeTotals([piece('a', OFFER_RULES.freeGiftMinSubtotal - 1)], null).freeGift).toBeNull()
    expect(computeTotals([piece('a', OFFER_RULES.freeGiftMinSubtotal)], null).freeGift).toBe(OFFER_RULES.freeGift)
  })

  it('handles an empty bag without fees', () => {
    const t = computeTotals([], 'COD', { giftWrap: true })
    expect(t.finalAmount).toBe(0)
    expect(t.codFee).toBe(0)
    expect(t.giftWrapFee).toBe(0)
  })
})

describe('offers', () => {
  it('uses the highest tier reached', () => {
    expect(tierDiscount(2498)).toBe(0)
    expect(tierDiscount(2499)).toBe(150)
    expect(tierDiscount(5000)).toBe(350)
    expect(tierDiscount(20_000)).toBe(800)
  })

  it('counts distinct traditional pieces for the bridal set', () => {
    expect(bundlePieces([piece('a', 1000), { ...piece('a', 1000), quantity: 3 }, piece('b', 500, 'korean')])).toBe(1)
    expect(bundlePieces([piece('a', 1000), piece('b', 1000, 'nakshi-temple'), piece('c', 1000, 'american-diamond')])).toBe(3)
  })

  it('prefers the bridal set over the tier when it saves more', () => {
    const set = [piece('a', 1500), piece('b', 1500), piece('c', 1500)]
    const { offer } = bestOffer(set, 4500, null)
    expect(offer).toEqual({ kind: 'bundle', label: 'Bridal set saving (7% on 3 pieces)', amount: 315 })
  })

  it('caps percentage coupons and enforces the minimum', () => {
    expect(couponDiscount(welcome, 998)).toBe(0)
    expect(couponDiscount(welcome, 1500)).toBe(150)
    expect(couponDiscount(welcome, 10_000)).toBe(300)
    expect(couponDiscount({ ...welcome, kind: 'flat', value: 5000, max_discount: null }, 1200)).toBe(1200)
  })

  it('keeps a coupon for later when an automatic offer is bigger', () => {
    const { offer, couponNote } = bestOffer([], 12_000, welcome)
    expect(offer?.kind).toBe('tier')
    expect(couponNote).toMatch(/kept for later/)
  })

  it('applies the coupon when it is the best saving', () => {
    const { offer, couponNote } = bestOffer([], 2000, welcome)
    expect(offer).toEqual({ kind: 'coupon', label: 'Coupon WELCOME10', amount: 200 })
    expect(couponNote).toBeNull()
  })

  it('explains a coupon below its minimum', () => {
    expect(bestOffer([], 500, welcome).couponNote).toMatch(/₹999/)
  })

  it('suggests the nearest reward', () => {
    expect(nextReward(2000)).toEqual({ remaining: 499, reward: '₹150 off' })
    expect(nextReward(3000)).toEqual({ remaining: 999, reward: `a free ${OFFER_RULES.freeGift.toLowerCase()}` })
    expect(nextReward(50_000)).toBeNull()
  })
})

describe('paymentModeBlocker', () => {
  it('limits COD to the cap and partial COD to orders above the advance', () => {
    expect(paymentModeBlocker('COD', computeTotals([piece('a', 1000)], 'COD'))).toBeNull()
    expect(paymentModeBlocker('COD', computeTotals([piece('a', 9000)], 'COD'))).toMatch(/up to/)
    expect(paymentModeBlocker('PARTIAL_COD', computeTotals([piece('a', 100)], 'PARTIAL_COD'))).toMatch(/above/)
    expect(paymentModeBlocker('PREPAID_UPI', computeTotals([piece('a', 100)], 'PREPAID_UPI'))).toBeNull()
  })
})

describe('discountPercent', () => {
  it('rounds and never goes negative', () => {
    expect(discountPercent(1000, 650)).toBe(35)
    expect(discountPercent(500, 600)).toBe(0)
  })
})

describe('server payment helpers', () => {
  it('amountDueNow charges the advance for partial COD, nothing for COD and the full amount otherwise', () => {
    expect(amountDueNow({ payment_mode: 'PARTIAL_COD', final_amount: 2500, balance_due_on_delivery: 2350 })).toBe(150)
    expect(amountDueNow({ payment_mode: 'PREPAID_UPI', final_amount: 2375, balance_due_on_delivery: 0 })).toBe(2375)
    expect(amountDueNow({ payment_mode: 'COD', final_amount: 2549, balance_due_on_delivery: 2549 })).toBe(0)
  })

  it('amountDueNow copes with numeric strings from PostgREST', () => {
    expect(amountDueNow({ payment_mode: 'PARTIAL_COD', final_amount: '2500.00', balance_due_on_delivery: '2350.00' } as never)).toBe(150)
  })

  it('isPayable only accepts unpaid orders that are not cancelled or shipped', () => {
    expect(isPayable({ payment_status: 'PENDING', order_status: 'PLACED' })).toBe(true)
    expect(isPayable({ payment_status: 'PENDING', order_status: 'CONFIRMED' })).toBe(true)
    expect(isPayable({ payment_status: 'PENDING', order_status: 'CANCELLED' })).toBe(false)
    expect(isPayable({ payment_status: 'PENDING', order_status: 'DISPATCHED' })).toBe(false)
    expect(isPayable({ payment_status: 'PAID', order_status: 'PLACED' })).toBe(false)
  })
})
