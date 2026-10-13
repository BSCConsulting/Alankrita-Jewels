import { cn, formatINR } from '@/lib/format'
import { discountPercent } from '@/lib/pricing'

interface PriceTagProps {
  mrp: number
  sale: number
  size?: 'sm' | 'lg'
  inverse?: boolean
  className?: string
}

export function PriceTag({ mrp, sale, size = 'sm', inverse = false, className }: PriceTagProps) {
  const off = discountPercent(mrp, sale)
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2', className)}>
      <span className={cn('font-semibold', inverse ? 'text-white' : 'text-ink', size === 'lg' ? 'text-3xl' : 'text-base')}>
        {formatINR(sale)}
      </span>
      {off > 0 && (
        <>
          <span className={cn('line-through', inverse ? 'text-white/60' : 'text-ink-muted', size === 'lg' ? 'text-lg' : 'text-xs')}>
            {formatINR(mrp)}
          </span>
          <span className={cn('font-semibold', inverse ? 'text-emerald-300' : 'text-emerald-700', size === 'lg' ? 'text-base' : 'text-xs')}>
            {off}% off
          </span>
        </>
      )}
    </div>
  )
}
