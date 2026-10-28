import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Check, Crown, Plus, ShoppingBag } from 'lucide-react'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { OFFER_RULES } from '@/config/site'
import { useAsync } from '@/hooks/useAsync'
import { cn, formatINR } from '@/lib/format'
import { BRIDAL_MAX_PERCENT, bestOffer, bundlePieces, nextBundleStep, type PricedLine } from '@/lib/pricing'
import { useSeo } from '@/lib/seo'
import { fetchProducts, productThumbnail, productThumbnailSmall } from '@/services/catalog'
import { addLimitMessage, toPricedLines, useCartStore } from '@/stores/useCartStore'
import { useRouteTheme } from '@/theme/ThemeProvider'
import type { Product } from '@/types'

const inStock = (p: Product) => p.in_stock && p.stock_count > 0

export default function BridalSetPage() {
  useRouteTheme('heritage')
  useSeo({
    title: 'Build Your Bridal Jewellery Set — Save up to ' + BRIDAL_MAX_PERCENT + '%',
    description: `Pick your vaddanam, choker, haaram and more in 1 gram gold and American diamond, and save up to ${BRIDAL_MAX_PERCENT}% on the full bridal set. Delivery across Andhra Pradesh & Telangana.`,
    path: '/bridal-set',
  })

  const products = useAsync(() => fetchProducts({ jewelleryTypes: [...OFFER_RULES.bundleTypes] }), [])
  const bag = useCartStore((s) => s.items)
  const add = useCartStore((s) => s.add)
  // productId → chosen size ('' while a size still has to be picked)
  const [picked, setPicked] = useState<Map<string, string>>(new Map())

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; order: number; items: Product[] }>()
    for (const p of (products.data ?? []).filter(inStock)) {
      const name = p.category?.name ?? 'More pieces'
      const g = map.get(name) ?? { name, order: p.category?.display_order ?? 999, items: [] }
      g.items.push(p)
      map.set(name, g)
    }
    return [...map.values()].sort((a, b) => a.order - b.order)
  }, [products.data])

  const inBag = new Set(bag.map((i) => i.productId))
  const chosen = (products.data ?? []).filter((p) => picked.has(p.id))
  const lines: PricedLine[] = [
    ...toPricedLines(bag),
    ...chosen.map((p) => ({ mrp: p.mrp, sale_price: p.sale_price, quantity: 1, product_id: p.id, jewellery_type: p.jewellery_type })),
  ]
  const subtotal = lines.reduce((sum, l) => sum + l.sale_price * l.quantity, 0)
  const pieces = bundlePieces(lines)
  const { offer } = bestOffer(lines, subtotal, null)
  const next = nextBundleStep(pieces)
  const bagPieces = bundlePieces(toPricedLines(bag))
  const missingSize = chosen.some((p) => picked.get(p.id) === '')

  const toggle = (p: Product) =>
    setPicked((current) => {
      const nextMap = new Map(current)
      if (nextMap.has(p.id)) nextMap.delete(p.id)
      else nextMap.set(p.id, p.available_sizes.length === 1 ? p.available_sizes[0] : p.available_sizes.length ? '' : '-')
      return nextMap
    })
  const setSize = (id: string, size: string) => setPicked((current) => new Map(current).set(id, size))

  const addSet = () => {
    if (missingSize) return toast.error('Please choose a size for every piece marked in red')
    const notices: string[] = []
    for (const p of chosen) {
      const size = picked.get(p.id)!
      const added = add({
        productId: p.id,
        slug: p.slug,
        title: p.title,
        teluguTitle: p.telugu_title,
        jewelleryType: p.jewellery_type,
        image: productThumbnail(p),
        mrp: p.mrp,
        salePrice: p.sale_price,
        size: size === '-' ? null : size,
        maxQty: p.stock_count,
      })
      const notice = addLimitMessage(1, added)
      if (notice) notices.push(`${p.title}: ${notice}`)
    }
    if (notices.length) toast.error(notices[0])
    else toast.success(`${chosen.length} ${chosen.length === 1 ? 'piece' : 'pieces'} added to your bag`)
    setPicked(new Map())
  }

  return (
    <div className="pb-40">
      <section className="bg-gradient-to-br from-hero-from to-hero-to text-hero-ink">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.25em] uppercase opacity-80">
            <Crown className="size-4" /> Bridal set builder
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl heritage:text-heritage-gold">Build your bridal set</h1>
          <p lang="te" className="mt-2 text-lg opacity-90">
            మీ పెళ్లి నగల సెట్‌ను మీరే ఎంచుకోండి
          </p>
          <p className="mt-4 max-w-2xl opacity-90">
            Choose your pieces from 1 gram gold, Nakshi temple and American diamond.{' '}
            {OFFER_RULES.bundleSteps.map((s) => `${s.minPieces}+ different pieces save ${Math.round(s.rate * 100)}%`).join(', ')} — applied automatically at
            checkout, plus the extra 5% UPI discount.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {bagPieces > 0 && (
          <p className="mt-6 rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm">
            {bagPieces} {bagPieces === 1 ? 'piece' : 'pieces'} already in your bag {bagPieces === 1 ? 'counts' : 'count'} towards your set.
          </p>
        )}

        {products.loading && !products.data ? (
          <div className="mt-10">
            <ProductGridSkeleton count={8} />
          </div>
        ) : products.error ? (
          <p className="mt-10 rounded-lg bg-red-50 p-4 text-sm text-red-700">Couldn’t load pieces: {products.error.message}</p>
        ) : (
          groups.map((g) => (
            <section key={g.name} className="mt-10">
              <h2 className="mb-4 font-display text-2xl font-semibold text-primary">{g.name}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
                {g.items.map((p) => (
                  <PieceTile
                    key={p.id}
                    product={p}
                    selected={picked.has(p.id)}
                    size={picked.get(p.id)}
                    alreadyInBag={inBag.has(p.id)}
                    onToggle={() => toggle(p)}
                    onSize={(s) => setSize(p.id, s)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">
              {chosen.length} selected · {pieces} {pieces === 1 ? 'piece' : 'pieces'} in your set
            </p>
            <p className="text-xs text-ink-muted">
              {offer ? (
                <span className="font-semibold text-emerald-700">
                  {offer.label}: {formatINR(offer.amount)} off
                </span>
              ) : (
                'No set saving yet'
              )}
              {next && ` · Add ${next.more} more ${next.more === 1 ? 'piece' : 'pieces'} to save ${next.percent}%`}
            </p>
          </div>
          <button type="button" onClick={addSet} disabled={chosen.length === 0} className="ak-btn-primary shrink-0 px-5 py-3 disabled:opacity-50">
            <ShoppingBag className="size-4" /> Add {chosen.length || ''} to bag
          </button>
        </div>
      </div>
    </div>
  )
}

function PieceTile(props: {
  product: Product
  selected: boolean
  size: string | undefined
  alreadyInBag: boolean
  onToggle: () => void
  onSize: (size: string) => void
}) {
  const { product: p, selected, size, alreadyInBag, onToggle, onSize } = props
  const needsSize = selected && size === ''

  return (
    <article className={cn('ak-card flex flex-col overflow-hidden transition', selected && 'ring-2 ring-primary')}>
      <Link to={`/product/${p.slug}`} className="relative block aspect-square bg-surface-muted">
        <img src={productThumbnailSmall(p)} alt={p.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        {alreadyInBag && <span className="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">In your bag</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link to={`/product/${p.slug}`} className="line-clamp-2 min-h-11 text-sm leading-snug font-semibold hover:text-primary">
          {p.title}
        </Link>
        <p className="text-sm font-bold">{formatINR(p.sale_price)}</p>
        {selected && p.available_sizes.length > 1 && (
          <label className="text-xs">
            <span className="sr-only">Size for {p.title}</span>
            <select
              value={size}
              onChange={(e) => onSize(e.target.value)}
              className={cn('mt-1 w-full rounded-md border bg-surface px-2 py-1.5 text-xs', needsSize ? 'border-red-500 text-red-700' : 'border-line')}
            >
              <option value="">Choose size</option>
              {p.available_sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            className={cn('w-full px-3 py-2 text-xs', selected ? 'ak-btn-primary' : 'ak-btn-outline')}
          >
            {selected ? (
              <>
                <Check className="size-4" /> In my set
              </>
            ) : (
              <>
                <Plus className="size-4" /> Add to set
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
