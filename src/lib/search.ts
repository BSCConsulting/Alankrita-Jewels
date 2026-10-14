// Pure search helpers shared by the Supabase query builder, the mock database and unit tests.
import { JEWELLERY_TYPE_LABEL } from '@/config/collections'
import type { Category, JewelleryType, Product } from '@/types'

/** Words shoppers type mapped to the vocabulary used in product titles and categories. */
const SYNONYMS: Record<string, string[]> = {
  necklace: ['necklace', 'haram', 'choker', 'mala'],
  haram: ['haram', 'necklace'],
  earring: ['earring', 'jhumka', 'jhumki', 'stud', 'chandbali'],
  jhumka: ['jhumka', 'jhumki', 'earring'],
  jhumki: ['jhumki', 'jhumka', 'earring'],
  bangle: ['bangle', 'kada', 'bracelet'],
  bracelet: ['bracelet', 'bangle', 'kada'],
  mangalsutra: ['mangalsutra', 'nallapusalu', 'black bead'],
  'black bead': ['black bead', 'nallapusalu', 'mangalsutra'],
  waist: ['vaddanam', 'hip belt', 'waist'],
  'hip belt': ['hip belt', 'vaddanam'],
  vadanam: ['vaddanam'],
  temple: ['temple', 'nakshi', 'lakshmi'],
  waterproof: ['waterproof', 'anti-tarnish', 'pvd', 'stainless'],
  steel: ['steel', 'stainless', 'pvd', 'anti-tarnish'],
  diamond: ['diamond', 'cz', 'american diamond', 'zircon'],
  ad: ['american diamond', 'cz'],
  ring: ['ring'],
}

const normalizeWord = (w: string) => {
  const lower = w.toLowerCase()
  return lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss') ? lower.slice(0, -1) : lower
}

/**
 * Splits a query into AND-ed groups of OR-ed alternatives:
 * "gold earrings" → [["gold"], ["earring", "jhumka", …]]. Strips characters that break PostgREST filters.
 */
export function searchGroups(query: string): string[][] {
  const clean = query.replace(/[,()%*\\:"'.]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!clean) return []
  const phrase = Object.keys(SYNONYMS).find((k) => k.includes(' ') && clean.includes(k))
  const rest = phrase ? clean.replace(phrase, ' ').trim() : clean
  const words = rest.split(' ').filter((w) => w.length >= 2).map(normalizeWord)
  const groups = words.map((w) => SYNONYMS[w] ?? [w])
  if (phrase) groups.unshift(SYNONYMS[phrase])
  return groups.slice(0, 5)
}

/** Category ids and jewellery types whose names match one alternative group. */
export function groupTaxonomyMatches(group: string[], categories: Category[]) {
  const hit = (text: string | null | undefined) => !!text && group.some((alt) => text.toLowerCase().includes(alt))
  return {
    categoryIds: categories.filter((c) => hit(c.name) || hit(c.telugu_name) || hit(c.slug.replace(/-/g, ' '))).map((c) => c.id),
    types: (Object.keys(JEWELLERY_TYPE_LABEL) as JewelleryType[]).filter((t) => hit(JEWELLERY_TYPE_LABEL[t]) || hit(t.replace(/-/g, ' '))),
  }
}

type Searchable = Pick<Product, 'title' | 'telugu_title' | 'description' | 'plating_type' | 'category_id' | 'jewellery_type'>

export function productMatches(p: Searchable, groups: string[][], categories: Category[]): boolean {
  const haystack = [p.title, p.telugu_title, p.description, p.plating_type].filter(Boolean).join(' ').toLowerCase()
  return groups.every((group) => {
    if (group.some((alt) => haystack.includes(alt))) return true
    const { categoryIds, types } = groupTaxonomyMatches(group, categories)
    return (!!p.category_id && categoryIds.includes(p.category_id)) || types.includes(p.jewellery_type)
  })
}

/** Title hits first, then in-stock, then featured. */
export function rankResults<T extends Searchable & Pick<Product, 'in_stock' | 'stock_count' | 'featured'>>(products: T[], groups: string[][]): T[] {
  const score = (p: T) => {
    const title = `${p.title} ${p.telugu_title ?? ''}`.toLowerCase()
    const titleHits = groups.filter((g) => g.some((alt) => title.includes(alt))).length
    return titleHits * 4 + (p.in_stock && p.stock_count > 0 ? 2 : 0) + (p.featured ? 1 : 0)
  }
  return [...products].sort((a, b) => score(b) - score(a))
}

export const POPULAR_SEARCHES = ['Vaddanam', 'Jhumka', 'Choker', 'Nallapusalu', 'Bangles', 'Waterproof', 'Temple necklace', 'American diamond']
