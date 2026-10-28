import { SectionHeading } from '@/components/ui/SectionHeading'
import { useAsync } from '@/hooks/useAsync'
import { fetchProductsByIds } from '@/services/catalog'
import { useRecentlyViewedStore } from '@/stores/useWishlistStore'
import { ProductGrid } from './ProductGrid'

/** The last pieces this shopper opened, newest first; hidden until there is something to show. */
export function RecentlyViewed({ excludeId, className }: { excludeId?: string; className?: string }) {
  const ids = useRecentlyViewedStore((s) => s.ids).filter((id) => id !== excludeId).slice(0, 4)
  const key = ids.join(',')
  const { data } = useAsync(async () => {
    const products = await fetchProductsByIds(ids)
    return ids.map((id) => products.find((p) => p.id === id)).filter((p) => p !== undefined)
  }, [key])

  if (!data?.length) return null
  return (
    <section className={className}>
      <SectionHeading eyebrow="Pick up where you left off" title="Recently viewed" />
      <ProductGrid products={data} loading={false} />
    </section>
  )
}
