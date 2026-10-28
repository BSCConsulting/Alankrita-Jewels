import { useEffect } from 'react'
import { Link } from 'react-router'
import { Heart } from 'lucide-react'
import { ProductGrid } from '@/components/product/ProductGrid'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { COLLECTION_SLUGS } from '@/config/site'
import { useAsync } from '@/hooks/useAsync'
import { formatINR } from '@/lib/format'
import { SITE_URL, useSeo } from '@/lib/seo'
import { whatsappLink } from '@/lib/whatsapp'
import { fetchProductsByIds } from '@/services/catalog'
import { useWishlistStore } from '@/stores/useWishlistStore'
import type { Product } from '@/types'

const shareText = (products: Product[]) =>
  `My Alankrita Jewels wishlist 💛\n\n${products
    .map((p) => `• ${p.title} – ${formatINR(p.sale_price)}\n${SITE_URL}/product/${p.slug}`)
    .join('\n\n')}\n\nWhich one should I get?`

export default function WishlistPage() {
  const ids = useWishlistStore((s) => s.ids)
  const keepOnly = useWishlistStore((s) => s.keepOnly)
  // Loaded once per visit; hearts removed on this page simply drop out of the list below.
  const loaded = useAsync(() => fetchProductsByIds(useWishlistStore.getState().ids), [])
  useSeo({ title: 'My wishlist', noindex: true })

  useEffect(() => {
    if (loaded.data) keepOnly(loaded.data.map((p) => p.id))
  }, [loaded.data, keepOnly])

  const products = loaded.data && ids.map((id) => loaded.data!.find((p) => p.id === id)).filter((p) => p !== undefined)

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary sm:text-4xl">My wishlist</h1>
          <p lang="te" className="mt-1 text-ink-muted">
            నాకు నచ్చినవి
          </p>
        </div>
        {products && products.length > 0 && (
          <a href={whatsappLink(shareText(products), '')} target="_blank" rel="noopener noreferrer" className="ak-btn-whatsapp px-5 py-2.5 text-sm">
            <WhatsAppIcon className="size-4" /> Share with family
          </a>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-muted">Saved on this phone. Tap the heart on any piece to add or remove it.</p>

      <div className="mt-8">
        {products && products.length === 0 ? (
          <div className="ak-card mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
            <Heart className="size-10 text-ink-muted" />
            <p className="font-display text-xl font-semibold">Your wishlist is empty</p>
            <p className="text-sm text-ink-muted">Tap the heart on any design to save it here and compare later.</p>
            <Link to={`/collections/${COLLECTION_SLUGS.oneGramGold}`} className="ak-btn-primary mt-2 px-6 py-3">
              Browse 1 Gram Gold
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} loading={loaded.loading} error={loaded.error} />
        )}
      </div>
    </div>
  )
}
