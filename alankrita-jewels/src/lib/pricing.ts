import { PAYMENT_RULES } from '../config/site'
import type { PaymentMode } from '../types'

export interface PricedLine {
  mrp: number
  sale_price: number
  quantity: number
}

export interface OrderTotals {
  totalMrp: number
  subtotal: number
  productSavings: number
  prepaidDiscount: number
  finalAmount: number
  discountAmount: number
  payNow: number
  balanceOnDelivery: number
}

/**
 * Client-side mirror of the pricing in `public.place_order()` (supabase/migrations/001).
 * The database result is authoritative; this only drives the live checkout UI and mock mode.
 */
export function computeTotals(lines: PricedLine[], mode: PaymentMode | null): OrderTotals {
  const totalMrp = lines.reduce((sum, l) => sum + l.mrp * l.quantity, 0)
  const subtotal = lines.reduce((sum, l) => sum + l.sale_price * l.quantity, 0)
  const prepaidDiscount = mode === 'PREPAID_UPI' ? Math.round(subtotal * PAYMENT_RULES.prepaidDiscountRate) : 0
  const finalAmount = subtotal - prepaidDiscount
  const isPartial = mode === 'PARTIAL_COD'

  return {
    totalMrp,
    subtotal,
    productSavings: totalMrp - subtotal,
    prepaidDiscount,
    finalAmount,
    discountAmount: totalMrp - finalAmount,
    payNow: isPartial ? PAYMENT_RULES.partialCodAdvance : finalAmount,
    balanceOnDelivery: isPartial ? finalAmount - PAYMENT_RULES.partialCodAdvance : 0,
  }
}

export const discountPercent = (mrp: number, sale: number) => (mrp > sale ? Math.round(((mrp - sale) / mrp) * 100) : 0)
