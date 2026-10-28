import { Link, useParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { FilterBar, NoMatches, useProductFilters } from '@/components/product/FilterBar'
import { clearedFilters } from '@/lib/filters'
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

export default function CollectionPage() {
  const { slug = '' } = useParams()

  const categories = useAsync(() => fetchCategories(), [])
  const products = useAsync(() => fetchProducts({ categorySlug: slug }), [slug])
  const { filters, setFilters, shown } = useProductFilters(products.data)

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
                itemListElement: (products.data ?? []).slice(0, 20).map((p, i) => ({
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
                  <Link to={c.path} className="ak-hit relative hover:underline">
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
                  'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95',
                  c.slug === slug ? 'border-primary bg-primary text-primary-ink' : 'border-line hover:border-primary',
                )}
              >
                {c.id === familyRoot.id ? 'All' : c.name}
              </Link>
            ))}
          </div>
        )}

        <FilterBar products={products.data} shown={shown} filters={filters} onChange={setFilters} loading={products.loading} />

        {shown && shown.length === 0 && (products.data?.length ?? 0) > 0 ? (
          <NoMatches onClear={() => setFilters(clearedFilters(filters))} />
        ) : (
          <ProductGrid products={shown} loading={products.loading} error={products.error} />
        )}

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
