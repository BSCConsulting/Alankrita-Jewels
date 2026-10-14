import { Star } from 'lucide-react'

// Genuine, verifiable customer reviews only (with the customer's permission). The home page hides
// the section while this list is empty.
export const REVIEWS: Array<{ name: string; city: string; text: string }> = []

export function Testimonials() {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:scroll-px-0 sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
      {REVIEWS.map((r) => (
        <figure key={r.name} className="ak-card min-w-[260px] snap-start p-5">
          <div className="flex gap-0.5 text-accent" aria-label="5 out of 5 stars">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className="size-4 fill-current" />
            ))}
          </div>
          <blockquote className="mt-3 text-sm leading-relaxed">“{r.text}”</blockquote>
          <figcaption className="mt-4 text-xs font-semibold text-ink-muted">
            {r.name} · {r.city}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
