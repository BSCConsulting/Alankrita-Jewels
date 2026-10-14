import { describe, expect, it } from 'vitest'
import { groupTaxonomyMatches, productMatches, rankResults, searchGroups } from '../src/lib/search'
import type { Category, Product } from '../src/types'

const category = (id: string, name: string, slug: string): Category => ({
  id,
  name,
  slug,
  telugu_name: null,
  parent_id: null,
  description: null,
  theme_default: 'heritage',
  display_order: 0,
})

const categories = [
  category('c-vaddanam', 'Vaddanam & Hip Belts', 'vaddanam-hip-belts'),
  category('c-choker', 'Choker Sets', 'choker-sets'),
]

const product = (overrides: Partial<Product>): Product => ({
  id: 'p',
  title: 'Product',
  telugu_title: null,
  slug: 'product',
  description: null,
  category_id: null,
  mrp: 1000,
  sale_price: 800,
  jewellery_type: '1-gram-gold',
  plating_type: null,
  warranty_details: null,
  available_sizes: [],
  in_stock: true,
  stock_count: 5,
  featured: false,
  created_at: '2026-01-01T00:00:00Z',
  media: [],
  ...overrides,
})

describe('searchGroups', () => {
  it('returns no groups for blank or punctuation-only input', () => {
    expect(searchGroups('')).toEqual([])
    expect(searchGroups('  ,().*  ')).toEqual([])
  })

  it('normalises plurals and expands synonyms', () => {
    expect(searchGroups('Earrings')).toEqual([['earring', 'jhumka', 'jhumki', 'stud', 'chandbali']])
    expect(searchGroups('bangles')[0]).toContain('kada')
  })

  it('keeps multi-word phrases together', () => {
    const groups = searchGroups('gold black bead')
    expect(groups[0]).toEqual(['black bead', 'nallapusalu', 'mangalsutra'])
    expect(groups[1]).toEqual(['gold'])
  })

  it('strips characters that would break a PostgREST filter', () => {
    expect(searchGroups('haram),title.eq.x')).toEqual([['haram', 'necklace'], ['title'], ['eq']])
    for (const alt of searchGroups('a,b(c)d%e*f:g"h').flat()) expect(alt).not.toMatch(/[,()%*:"]/)
  })

  it('does not strip a trailing s from short words or double-s words', () => {
    expect(searchGroups('cuts')).toEqual([['cut']])
    expect(searchGroups('glass')).toEqual([['glass']])
    expect(searchGroups('ads')).toEqual([['ads']])
  })

  it('caps the number of groups', () => {
    expect(searchGroups('one two three four five six seven')).toHaveLength(5)
  })
})

describe('productMatches', () => {
  it('requires every group to match (AND across words)', () => {
    const p = product({ title: 'Lakshmi Temple Haram', plating_type: 'Micro Gold' })
    expect(productMatches(p, searchGroups('temple necklace'), categories)).toBe(true)
    expect(productMatches(p, searchGroups('temple earring'), categories)).toBe(false)
  })

  it('matches through the category name when the title does not', () => {
    const p = product({ title: 'Peacock Kamarbandh', category_id: 'c-vaddanam' })
    expect(productMatches(p, searchGroups('hip belt'), categories)).toBe(true)
  })

  it('matches through the jewellery type label', () => {
    const p = product({ title: 'Twisted Hoops', jewellery_type: 'anti-tarnish' })
    expect(productMatches(p, searchGroups('anti tarnish'), categories)).toBe(true)
  })
})

describe('groupTaxonomyMatches', () => {
  it('finds categories by slug words', () => {
    expect(groupTaxonomyMatches(['choker'], categories).categoryIds).toEqual(['c-choker'])
  })
})

describe('rankResults', () => {
  it('puts title hits first, then in-stock, then featured', () => {
    const groups = searchGroups('jhumka')
    const ranked = rankResults(
      [
        product({ id: 'desc-only', title: 'Kemp stone set', description: 'jhumka style', featured: true }),
        product({ id: 'title-oos', title: 'Ruby Jhumka', in_stock: false, stock_count: 0 }),
        product({ id: 'title-in', title: 'Temple Jhumka' }),
      ],
      groups,
    )
    expect(ranked.map((p) => p.id)).toEqual(['title-in', 'title-oos', 'desc-only'])
  })
})
