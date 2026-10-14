import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { categoryPath } from '@/config/collections'
import { cn } from '@/lib/format'
import { useAsync } from '@/hooks/useAsync'
import { fetchCategories } from '@/services/catalog'

/** Representative artwork per collection until merchandised banners are uploaded. */
const TILE_IMAGE: Record<string, string> = {
  '1-gram-gold-jewellery': '/products/tile-1-gram-gold.webp',
  'vaddanam-hip-belts': '/products/lakshmi-nakshi-temple-vaddanam-1.webp',
  'nallapusalu-black-beads': '/products/lakshmi-coin-nallapusalu-long-chain-1.webp',
  'choker-sets': '/products/kempu-emerald-bridal-choker-set-1.webp',
  'anti-tarnish-waterproof-jewellery': '/products/anti-tarnish-butterfly-huggie-earrings-2.webp',
  'american-diamond-cz-sets': '/products/aaa-swiss-cz-bridal-necklace-set-1.webp',
  'korean-fashion-accessories': '/products/korean-pearl-drop-earrings-2.webp',
}

export function CollectionTiles() {
  const { data: categories } = useAsync(() => fetchCategories(), [])
  if (!categories) return <div className="h-64" />

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {categories.map((c, i) => (
        <Link
          key={c.id}
          to={categoryPath(c, categories)}
          className={cn('group ak-card relative overflow-hidden', i === 0 ? 'col-span-2 aspect-[2/1] md:aspect-auto' : 'aspect-square')}
        >
          <img
            src={TILE_IMAGE[c.slug] ?? '/favicon.svg'}
            alt={c.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 via-40% to-transparent to-75%" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
            <p className="flex items-end gap-1 font-display text-base leading-tight font-semibold drop-shadow sm:text-xl">
              <span className="line-clamp-2">{c.name}</span>
              <ArrowUpRight className="size-4 shrink-0 opacity-0 transition group-hover:opacity-100" />
            </p>
            {c.telugu_name && (
              <p lang="te" className="mt-0.5 line-clamp-1 text-[11px] text-white/85 sm:text-xs">
                {c.telugu_name}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
