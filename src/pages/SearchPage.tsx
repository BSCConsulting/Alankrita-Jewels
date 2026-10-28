import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { FilterBar, NoMatches, useProductFilters } from '@/components/product/FilterBar'
import { ProductGrid } from '@/components/product/ProductGrid'
import { clearedFilters } from '@/lib/filters'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useAsync } from '@/hooks/useAsync'
import { POPULAR_SEARCHES } from '@/lib/search'
import { useSeo } from '@/lib/seo'
import { whatsappLink } from '@/lib/whatsapp'
import { searchProducts } from '@/services/catalog'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q')?.trim() ?? ''
  const [input, setInput] = useState(query)
  const results = useAsync(() => (query ? searchProducts(query) : Promise.resolve([])), [query])
  const { filters, setFilters, shown } = useProductFilters(results.data)

  useEffect(() => setInput(query), [query])
  useSeo({ title: query ? `“${query}” — Search` : 'Search jewellery', noindex: true })

  const submit = (value: string) => {
    const q = value.trim()
    setParams(q ? { q } : {})
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6">
      <h1 className="sr-only">{query ? `Search results for ${query}` : 'Search jewellery'}</h1>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
        className="relative mx-auto max-w-2xl"
      >
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search vaddanam, jhumkas, chokers…"
          className="ak-input py-3.5 pr-28 pl-12 text-base"
          aria-label="Search jewellery"
          enterKeyHint="search"
        />
        <button type="submit" className="ak-btn-primary absolute top-1/2 right-1.5 -translate-y-1/2 px-4 py-2">
          Search
        </button>
      </form>

      {!query && <PopularSearches onPick={submit} />}

      {query &&
        (!results.loading && !results.error && results.data?.length === 0 ? (
          <div className="mt-8">
            <NoResults query={query} onPick={submit} />
          </div>
        ) : (
          <>
            <div className="mt-2">
              <FilterBar products={results.data} shown={shown} filters={filters} onChange={setFilters} loading={results.loading} />
            </div>
            {shown && shown.length === 0 ? (
              <NoMatches onClear={() => setFilters(clearedFilters(filters))} />
            ) : (
              <ProductGrid products={shown} loading={results.loading} error={results.error} />
            )}
          </>
        ))}
    </div>
  )
}

function PopularSearches({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="mx-auto mt-8 max-w-2xl text-center">
      <p className="mb-3 text-xs font-semibold tracking-wider text-ink-muted uppercase">Popular searches</p>
      <div className="flex flex-wrap justify-center gap-2">
        {POPULAR_SEARCHES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:bg-accent/10"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function NoResults({ query, onPick }: { query: string; onPick: (q: string) => void }) {
  return (
    <div className="ak-card mx-auto max-w-xl p-8 text-center">
      <p className="font-display text-2xl font-semibold">No designs found for “{query}”</p>
      <p className="mt-2 text-sm text-ink-muted">Try a simpler word, browse a collection, or send us a photo — we often have pieces that are not online yet.</p>
      <a
        href={whatsappLink(`Hi Alankrita Jewels, I am looking for "${query}". Do you have something similar?`)}
        target="_blank"
        rel="noopener noreferrer"
        className="ak-btn-whatsapp mt-5"
      >
        <WhatsAppIcon className="size-5" /> Ask us on WhatsApp
      </a>
      <div className="mt-6 border-t border-line pt-5">
        <PopularSearches onPick={onPick} />
        <Link to="/collections/1-gram-gold-jewellery" className="mt-4 inline-block text-sm font-semibold text-primary underline underline-offset-4">
          Browse all 1 Gram Gold
        </Link>
      </div>
    </div>
  )
}
