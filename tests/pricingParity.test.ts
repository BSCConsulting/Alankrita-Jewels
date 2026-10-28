import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OFFER_RULES, PAYMENT_RULES } from '../src/config/site'
import { OCCASIONS, STONES } from '../src/types'

const sql = readFileSync(new URL('../supabase/migrations/005_growth_features.sql', import.meta.url), 'utf8')

function constant(name: string): string {
  const m = sql.match(new RegExp(`${name}\\s+constant\\s+[\\w\\[\\]]+\\s*:=\\s*([^;]+);`))
  if (!m) throw new Error(`${name} not found in migration 005`)
  return m[1].trim()
}
const num = (name: string) => Number(constant(name))
const numArray = (name: string) => constant(name).replace(/^array\[|\]$/g, '').split(',').map((s) => Number(s.trim()))
const textArray = (name: string) => constant(name).replace(/^array\[|\]$/g, '').split(',').map((s) => s.trim().replace(/'/g, ''))
const checkList = (constraint: string) => {
  const m = sql.match(new RegExp(`${constraint}\\s+check \\(\\w+ <@ array\\[([^\\]]+)\\]`))
  if (!m) throw new Error(`${constraint} not found`)
  return m[1].split(',').map((s) => s.trim().replace(/'/g, ''))
}

describe('place_order() and src/config/site.ts agree', () => {
  it('payment rules', () => {
    expect(num('c_prepaid_discount_rate')).toBe(PAYMENT_RULES.prepaidDiscountRate)
    expect(num('c_partial_cod_advance')).toBe(PAYMENT_RULES.partialCodAdvance)
    expect(num('c_cod_fee')).toBe(PAYMENT_RULES.codFee)
    expect(num('c_cod_max_amount')).toBe(PAYMENT_RULES.codMaxAmount)
    expect(num('c_max_open_cod_orders')).toBe(PAYMENT_RULES.maxOpenCodOrders)
  })

  it('offer rules', () => {
    expect(numArray('c_tier_mins')).toEqual(OFFER_RULES.tiers.map((t) => t.minSubtotal))
    expect(numArray('c_tier_discounts')).toEqual(OFFER_RULES.tiers.map((t) => t.discount))
    expect(textArray('c_bundle_types')).toEqual([...OFFER_RULES.bundleTypes])
    expect(numArray('c_bundle_min_pieces')).toEqual(OFFER_RULES.bundleSteps.map((s) => s.minPieces))
    expect(numArray('c_bundle_rates')).toEqual(OFFER_RULES.bundleSteps.map((s) => s.rate))
    expect(num('c_free_gift_min')).toBe(OFFER_RULES.freeGiftMinSubtotal)
    expect(constant('c_free_gift')).toBe(`'${OFFER_RULES.freeGift}'`)
    expect(num('c_gift_wrap_fee')).toBe(OFFER_RULES.giftWrapFee)
    expect(num('c_gift_message_max')).toBe(OFFER_RULES.giftMessageMaxLength)
  })

  it('product tag vocabularies', () => {
    expect(checkList('products_occasions_valid')).toEqual(OCCASIONS)
    expect(checkList('products_stones_valid')).toEqual(STONES)
  })
})
