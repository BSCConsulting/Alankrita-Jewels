import { Droplets, Gem, ShieldCheck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/format'
import type { Product } from '@/types'

interface Badge {
  label: string
  icon: LucideIcon
}

export function productBadges(p: Pick<Product, 'jewellery_type' | 'plating_type' | 'warranty_details'>): Badge[] {
  const badges: Badge[] = []
  if (p.warranty_details && /1[\s-]*year/i.test(p.warranty_details)) badges.push({ label: '1-Year Warranty', icon: ShieldCheck })
  if (p.jewellery_type === 'anti-tarnish' || /pvd/i.test(p.plating_type ?? '')) badges.push({ label: 'Waterproof (PVD)', icon: Droplets })
  if (p.jewellery_type === 'american-diamond') badges.push({ label: 'AAA Grade Swiss CZ', icon: Gem })
  return badges
}

export function ProductBadges({ product, max, variant = 'overlay' }: { product: Product; max?: number; variant?: 'overlay' | 'inline' }) {
  const badges = productBadges(product).slice(0, max)
  if (!badges.length) return null
  return (
    <div className={cn('flex gap-1.5', variant === 'overlay' ? 'flex-col items-start' : 'flex-wrap')}>
      {badges.map(({ label, icon: Icon }) => (
        <span
          key={label}
          className={cn(
            'inline-flex items-center gap-1 font-semibold whitespace-nowrap',
            variant === 'overlay'
              ? 'rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-ink shadow-sm backdrop-blur sm:text-[11px]'
              : 'rounded-full border border-line bg-surface-muted px-3 py-1 text-xs text-ink',
          )}
        >
          <Icon className="size-3 text-primary" />
          {label}
        </span>
      ))}
    </div>
  )
}
