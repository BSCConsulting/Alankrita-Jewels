import { describe, expect, it } from 'vitest'
import { amountDueNow, isPayable } from '../functions/_lib/supabase'
import { PAYMENT_RULES } from '../src/config/site'
import { computeTotals, discountPercent } from '../src/lib/pricing'

const lines = [
  { mrp: 2000, sale_price: 1499, quantity: 2 },
  { mrp: 999, sale_price: 599, quantity: 1 },
]

describe('computeTotals', () => {
  it('applies the prepaid UPI discount to the sale subtotal', () => {
    const t = computeTotals(lines, 'PREPAID_UPI')
    expect(t.subtotal).toBe(3597)
    expect(t.prepaidDiscount).toBe(Math.round(3597 * PAYMENT_RULES.prepaidDiscountRate))
    expect(t.finalAmount).toBe(3597 - t.prepaidDiscount)
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

  it('handles an empty bag', () => {
    expect(computeTotals([], 'PREPAID_UPI').finalAmount).toBe(0)
  })
})

describe('discountPercent', () => {
  it('rounds and never goes negative', () => {
    expect(discountPercent(1000, 650)).toBe(35)
    expect(discountPercent(500, 600)).toBe(0)
  })
})

describe('server payment helpers', () => {
  it('amountDueNow charges the advance for partial COD and the full amount otherwise', () => {
    expect(amountDueNow({ payment_mode: 'PARTIAL_COD', final_amount: 2500, balance_due_on_delivery: 2350 })).toBe(150)
    expect(amountDueNow({ payment_mode: 'PREPAID_UPI', final_amount: 2375, balance_due_on_delivery: 0 })).toBe(2375)
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
