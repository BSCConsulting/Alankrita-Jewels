import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BadgeIndianRupee, ChevronRight, Minus, Play, Plus, ShieldCheck, ShoppingBag, Truck, Video, Zap } from 'lucide-react'
import { ProductBadges } from '@/components/product/ProductBadges'
import { ProductGrid } from '@/components/product/ProductGrid'
import { ReelModal } from '@/components/product/ReelModal'
import { WhatsAppEnquiryButton } from '@/components/product/WhatsAppEnquiryButton'
import { JsonLd } from '@/components/seo/JsonLd'
import { PriceTag } from '@/components/ui/PriceTag'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Skeleton } from '@/components/ui/Skeleton'
import { categoryPath, JEWELLERY_TYPE_LABEL, THEME_BY_JEWELLERY_TYPE } from '@/config/collections'
import { PAYMENT_RULES } from '@/config/site'
import { useAsync } from '@/hooks/useAsync'
import { cn, formatINR } from '@/lib/format'
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld'
import { SITE_URL, useSeo } from '@/lib/seo'
import { fetchCategories, fetchProductBySlug, fetchProducts, productImages, productReel, productThumbnail } from '@/services/catalog'
import { toast } from '@/components/ui/Toaster'
import { addLimitMessage, MAX_QTY_PER_PRODUCT, useCartStore } from '@/stores/useCartStore'
import { useRouteTheme } from '@/theme/ThemeProvider'
import NotFoundPage from './NotFoundPage'

const CARE = {
  heritage: [
    'Put jewellery on after makeup, hairspray and perfume',
    'Wipe gently with soft cotton after every wear',
    'Store in the airtight pouch provided, away from moisture',
    'Avoid water, sweat and sanitiser contact',
  ],
  modern: [
    'Waterproof — shower, gym and swim safe',
    'Clean with mild soap and lukewarm water',
    'Avoid bleach, chlorine and harsh chemicals',
    'Store pieces separately to prevent scratches',
  ],
}

