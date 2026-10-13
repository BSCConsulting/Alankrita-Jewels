import { Link } from 'react-router'
import { useSeo } from '@/lib/seo'

export default function NotFoundPage() {
  useSeo({ title: 'Page not found', noindex: true })
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <p className="font-display text-7xl font-bold text-accent">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-primary">This piece seems to be missing</h1>
      <p lang="te" className="mt-2 text-ink-muted">
        ఈ పేజీ కనబడలేదు
      </p>
      <Link to="/" className="ak-btn-primary mt-8">
        Back to the collection
      </Link>
    </div>
  )
}
