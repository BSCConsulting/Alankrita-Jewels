import { Link } from 'react-router'
import { BadgeCheck, MessageSquareHeart } from 'lucide-react'
import { formatDay } from '@/lib/format'
import { reviewPhotoUrl, summarize } from '@/services/reviews'
import type { Review } from '@/types'
import { Stars } from './Stars'

export function ProductReviews({ reviews, loading }: { reviews: Review[] | null | undefined; loading: boolean }) {
  if (loading && !reviews) return null
  const list = reviews ?? []
  const { average, count } = summarize(list)

  return (
    <section id="reviews" className="mt-20 scroll-mt-28">
      <h2 className="font-display text-2xl font-semibold">Customer reviews</h2>

      {count === 0 ? (
        <div className="ak-card mt-4 flex items-center gap-4 p-5 text-sm">
          <MessageSquareHeart className="size-8 shrink-0 text-accent" />
          <p className="text-ink-muted">
            No reviews yet. Bought this piece? Once it’s delivered you can review it from{' '}
            <Link to="/orders" className="font-semibold text-primary hover:underline">
              My orders
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-6 md:grid-cols-[240px_1fr]">
          <div className="ak-card h-fit p-5">
            <p className="text-4xl font-bold">{average.toFixed(1)}</p>
            <Stars value={average} className="mt-1" />
            <p className="mt-1 text-sm text-ink-muted">
              {count} verified review{count > 1 ? 's' : ''}
            </p>
            <ul className="mt-4 space-y-1.5 text-xs">
              {[5, 4, 3, 2, 1].map((n) => {
                const k = list.filter((r) => r.rating === n).length
                return (
                  <li key={n} className="flex items-center gap-2">
                    <span className="w-3 text-ink-muted">{n}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <span className="block h-full bg-accent" style={{ width: `${(k / count) * 100}%` }} />
                    </span>
                    <span className="w-5 text-right text-ink-muted">{k}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <ul className="space-y-4">
            {list.map((r) => (
              <li key={r.id} className="ak-card p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} />
                  {r.title && <p className="font-semibold">{r.title}</p>}
                </div>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{r.body}</p>
                {r.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.photos.map((p, i) => (
                      <a key={p} href={reviewPhotoUrl(p)} target="_blank" rel="noopener noreferrer" className="size-20 overflow-hidden rounded-lg border border-line">
                        <img src={reviewPhotoUrl(p)} alt={`Customer photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">{r.display_name}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <BadgeCheck className="size-3.5" /> Verified buyer
                  </span>
                  <span>· {formatDay(r.created_at)}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