export default function ProductPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const add = useCartStore((s) => s.add)
  const { data: product, loading } = useAsync(() => fetchProductBySlug(slug), [slug])
  const { data: categories } = useAsync(() => fetchCategories(), [])
  const related = useAsync(
    () => (product?.category ? fetchProducts({ categorySlug: product.category.slug, excludeId: product.id, limit: 4 }) : Promise.resolve([])),
    [product?.id],
  )

  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [sizeError, setSizeError] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [reelOpen, setReelOpen] = useState(false)
  const gallery = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSize(product?.available_sizes.length === 1 ? product.available_sizes[0] : null)
    setQty(1)
    setActiveImage(0)
  }, [product?.id, product?.available_sizes])

  const theme = product ? (product.category?.theme_default ?? THEME_BY_JEWELLERY_TYPE[product.jewellery_type]) : undefined
  useRouteTheme(theme)

  useSeo({
    title: product ? `${product.title} — ${formatINR(product.sale_price)}` : 'Loading…',
    description: product?.description?.slice(0, 158) ?? undefined,
    path: `/product/${slug}`,
    image: product ? productThumbnail(product) : undefined,
    type: 'product',
  })

  if (loading && !product)
    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2">
        <Skeleton className="aspect-[4/5] w-full" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  if (!product) return <NotFoundPage />

  const images = productImages(product)
  const reel = productReel(product)
  const soldOut = !product.in_stock || product.stock_count < 1
  const upiPrice = product.sale_price - Math.round(product.sale_price * PAYMENT_RULES.prepaidDiscountRate)
  const categoryLink = product.category && categories ? categoryPath(product.category, categories) : null
  const crumbs = [
    { name: 'Home', path: '/' },
    ...(product.category && categoryLink ? [{ name: product.category.name, path: categoryLink }] : []),
    { name: product.title, path: `/product/${product.slug}` },
  ]

  const showImage = (i: number) => {
    setActiveImage(i)
    gallery.current?.scrollTo({ left: gallery.current.clientWidth * i, behavior: 'smooth' })
  }

  const addToBag = (buyNow = false) => {
    if (product.available_sizes.length && !size) {
      setSizeError(true)
      document.getElementById('size-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const added = add(
      {
        productId: product.id,
        slug: product.slug,
        title: product.title,
        teluguTitle: product.telugu_title,
        jewelleryType: product.jewellery_type,
        image: productThumbnail(product),
        mrp: product.mrp,
        salePrice: product.sale_price,
        size,
        maxQty: product.stock_count,
      },
      qty,
    )
    const notice = addLimitMessage(qty, added)
    if (notice) toast.error(notice)
    if (buyNow) {
      useCartStore.getState().close()
      navigate('/checkout')
    }
  }

  return (
    <>
      <JsonLd
        data={productJsonLd(
          {
            ...product,
            imageUrls: images.map((m) => m.url),
            categoryName: product.category?.name,
          },
          SITE_URL,
        )}
      />
      <JsonLd data={breadcrumbJsonLd(crumbs, SITE_URL)} />

      <div className="mx-auto max-w-7xl px-4 pt-8 pb-28 sm:px-6 md:pb-10">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          {crumbs.map((c, i) => (
            <span key={c.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" />}
              {i < crumbs.length - 1 ? (
                <Link to={c.path} className="hover:text-primary">
                  {c.name}
                </Link>
              ) : (
                <span aria-current="page" className="line-clamp-1">
                  {c.name}
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
          {/* Gallery */}
          <div className="md:sticky md:top-32 md:self-start">
            <div className="ak-card relative overflow-hidden">
              <div
                ref={gallery}
                className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto"
                onScroll={(e) => setActiveImage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
              >
                {images.map((img, i) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt={i === 0 ? product.title : `${product.title} — view ${i + 1}`}
                    className="h-full w-full shrink-0 snap-start object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                ))}
              </div>
              <div className="pointer-events-none absolute top-3 left-3">
                <ProductBadges product={product} />
              </div>
              {reel && (
                <button
                  onClick={() => setReelOpen(true)}
                  className="absolute right-3 bottom-3 flex items-center gap-2 rounded-full bg-black/75 py-1.5 pr-4 pl-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-white text-black">
                    <Play className="ml-0.5 size-3.5 fill-current" />
                  </span>
                  Watch 5s Reel
                </button>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => showImage(i)}
                  className={cn('size-16 overflow-hidden rounded-md border-2 transition sm:size-20', i === activeImage ? 'border-primary' : 'border-transparent opacity-70')}
                  aria-label={`Show image ${i + 1}`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              {reel && (
                <button
                  onClick={() => setReelOpen(true)}
                  className="relative grid size-16 place-items-center overflow-hidden rounded-md bg-black text-white sm:size-20"
                  aria-label="Watch reel"
                >
                  <img src={productThumbnail(product)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
                  <Video className="relative size-6" />
                </button>
              )}
            </div>
            {images.some((img) => img.url.startsWith('/products/')) && (
              <p className="mt-2 text-xs text-ink-muted">Representative image. The actual piece may vary slightly in design and finish.</p>
            )}
          </div>

          {/* Details */}
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase modern:text-ink-muted">
              {JEWELLERY_TYPE_LABEL[product.jewellery_type]}
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight font-bold text-primary sm:text-4xl">{product.title}</h1>
            {product.telugu_title && (
              <p lang="te" className="mt-1 text-lg text-ink-muted">
                {product.telugu_title}
              </p>
            )}

            <PriceTag mrp={product.mrp} sale={product.sale_price} size="lg" className="mt-5" />
            <p className="mt-1 text-xs text-ink-muted">Inclusive of all taxes · Free insured shipping</p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                <Zap className="size-4 shrink-0" />
                <span>
                  <strong>{formatINR(upiPrice)}</strong> with UPI (5% off)
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-sm">
                <BadgeIndianRupee className="size-4 shrink-0 text-primary" />
                <span>Or reserve with just ₹{PAYMENT_RULES.partialCodAdvance}</span>
              </div>
            </div>

            {product.available_sizes.length > 0 && (
              <div id="size-picker" className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    Size{size ? `: ${size}` : ''}
                    {product.jewellery_type !== 'anti-tarnish' && /^\d/.test(product.available_sizes[0]) && product.available_sizes[0].includes('.') && (
                      <span className="ml-1 font-normal text-ink-muted">(bangle size)</span>
                    )}
                  </p>
                  <WhatsAppEnquiryButton
                    productName={`${product.title} (size help)`}
                    price={product.sale_price}
                    label="Size help"
                    className="px-3 py-1 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Choose size">
                  {product.available_sizes.map((s) => (
                    <button
                      key={s}
                      role="radio"
                      aria-checked={size === s}
                      onClick={() => {
                        setSize(s)
                        setSizeError(false)
                      }}
                      className={cn(
                        'min-w-14 border px-4 py-2.5 text-sm font-medium transition',
                        size === s ? 'border-primary bg-primary text-primary-ink' : 'border-line hover:border-primary',
                      )}
                      style={{ borderRadius: 'var(--ak-radius-pill)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {sizeError && <p className="ak-error">Please select a size</p>}
              </div>
            )}

            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center rounded-full border border-line">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={soldOut} className="p-3" aria-label="Decrease quantity">
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center font-semibold">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.max(1, Math.min(q + 1, product.stock_count, MAX_QTY_PER_PRODUCT)))}
                  disabled={soldOut}
                  className="p-3"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <p className={cn('text-sm', product.stock_count <= 5 ? 'font-semibold text-red-700' : 'text-ink-muted')}>
                {soldOut ? 'Sold out' : product.stock_count <= 5 ? `Only ${product.stock_count} left!` : 'In stock, ready to ship'}
              </p>
            </div>

            <div className="mt-6 hidden gap-3 md:grid md:grid-cols-2">
              <button onClick={() => addToBag()} disabled={soldOut} className="ak-btn-outline border-primary py-3.5 text-base">
                <ShoppingBag className="size-5" /> Add to bag
              </button>
              <button onClick={() => addToBag(true)} disabled={soldOut} className="ak-btn-primary py-3.5 text-base">
                Buy now
              </button>
            </div>
            <WhatsAppEnquiryButton productName={product.title} price={product.sale_price} className="mt-3 w-full py-3.5 text-base" />

            <ul className="mt-8 grid gap-3 text-sm">
              <li className="flex gap-3">
                <Truck className="size-5 shrink-0 text-primary" /> Dispatched in 24 hrs · 2–3 days to AP & Telangana, 4–7 days rest of India
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="size-5 shrink-0 text-primary" /> {product.warranty_details ?? 'Quality checked before dispatch'}
              </li>
              <li className="flex gap-3">
                <Video className="size-5 shrink-0 text-primary" /> Record an unedited unboxing video — required for damage claims within 48 hours
              </li>
            </ul>

            <div className="mt-8 space-y-6 border-t border-line pt-8">
              {product.description && (
                <section>
                  <h2 className="mb-2 font-display text-xl font-semibold">Description</h2>
                  <p className="leading-relaxed text-ink-muted">{product.description}</p>
                </section>
              )}
              <section>
                <h2 className="mb-2 font-display text-xl font-semibold">Specifications</h2>
                <dl className="divide-y divide-line rounded-lg border border-line text-sm">
                  {[
                    ['Type', JEWELLERY_TYPE_LABEL[product.jewellery_type]],
                    ['Plating / Material', product.plating_type],
                    ['Warranty', product.warranty_details],
                    ['Sizes', product.available_sizes.join(', ') || 'Free size'],
                    ['Collection', product.category?.name],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[140px_1fr] gap-2 px-4 py-2.5">
                        <dt className="text-ink-muted">{k}</dt>
                        <dd className="font-medium">{v}</dd>
                      </div>
                    ))}
                </dl>
              </section>
              {theme && (
                <section>
                  <h2 className="mb-2 font-display text-xl font-semibold">Care guide</h2>
                  <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
                    {CARE[theme].map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>

        {(related.data?.length ?? 0) > 0 && (
          <section className="mt-20">
            <SectionHeading eyebrow="Complete the look" title="You may also love" />
            <ProductGrid products={related.data} loading={related.loading} />
          </section>
        )}
      </div>

      {/* Sticky mobile purchase bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="flex items-center gap-2 pr-16">
          <div className="min-w-0 shrink-0">
            <p className="text-lg leading-none font-bold">{formatINR(product.sale_price)}</p>
            <p className="text-[11px] text-emerald-700">{formatINR(upiPrice)} with UPI</p>
          </div>
          <button
            onClick={() => addToBag()}
            disabled={soldOut}
            className="ak-btn-outline ml-auto shrink-0 border-primary px-3 py-3"
            aria-label="Add to bag"
          >
            <ShoppingBag className="size-5" />
          </button>
          <button onClick={() => addToBag(true)} disabled={soldOut} className="ak-btn-primary min-w-0 flex-1 px-3 py-3">
            {soldOut ? 'Sold out' : 'Buy now'}
          </button>
        </div>
      </div>

      {reel && <ReelModal product={product} open={reelOpen} onClose={() => setReelOpen(false)} />}
    </>
  )
}
