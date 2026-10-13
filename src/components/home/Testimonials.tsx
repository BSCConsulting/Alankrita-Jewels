import { Star } from 'lucide-react'

// SAMPLE copy for layout only — replace with genuine, verifiable customer reviews before launch.
const REVIEWS = [
  { name: 'Sravani K.', city: 'Vijayawada', text: 'Wore the Nakshi vaddanam for my sister’s wedding — everyone asked which jeweller in Governorpet I bought it from!' },
  { name: 'Divya R.', city: 'Hyderabad', text: 'The PVD chain has survived 4 months of showers and gym. Zero fading. Reached Kukatpally in 2 days.' },
  { name: 'Lakshmi P.', city: 'Visakhapatnam', text: 'Partial COD made me comfortable ordering the first time. Packaging was beautiful and insured.' },
  { name: 'Anusha M.', city: 'Warangal', text: 'Nallapusalu looks exactly like my real gold one. The 5-second reel helped me judge the size perfectly.' },
]

export function Testimonials() {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
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
