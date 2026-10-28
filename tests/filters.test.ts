import { describe, expect, it } from 'vitest'
import { activeFilterCount, applyFilters, facetCounts, parseFilters, writeFilters, type Filters } from '../src/lib/filters'
import type { Product } from '../src/types'

const product = (id: string, overrides: Partial<Product>): Product => ({
  id,
  title: id,
  telugu_title: null,
  slug: id,
  description: null,
  category_id: null,
  mrp: 2000,
  sale_price: 1000,
  jewellery_type: '1-gram-gold',
  plating_type: null,
  warranty_details: null,
  available_sizes: [],
  occasions: [],
  stones: [],
  in_stock: true,
  stock_count: 5,
  featured: false,
  created_at: '2026-01-01T00:00:00Z',
  media: [],
  ...overrides,
})

const products = [
  product('cheap-pearl', { sale_price: 449, occasions: ['daily', 'office'], stones: ['pearl'] }),
  product('kempu-choker', { sale_price: 2799, occasions: ['wedding'], stones: ['kempu', 'emerald'], created_at: '2026-03-01T00:00:00Z' }),
  product('vaddanam', { sale_price: 3899, occasions: ['wedding', 'festival'], stones: ['kempu'], stock_count: 0, in_stock: false }),
  product('chain', { sale_price: 1000, occasions: ['daily'], stones: ['plain'] }),
]

const none: Filters = { budgets: [], occasions: [], stones: [], inStock: false, sort: 'featured' }
const ids = (list: Product[]) => list.map((p) => p.id)

describe('collection filters', () => {
  it('keeps everything when nothing is chosen', () => {
    expect(ids(applyFilters(products, none))).toEqual(['cheap-pearl', 'kempu-choker', 'vaddanam', 'chain'])
  })

  it('price bands include the lower bound and exclude the upper one', () => {
    expect(ids(applyFilters(products, { ...none, budgets: ['500-1000'] }))).toEqual([])
    expect(ids(applyFilters(products, { ...none, budgets: ['1000-2500'] }))).toEqual(['chain'])
    expect(ids(applyFilters(products, { ...none, budgets: ['under-500', '2500-5000'] }))).toEqual(['cheap-pearl', 'kempu-choker', 'vaddanam'])
  })

  it('widens within a group and narrows across groups', () => {
    expect(ids(applyFilters(products, { ...none, occasions: ['wedding', 'office'] }))).toEqual(['cheap-pearl', 'kempu-choker', 'vaddanam'])
    expect(ids(applyFilters(products, { ...none, occasions: ['wedding'], stones: ['emerald'] }))).toEqual(['kempu-choker'])
  })

  it('hides sold-out pieces only when asked', () => {
    expect(ids(applyFilters(products, { ...none, occasions: ['festival'], inStock: true }))).toEqual([])
  })

  it('sorts without changing the original list', () => {
    expect(ids(applyFilters(products, { ...none, sort: 'price-asc' }))).toEqual(['cheap-pearl', 'chain', 'kempu-choker', 'vaddanam'])
    expect(ids(applyFilters(products, { ...none, sort: 'newest' }))[0]).toBe('kempu-choker')
    expect(ids(products)[0]).toBe('cheap-pearl')
  })

  it('counts each option against the choices in the other groups', () => {
    const counts = facetCounts(products, { ...none, occasions: ['wedding'] })
    expect(counts.stones.find((s) => s.id === 'kempu')?.count).toBe(2)
    expect(counts.stones.find((s) => s.id === 'pearl')?.count).toBe(0)
    // Its own group is not narrowed, so customers can add a second occasion.
    expect(counts.occasions.find((o) => o.id === 'daily')?.count).toBe(2)
  })
})

describe('filters in the address bar', () => {
  it('round-trips and keeps the search text', () => {
    const f: Filters = { budgets: ['under-500'], occasions: ['wedding', 'party'], stones: ['cz'], inStock: true, sort: 'price-desc' }
    const params = writeFilters(new URLSearchParams('q=jhumka'), f)
    expect(params.get('q')).toBe('jhumka')
    expect(parseFilters(params)).toEqual(f)
    expect(activeFilterCount(f)).toBe(5)
  })

  it('drops unknown or repeated values from hand-edited links', () => {
    const f = parseFilters(new URLSearchParams('price=free,under-500,under-500&occasion=<script>&stone=kempu&sort=cheapest&instock=yes'))
    expect(f).toEqual({ budgets: ['under-500'], occasions: [], stones: ['kempu'], inStock: false, sort: 'featured' })
  })

  it('leaves a clean address when nothing is chosen', () => {
    expect(writeFilters(new URLSearchParams('price=under-500&sort=newest'), none).toString()).toBe('')
  })
})
