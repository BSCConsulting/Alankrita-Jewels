import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { SlidersHorizontal, X } from 'lucide-react'
import { Overlay } from '@/components/ui/Overlay'
import {
  activeFilterCount,
  applyFilters,
  BUDGETS,
  clearedFilters,
  facetCounts,
  OCCASION_LABEL,
  parseFilters,
  SORTS,
  STONE_LABEL,
  writeFilters,
  type FacetGroup,
  type Filters,
  type Sort,
} from '@/lib/filters'
import { cn } from '@/lib/format'
import type { Product } from '@/types'

/** Filters live in the address bar so a filtered page can be shared on WhatsApp and survives the back button. */
export function useProductFilters(products: Product[] | undefined) {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const shown = useMemo(() => (products ? applyFilters(products, filters) : undefined), [products, filters])
  const setFilters = (next: Filters) => setParams((current) => writeFilters(current, next), { replace: true, preventScrollReset: true })
  return { filters, setFilters, shown }
}

export function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="ak-card mx-auto max-w-md p-8 text-center">
      <p className="font-display text-xl font-semibold">No designs match these filters</p>
      <p className="mt-2 text-sm text-ink-muted">Try removing a filter, or message us on WhatsApp — we often have pieces that are not online yet.</p>
      <button type="button" onClick={onClear} className="ak-btn-primary mt-5 px-6 py-3">
        Clear filters
      </button>
    </div>
  )
}

interface Props {
  products: Product[] | undefined
  shown: Product[] | undefined
  filters: Filters
  onChange: (next: Filters) => void
  loading?: boolean
}

export function FilterBar({ products, shown, filters, onChange, loading }: Props) {
  const [open, setOpen] = useState(false)
  const counts = useMemo(() => facetCounts(products ?? [], filters), [products, filters])
  const active = activeFilterCount(filters)

  const toggle = (group: FacetGroup, id: string) => {
    const list: string[] = filters[group]
    onChange({ ...filters, [group]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] })
  }
  const clear = () => onChange(clearedFilters(filters))

  const chips = [
    ...filters.budgets.map((id) => ({ key: `b-${id}`, label: BUDGETS.find((b) => b.id === id)!.label, remove: () => toggle('budgets', id) })),
    ...filters.occasions.map((id) => ({ key: `o-${id}`, label: OCCASION_LABEL[id], remove: () => toggle('occasions', id) })),
    ...filters.stones.map((id) => ({ key: `s-${id}`, label: STONE_LABEL[id], remove: () => toggle('stones', id) })),
    ...(filters.inStock ? [{ key: 'stock', label: 'In stock', remove: () => onChange({ ...filters, inStock: false }) }] : []),
  ]

  const groups: Array<{ group: FacetGroup; title: string; options: Array<{ id: string; label: string; count: number }> }> = [
    { group: 'budgets', title: 'Budget', options: counts.budgets },
    { group: 'occasions', title: 'Occasion', options: counts.occasions },
    { group: 'stones', title: 'Stone colour', options: counts.stones },
  ]

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {loading && !shown ? 'Loading designs…' : `${shown?.length ?? 0} ${shown?.length === 1 ? 'design' : 'designs'}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition',
              active ? 'border-primary bg-primary text-primary-ink' : 'border-line hover:border-primary',
            )}
          >
            <SlidersHorizontal className="size-4" /> Filter{active > 0 && ` (${active})`}
          </button>
          <label className="text-sm">
            <span className="sr-only">Sort by</span>
            <select
              value={filters.sort}
              onChange={(e) => onChange({ ...filters, sort: e.target.value as Sort })}
              className="rounded-full border border-line bg-surface px-3 py-2 text-sm"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.remove}
              className="flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium hover:bg-line"
              aria-label={`Remove filter ${c.label}`}
            >
              {c.label} <X className="size-3.5" />
            </button>
          ))}
          <button type="button" onClick={clear} className="px-2 py-1.5 text-xs font-semibold text-primary underline underline-offset-4">
            Clear all
          </button>
        </div>
      )}

      <Overlay open={open} onClose={() => setOpen(false)} label="Filter designs" placement="bottom-sheet">
        <div className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-bg sm:w-[28rem] sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display text-xl font-semibold">Filter designs</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="-mr-2 p-2">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {groups.map(({ group, title, options }) => {
              const selected: string[] = filters[group]
              const visible = options.filter((o) => o.count > 0 || selected.includes(o.id))
              if (visible.length === 0) return null
              return (
                <fieldset key={group}>
                  <legend className="mb-2 text-sm font-semibold">{title}</legend>
                  <div className="flex flex-wrap gap-2">
                    {visible.map((o) => {
                      const on = selected.includes(o.id)
                      return (
                        <button
                          key={o.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(group, o.id)}
                          className={cn(
                            'rounded-full border px-3.5 py-2 text-sm transition',
                            on ? 'border-primary bg-primary text-primary-ink' : 'border-line hover:border-primary',
                          )}
                        >
                          {o.label} <span className={on ? 'opacity-80' : 'text-ink-muted'}>({o.count})</span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )
            })}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.inStock}
                onChange={(e) => onChange({ ...filters, inStock: e.target.checked })}
                className="size-4 accent-[var(--ak-primary)]"
              />
              Only show pieces in stock
            </label>
          </div>
          <div className="flex gap-2 border-t border-line p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button type="button" onClick={clear} disabled={active === 0} className="ak-btn-outline flex-1 py-3 disabled:opacity-50">
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)} className="ak-btn-primary flex-[2] py-3">
              Show {shown?.length ?? 0} {shown?.length === 1 ? 'design' : 'designs'}
            </button>
          </div>
        </div>
      </Overlay>
    </div>
  )
}
