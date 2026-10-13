import { PackageOpen } from 'lucide-react'
import type { Product } from '@/types'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'
import { ProductCard } from './ProductCard'

interface Props {
  products: Product[] | undefined
  loading: boolean
  error?: Error | null
  skeletonCount?: number
}

export function ProductGrid({ products, loading, error, skeletonCount }: Props) {
  if (loading && !products) return <ProductGridSkeleton count={skeletonCount} />
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Couldn’t load products: {error.message}</p>
  if (!products?.length)
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-ink-muted">
        <PackageOpen className="size-10" />
        <p>New designs are being polished. Check back soon!</p>
      </div>
    )
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} eager={i < 4} />
      ))}
    </div>
  )
}
