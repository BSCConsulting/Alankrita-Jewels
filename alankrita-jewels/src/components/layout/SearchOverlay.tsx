import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Loader2, Search, X } from 'lucide-react'
import { Overlay } from '@/components/ui/Overlay'
import { formatINR } from '@/lib/format'
import { POPULAR_SEARCHES } from '@/lib/search'
import { productThumbnail, searchProducts } from '@/services/catalog'
import type { Product } from '@/types'

const PREVIEW_COUNT = 6
const DEBOUNCE_MS = 250

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [results, setResults] = useState<Product[] | null>(null)
  const [loading, setLoading] = useState(false)
  const term = input.trim()

  useEffect(() => {
    if (term.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    let stale = false
    const timer = setTimeout(() => {
      searchProducts(term, 24)
        .then((r) => !stale && setResults(r))
        .catch(() => !stale && setResults([]))
        .finally(() => !stale && setLoading(false))
    }, DEBOUNCE_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [term])

  const goToResults = (q: string) => {
    if (!q.trim()) return
    onClose()
    navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <Overlay open={open} onClose={onClose} label="Search" className="mt-2 w-full max-w-xl self-start sm:mt-16">
      <div className="ak-card overflow-hidden bg-bg">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            goToResults(term)
          }}
          className="flex items-center gap-2 border-b border-line px-4"
        >
          {loading ? <Loader2 className="size-5 shrink-0 animate-spin text-ink-muted" /> : <Search className="size-5 shrink-0 text-ink-muted" />}
          <input
            autoFocus
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search vaddanam, jhumkas, chokers…"
            className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none placeholder:text-ink-muted/70"
            aria-label="Search jewellery"
            enterKeyHint="search"
          />
          <button type="button" onClick={onClose} className="-mr-2 rounded-full p-2 text-ink-muted hover:bg-surface-muted" aria-label="Close search">
            <X className="size-5" />
          </button>
        </form>

        <div className="max-h-[65vh] overflow-y-auto">
          {results === null && (
            <div className="p-4">
              <p className="mb-2.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Popular searches</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => goToResults(s)}
                    className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm transition hover:border-accent hover:bg-accent/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results?.length === 0 && !loading && (
            <p className="p-6 text-center text-sm text-ink-muted">
              No designs match “{term}”.{' '}
              <button type="button" onClick={() => goToResults(term)} className="font-semibold text-primary underline underline-offset-4">
                See suggestions
              </button>
            </p>
          )}

          {!!results?.length && (
            <ul className="divide-y divide-line">
              {results.slice(0, PREVIEW_COUNT).map((p) => (
                <li key={p.id}>
                  <Link to={`/product/${p.slug}`} onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-surface-muted">
                    <img src={productThumbnail(p)} alt="" className="size-14 shrink-0 rounded-md bg-surface-muted object-cover" loading="lazy" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      {p.telugu_title && (
                        <p lang="te" className="truncate text-xs text-ink-muted">
                          {p.telugu_title}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatINR(p.sale_price)}</p>
                      {!(p.in_stock && p.stock_count > 0) && <p className="text-[11px] text-red-600">Sold out</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!!results?.length && (
            <button
              type="button"
              onClick={() => goToResults(term)}
              className="flex w-full items-center justify-center gap-2 border-t border-line px-4 py-3.5 text-sm font-semibold text-primary hover:bg-surface-muted"
            >
              See all {results.length} {results.length === 1 ? 'result' : 'results'} <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </Overlay>
  )
}
