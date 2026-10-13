import { useState } from 'react'
import { Play } from 'lucide-react'
import { ReelModal } from '@/components/product/ReelModal'
import { formatINR } from '@/lib/format'
import { productReel, productThumbnail } from '@/services/catalog'
import type { Product } from '@/types'

/** "Watch before you buy" row of 9:16 reel posters. */
export function ReelStrip({ products }: { products: Product[] }) {
  const [active, setActive] = useState<Product | null>(null)
  const withReels = products.filter((p) => productReel(p))
  if (!withReels.length) return null

  return (
    <>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {withReels.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p)}
            className="group relative aspect-[9/16] w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-black text-left sm:w-44"
          >
            <img src={productThumbnail(p)} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition group-hover:scale-105" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-white/85 text-black shadow-lg transition group-hover:scale-110">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-8 text-white">
              <span className="line-clamp-2 block text-xs font-semibold">{p.title}</span>
              <span className="text-xs text-white/80">{formatINR(p.sale_price)}</span>
            </span>
          </button>
        ))}
      </div>
      {active && <ReelModal product={active} open onClose={() => setActive(null)} />}
    </>
  )
}
