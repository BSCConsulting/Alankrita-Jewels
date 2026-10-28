import { useState } from 'react'
import { Link } from 'react-router'
import { Check, ExternalLink, Loader2, Trash2, X } from 'lucide-react'
import { Stars } from '@/components/reviews/Stars'
import { toast } from '@/components/ui/Toaster'
import { useAsync } from '@/hooks/useAsync'
import { cn, formatDate } from '@/lib/format'
import { toErrorMessage } from '@/lib/supabase'
import { deleteReview, listReviewsForAdmin, reviewPhotoUrl, setReviewStatus } from '@/services/reviews'
import type { Review, ReviewStatus } from '@/types'

const TABS: Array<{ status: ReviewStatus; label: string }> = [
  { status: 'pending', label: 'Waiting for approval' },
  { status: 'approved', label: 'Published' },
  { status: 'rejected', label: 'Not published' },
]

export default function ReviewsPage() {
  const [tab, setTab] = useState<ReviewStatus>('pending')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const { data, loading, error } = useAsync(() => listReviewsForAdmin(tab), [tab, version])

  const run = async (key: string, action: () => Promise<void>, done: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(done)
      setVersion((v) => v + 1)
    } catch (e) {
      toast.error(toErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const remove = (r: Review) => {
    if (!confirm('Delete this review and its photos permanently?')) return
    void run(`${r.id}:delete`, () => deleteReview(r), 'Review deleted')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Reviews</h1>
      <p className="mt-1 text-sm text-slate-500">
        Only customers with a delivered order can write a review. Nothing appears on the site until you publish it. Publish honest reviews,
        including critical ones: hiding genuine negative reviews is not allowed under consumer rules.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.status}
            onClick={() => setTab(t.status)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium',
              tab === t.status ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Loader2 className="mx-auto mt-16 size-8 animate-spin text-slate-400" />
      ) : error ? (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">Couldn’t load reviews: {toErrorMessage(error)}</p>
      ) : !data?.length ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {tab === 'pending' ? 'No reviews waiting. New ones appear here after customers review delivered orders.' : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {data.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} />
                    {r.title && <p className="font-semibold">{r.title}</p>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.display_name} · {formatDate(r.created_at)}
                    {r.product && (
                      <>
                        {' · '}
                        <Link to={`/product/${r.product.slug}#reviews`} target="_blank" className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                          {r.product.title} <ExternalLink className="size-3" />
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status !== 'approved' && (
                    <button
                      onClick={() => run(`${r.id}:approve`, () => setReviewStatus(r.id, 'approved'), 'Review published')}
                      disabled={!!busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="size-4" /> Publish
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      onClick={() => run(`${r.id}:reject`, () => setReviewStatus(r.id, 'rejected'), 'Review hidden')}
                      disabled={!!busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="size-4" /> {r.status === 'approved' ? 'Unpublish' : 'Don’t publish'}
                    </button>
                  )}
                  <button
                    onClick={() => remove(r)}
                    disabled={!!busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    aria-label="Delete review"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm whitespace-pre-line text-slate-700">{r.body}</p>
              {r.photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.photos.map((p, i) => (
                    <a key={p} href={reviewPhotoUrl(p)} target="_blank" rel="noopener noreferrer" className="size-24 overflow-hidden rounded-lg border border-slate-200">
                      <img src={reviewPhotoUrl(p)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
