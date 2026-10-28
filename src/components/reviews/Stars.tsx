import { Star } from 'lucide-react'
import { cn } from '@/lib/format'

/** Read-only star row; partial averages round to the nearest whole star. */
export function Stars({ value, className, size = 'size-4' }: { value: number; className?: string; size?: string }) {
  const filled = Math.round(value)
  return (
    <span className={cn('inline-flex gap-0.5 text-accent', className)} role="img" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn(size, i < filled ? 'fill-current' : 'opacity-30')} aria-hidden />
      ))}
    </span>
  )
}
