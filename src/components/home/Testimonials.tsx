import { Link } from 'react-router'
import { BadgeCheck } from 'lucide-react'
import { Stars } from '@/components/reviews/Stars'
import { useAsync } from '@/hooks/useAsync'
import { fetchFeaturedReviews, reviewPhotoUrl } from '@/services/reviews'

// Genuine customer words shared outside the site (e.g. on WhatsApp), quoted with the customer's permission.
export const REVIEWS: Array<{ name: string; city: string; text: string }> = []

interface Card {
  key: string
  rating: number
  text: string
  author: string
  verified: boolean
  photo?: string
  product?: { title: string; slug: string } | null
}

/** Approved verified-buyer reviews plus any quoted testimonials; renders nothing until there is at least one. */
export function useTestimonials() {
  const { data } = useAsync(() => fetchFeaturedReviews(8), [])
  const cards: Card[] = [
    ...(data ?? []).map((r) => ({
      key: r.id,
      rating: r.rating,
      text: r.body,
      author: r.display_name,
      verified: true,
      photo: r.photos[0] ? reviewPhotoUrl(r.photos[0]) : undefined,
      product: r.product,
    })),
    ...REVIEWS.map((r) => ({ key: `q-${r.name}-${r.city}`, rating: 5, text: r.text, author: `${r.name}, ${r.city}`, verified: false })),
  ]
  return cards
}

export function Testimonials({ cards }: { cards: Card[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:scroll-px-0 sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
      {cards.map((c) => (
        <figure key={c.key} className="ak-card flex min-w-[260px] snap-start flex-col p-5">
          <Stars value={c.rating} />
          <blockquote className="mt-3 line-clamp-6 text-sm leading-relaxed">“{c.text}”</blockquote>
          {c.photo && <img src={c.photo} alt="" loading="lazy" className="mt-3 aspect-square w-20 rounded-lg object-cover" />}
          <figcaption className="mt-auto pt-4 text-xs text-ink-muted">
            <span className="font-semibold text-ink">{c.author}</span>
            {c.verified && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-700">
                <BadgeCheck className="size-3.5" /> Verified buyer
              </span>
            )}
            {c.product && (
              <Link to={`/product/${c.product.slug}#reviews`} className="mt-1 block truncate hover:text-primary hover:underline">
                {c.product.title}
              </Link>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
