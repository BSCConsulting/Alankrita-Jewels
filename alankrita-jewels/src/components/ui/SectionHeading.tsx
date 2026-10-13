import type { ReactNode } from 'react'
import { cn } from '@/lib/format'

interface Props {
  eyebrow?: string
  title: string
  telugu?: string | null
  action?: ReactNode
  align?: 'left' | 'center'
  as?: 'h1' | 'h2'
}

export function SectionHeading({ eyebrow, title, telugu, action, align = 'left', as: Tag = 'h2' }: Props) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8', align === 'center' && 'flex-col items-center text-center')}>
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.25em] text-accent uppercase modern:text-ink-muted">{eyebrow}</p>}
        <Tag className="font-display text-3xl leading-tight font-bold text-primary sm:text-4xl">{title}</Tag>
        {telugu && (
          <p lang="te" className="mt-1 text-sm text-ink-muted sm:text-base">
            {telugu}
          </p>
        )}
        <div className={cn('ak-motif mt-3 w-40', align === 'center' && 'mx-auto')} />
      </div>
      {action}
    </div>
  )
}
