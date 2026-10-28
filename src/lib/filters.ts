import { OCCASIONS, STONES, type Occasion, type Product, type Stone } from '../types'

export const OCCASION_LABEL: Record<Occasion, string> = {
  wedding: 'Wedding & bridal',
  festival: 'Festivals & poojas',
  daily: 'Daily wear',
  office: 'Office wear',
  party: 'Party',
}

export const STONE_LABEL: Record<Stone, string> = {
  kempu: 'Kempu (ruby red)',
  emerald: 'Emerald green',
  pearl: 'Pearl',
  cz: 'CZ / American diamond',
  plain: 'Plain gold',
}

/** Price bands on the sale price; each band includes its lower bound and excludes its upper bound. */
export const BUDGETS = [
  { id: 'under-500', label: 'Under ₹500', min: 0, max: 500 },
  { id: '500-1000', label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { id: '1000-2500', label: '₹1,000 – ₹2,500', min: 1000, max: 2500 },
  { id: '2500-5000', label: '₹2,500 – ₹5,000', min: 2500, max: 5000 },
  { id: 'above-5000', label: '₹5,000 & above', min: 5000, max: Infinity },
] as const

export type BudgetId = (typeof BUDGETS)[number]['id']
export type Sort = 'featured' | 'price-asc' | 'price-desc' | 'newest'
export const SORTS: Array<{ id: Sort; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest' },
]

export interface Filters {
  budgets: BudgetId[]
  occasions: Occasion[]
  stones: Stone[]
  inStock: boolean
  sort: Sort
}

export type FacetGroup = 'budgets' | 'occasions' | 'stones'

const BUDGET_IDS = BUDGETS.map((b) => b.id) as readonly string[]
const SORT_IDS = SORTS.map((s) => s.id) as readonly string[]

const pick = <T extends string>(raw: string | null, allowed: readonly string[]): T[] =>
  [...new Set((raw ?? '').split(',').filter((v) => allowed.includes(v)))] as T[]

/** Reads filters from the address bar, ignoring anything unknown so a hand-edited link can't break the page. */
export function parseFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort') ?? ''
  return {
    budgets: pick<BudgetId>(params.get('price'), BUDGET_IDS),
    occasions: pick<Occasion>(params.get('occasion'), OCCASIONS),
    stones: pick<Stone>(params.get('stone'), STONES),
    inStock: params.get('instock') === '1',
    sort: SORT_IDS.includes(sort) ? (sort as Sort) : 'featured',
  }
}

/** Writes filters into the address bar, keeping unrelated parameters such as the search text. */
export function writeFilters(params: URLSearchParams, f: Filters): URLSearchParams {
  const next = new URLSearchParams(params)
  const put = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key))
  put('price', f.budgets.join(','))
  put('occasion', f.occasions.join(','))
  put('stone', f.stones.join(','))
  put('instock', f.inStock ? '1' : '')
  put('sort', f.sort === 'featured' ? '' : f.sort)
  return next
}

/** Removes every filter but keeps the chosen sort order. */
export const clearedFilters = (f: Filters): Filters => ({ ...f, budgets: [], occasions: [], stones: [], inStock: false })

export const activeFilterCount = (f: Filters) => f.budgets.length + f.occasions.length + f.stones.length + (f.inStock ? 1 : 0)

const inBudget = (p: Product, ids: readonly BudgetId[]) =>
  ids.some((id) => {
    const b = BUDGETS.find((x) => x.id === id)!
    return p.sale_price >= b.min && p.sale_price < b.max
  })

/** Options within a group widen the results (OR); different groups narrow them (AND). */
function matches(p: Product, f: Filters, skip?: FacetGroup): boolean {
  if (f.inStock && !(p.in_stock && p.stock_count > 0)) return false
  if (skip !== 'budgets' && f.budgets.length && !inBudget(p, f.budgets)) return false
  if (skip !== 'occasions' && f.occasions.length && !f.occasions.some((o) => p.occasions.includes(o))) return false
  if (skip !== 'stones' && f.stones.length && !f.stones.some((s) => p.stones.includes(s))) return false
  return true
}

export function applyFilters(products: Product[], f: Filters): Product[] {
  const list = products.filter((p) => matches(p, f))
  if (f.sort === 'price-asc') list.sort((a, b) => a.sale_price - b.sale_price)
  if (f.sort === 'price-desc') list.sort((a, b) => b.sale_price - a.sale_price)
  if (f.sort === 'newest') list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return list
}

/**
 * How many designs each option would show, given the choices in the other groups.
 * Options with no designs are hidden so customers never land on an empty page.
 */
export function facetCounts(products: Product[], f: Filters) {
  const count = (group: FacetGroup, has: (p: Product) => boolean) => products.filter((p) => matches(p, f, group) && has(p)).length
  return {
    budgets: BUDGETS.map((b) => ({ id: b.id as BudgetId, label: b.label, count: count('budgets', (p) => inBudget(p, [b.id])) })),
    occasions: OCCASIONS.map((o) => ({ id: o, label: OCCASION_LABEL[o], count: count('occasions', (p) => p.occasions.includes(o)) })),
    stones: STONES.map((s) => ({ id: s, label: STONE_LABEL[s], count: count('stones', (p) => p.stones.includes(s)) })),
  }
}
