import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Play, ShoppingBag } from 'lucide-react'
import { cn, formatINR } from '@/lib/format'
import { discountPercent } from '@/lib/pricing'
import { PAYMENT_RULES } from '@/config/site'
import { productImages, productReel, productThumbnail } from '@/services/catalog'
import { addLimitMessage, useCartStore } from '@/stores/useCartStore'
import { toast } from '@/components/ui/Toaster'
import type { Product } from '@/types'
import { PriceTag } from '@/components/ui/PriceTag'
import { ProductBadges } from './ProductBadges'
import { ReelModal } from './ReelModal'
import { WhatsAppEnquiryButton } from './WhatsAppEnquiryButton'

export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [reelOpen, setReelOpen] = useState(false)
  const add = useCartStore((s) => s.add)

  const images = productImages(product)
  const reel = productReel(product)
  const off = discountPercent(product.mrp, product.sale_price)
  const href = `/product/${product.slug}`
  const needsSize = product.available_sizes.length > 1
  const soldOut = !product.in_stock || product.stock_count < 1
  const upiPrice = product.sale_price - Math.round(product.sale_price * PAYMENT_RULES.prepaidDiscountRate)

  // Desktop: hovering glides to the secondary photo. Touch: native swipe via scroll-snap.
  const glideTo = (i: number) => {
    const el = scroller.current
    if (el && images.length > 1) el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' })
  }

  const quickAdd = () => {
    const added = add({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      teluguTitle: product.telugu_title,
      image: productThumbnail(product),
      mrp: product.mrp,
      salePrice: product.sale_price,
      size: product.available_sizes[0] ?? null,
      maxQty: product.stock_count,
    })
    const notice = addLimitMessage(1, added)
    if (notice) toast.error(notice)
  }

  return (
    <article className="ak-card group flex flex-col overflow-hidden">
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-muted" onMouseEnter={() => glideTo(1)} onMouseLeave={() => glideTo(0)}>
        <div
          ref={scroller}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {(images.length ? images : [{ id: 'fallback', url: productThumbnail(product) }]).map((img, i) => (
            <Link key={img.id} to={href} className="h-full w-full shrink-0 snap-start" tabIndex={i === 0 ? 0 : -1}>
              <img
                src={img.url}
                alt={i === 0 ? product.title : `${product.title} — detail view`}
                loading={eager && i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              />
            </Link>
          ))}
        </div>

        <div className="pointer-events-none absolute top-2 left-2">
          <ProductBadges product={product} max={2} />
        </div>
        {off > 0 && (
          <span className="absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-ink sm:text-xs">
            -{off}%
          </span>
        )}

        {images.length > 1 && (
          <div className="pointer-events-none absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((img, i) => (
              <span key={img.id} className={cn('h-1.5 rounded-full bg-white shadow transition-all', i === index ? 'w-4' : 'w-1.5 opacity-60')} />
            ))}
          </div>
        )}

        {reel && (
          <button
            type="button"
            onClick={() => setReelOpen(true)}
            className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 py-1 pr-2.5 pl-1 text-[10px] font-semibold text-white shadow-lg backdrop-blur transition hover:bg-black sm:text-[11px]"
            aria-label={`Watch 5 second reel of ${product.title}`}
          >
            <span className="relative grid size-5 place-items-center rounded-full bg-white text-black">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/60" />
              <Play className="relative size-2.5 fill-current" />
            </span>
            Watch 5s Reel
          </button>
        )}

        {soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-white/55">
            <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">Sold out</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <Link to={href} className="line-clamp-2 text-sm leading-snug font-semibold hover:text-primary sm:text-[15px]">
          {product.title}
        </Link>
        {product.telugu_title && (
          <p lang="te" className="line-clamp-1 text-[11px] text-ink-muted sm:text-xs">
            {product.telugu_title}
          </p>
        )}
        <PriceTag mrp={product.mrp} sale={product.sale_price} showOff={false} className="mt-1" />
        <p className="text-[11px] font-medium text-emerald-700">{formatINR(upiPrice)} with UPI</p>

        <div className="mt-auto grid grid-cols-1 gap-2 pt-3">
          {needsSize ? (
            <Link to={href} className="ak-btn-primary px-3 py-2.5 text-xs">
              Choose size
            </Link>
          ) : (
            <button type="button" onClick={quickAdd} disabled={soldOut} className="ak-btn-primary px-3 py-2.5 text-xs">
              <ShoppingBag className="size-4 shrink-0" /> {soldOut ? 'Sold out' : 'Add to bag'}
            </button>
          )}
          <WhatsAppEnquiryButton
            productName={product.title}
            price={product.sale_price}
            label="Enquire"
            ariaLabel={`Enquire about ${product.title} on WhatsApp`}
            className="px-3 py-2.5 text-xs"
          />
        </div>
      </div>

      {reel && <ReelModal product={product} open={reelOpen} onClose={() => setReelOpen(false)} />}
    </article>
  )
}
