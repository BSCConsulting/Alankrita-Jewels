import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { categoryPath } from '@/config/collections'
import { cn } from '@/lib/format'
import { useAsync } from '@/hooks/useAsync'
import { fetchCategories } from '@/services/catalog'

/** Representative artwork per collection until merchandised banners are uploaded. */
const TILE_IMAGE: Record<string, string> = {
  '1-gram-gold-jewellery': '/placeholders/guttapusalu-long-haram-1.svg',
  'vaddanam-hip-belts': '/placeholders/lakshmi-nakshi-temple-vaddanam-1.svg',
  'nallapusalu-black-beads': '/placeholders/lakshmi-coin-nallapusalu-long-chain-1.svg',
  'choker-sets': '/placeholders/kempu-emerald-bridal-choker-set-1.svg',
  'anti-tarnish-waterproof-jewellery': '/placeholders/anti-tarnish-butterfly-huggie-earrings-1.svg',
  'american-diamond-cz-sets': '/placeholders/aaa-swiss-cz-bridal-necklace-set-1.svg',
  'korean-fashion-accessories': '/placeholders/korean-pearl-drop-earrings-1.svg',
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
            <p className="flex items-center gap-1 font-display text-lg leading-tight font-semibold sm:text-xl">
              {c.name} <ArrowUpRight className="size-4 opacity-0 transition group-hover:opacity-100" />
            </p>
            {c.telugu_name && (
              <p lang="te" className="text-xs text-white/80">
                {c.telugu_name}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
