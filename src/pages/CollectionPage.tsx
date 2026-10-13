import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronRight, SlidersHorizontal } from 'lucide-react'
import { ProductGrid } from '@/components/product/ProductGrid'
import { JsonLd } from '@/components/seo/JsonLd'
import { categoryPath, COLLECTION_CONTENT } from '@/config/collections'
import { useAsync } from '@/hooks/useAsync'
import { breadcrumbJsonLd } from '@/lib/jsonld'
import { cn } from '@/lib/format'
import { SITE_URL, useSeo } from '@/lib/seo'
import { fetchCategories, fetchProducts } from '@/services/catalog'
import { useRouteTheme } from '@/theme/ThemeProvider'
import NotFoundPage from './NotFoundPage'

type Sort = 'featured' | 'price-asc' | 'price-desc' | 'newest'

export default function CollectionPage() {
  const { slug = '' } = useParams()
  const [sort, setSort] = useState<Sort>('featured')
  const [inStockOnly, setInStockOnly] = useState(false)

  const categories = useAsync(() => fetchCategories(), [])
  const products = useAsync(() => fetchProducts({ categorySlug: slug }), [slug])

  const category = categories.data?.find((c) => c.slug === slug)
  const parent = category?.parent_id ? categories.data?.find((c) => c.id === category.parent_id) : undefined
  const familyRoot = parent ?? category
  const children = familyRoot ? (categories.data ?? []).filter((c) => c.parent_id === familyRoot.id) : []
  const content = COLLECTION_CONTENT[slug]
  const path = category && categories.data ? categoryPath(category, categories.data) : `/collections/${slug}`

  useRouteTheme(category?.theme_default)
  useSeo({
    title: content?.seoTitle ?? (category ? `${category.name} Online` : 'Collection'),
    description: content?.seoDescription ?? category?.description ?? undefined,
    path,
    image: products.data?.[0]?.media[0]?.url,
  })

  const sorted = useMemo(() => {
    let list = [...(products.data ?? [])]
    if (inStockOnly) list = list.filter((p) => p.in_stock && p.stock_count > 0)
    if (sort === 'price-asc') list.sort((a, b) => a.sale_price - b.sale_price)
    if (sort === 'price-desc') list.sort((a, b) => b.sale_price - a.sale_price)
    if (sort === 'newest') list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return list
  }, [products.data, sort, inStockOnly])

  if (categories.data && !category) return <NotFoundPage />

  const crumbs = [
    { name: 'Home', path: '/' },
    ...(parent && categories.data ? [{ name: parent.name, path: categoryPath(parent, categories.data) }] : []),
    ...(category ? [{ name: category.name, path }] : []),
  ]

  return (
    <>
      {category && (
        <>
          <JsonLd data={breadcrumbJsonLd(crumbs, SITE_URL)} />
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: category.name,
              description: content?.seoDescription ?? category.description,
              url: `${SITE_URL}${path}`,
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: sorted.slice(0, 20).map((p, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  url: `${SITE_URL}/product/${p.slug}`,
                  name: p.title,
                })),
              },
            }}
          />
        </>
      )}

      <section className="bg-gradient-to-br from-hero-from to-hero-to text-hero-ink">
        <div className="mx-auto max-w-7xl px-4 pt-10 pb-12 sm:px-6 sm:pt-14">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs opacity-80">
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3" />}
                {i < crumbs.length - 1 ? (
                  <Link to={c.path} className="hover:underline">
                    {c.name}
                  </Link>
                ) : (
                  <span aria-current="page">{c.name}</span>
                )}
              </span>
            ))}
          </nav>
          <p className="mt-6 text-xs font-semibold tracking-[0.25em] uppercase opacity-80">{content?.eyebrow ?? 'Collection'}</p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl heritage:text-heritage-gold">{category?.name ?? '…'}</h1>
          {category?.telugu_name && (
            <p lang="te" className="mt-2 text-lg opacity-90">
              {category.telugu_name}
            </p>
          )}
          <p className="mt-4 max-w-2xl opacity-90">{content?.intro ?? category?.description}</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {children.length > 0 && familyRoot && categories.data && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-8 sm:mx-0 sm:px-0">
            {[familyRoot, ...children].map((c) => (
              <Link
                key={c.id}
                to={categoryPath(c, categories.data!)}
                className={cn(
                  'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition',
                  c.slug === slug ? 'border-primary bg-primary text-primary-ink' : 'border-line hover:border-primary',
                )}
              >
                {c.id === familyRoot.id ? 'All' : c.name}
              </Link>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 py-6">
          <p className="text-sm text-ink-muted">{products.loading ? 'Loading designs…' : `${sorted.length} ${sorted.length === 1 ? 'design' : 'designs'}`}</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="accent-[var(--ak-primary)]" />
              In stock
            </label>
            <label className="flex items-center gap-2 text-sm">
              <SlidersHorizontal className="size-4" />
              <span className="sr-only">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </div>
        </div>

        <ProductGrid products={products.data ? sorted : undefined} loading={products.loading} error={products.error} />

        {content?.seoCopy && (
          <section className="mt-16 rounded-xl border border-line bg-surface-muted/50 p-6 text-sm leading-relaxed text-ink-muted sm:p-8">
            <h2 className="mb-3 font-display text-2xl font-semibold text-ink">About {category?.name}</h2>
            {content.seoCopy.map((para) => (
              <p key={para.slice(0, 24)} className="mb-3 last:mb-0">
                {para}
              </p>
            ))}
          </section>
        )}
      </div>
    </>
  )
}
