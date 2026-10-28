import { useEffect, useState } from 'react'
import { ImagePlus, Loader2, Star, X } from 'lucide-react'
import { Overlay } from '@/components/ui/Overlay'
import { toast } from '@/components/ui/Toaster'
import { cn } from '@/lib/format'
import { toCustomerMessage } from '@/lib/supabase'
import { REVIEW_RULES, submitReview } from '@/services/reviews'
import { useAuthStore } from '@/stores/useAuthStore'

const RATING_WORDS = ['', 'Poor', 'Okay', 'Good', 'Very good', 'Loved it']

interface Props {
  productId: string
  productTitle: string
  open: boolean
  onClose: () => void
  onSubmitted: () => void
}

export function ReviewForm({ productId, productTitle, open, onClose, onSubmitted }: Props) {
  const { userId, phone } = useAuthStore()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [photos])

  const addPhotos = (files: FileList | null) => {
    const images = [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
    const next = [...photos, ...images].slice(0, REVIEW_RULES.maxPhotos)
    if (photos.length + images.length > REVIEW_RULES.maxPhotos) toast.error(`You can add up to ${REVIEW_RULES.maxPhotos} photos`)
    setPhotos(next)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !phone) return setError('Please verify your mobile number first')
    if (!rating) return setError('Please choose a star rating')
    if (body.trim().length < REVIEW_RULES.minBody) return setError('Please write at least a sentence about the piece')
    setError(null)
    setBusy(true)
    try {
      await submitReview({ productId, rating, title, body, photos }, { userId, phone })
      toast.success('Thank you! Your review will appear once we check it.')
      onSubmitted()
      onClose()
    } catch (err) {
      setError(toCustomerMessage(err, 'Could not save your review. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const shown = hover || rating

  return (
    <Overlay open={open} onClose={busy ? () => {} : onClose} label={`Review ${productTitle}`} placement="bottom-sheet">
      <form onSubmit={submit} className="ak-card bg-bg max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-b-[inherit] md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Your review</p>
            <h2 className="mt-1 font-display text-xl font-semibold">{productTitle}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="-m-2 p-2 text-ink-muted" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <fieldset className="mt-5">
          <legend className="ak-label">How do you like it?</legend>
          <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                className="p-1 text-accent"
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                aria-pressed={rating === n}
              >
                <Star className={cn('size-8 transition', n <= shown ? 'fill-current' : 'opacity-30')} />
              </button>
            ))}
            <span className="ml-2 text-sm font-medium text-ink-muted">{RATING_WORDS[shown]}</span>
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="ak-label">Headline (optional)</span>
          <input
            className="ak-input"
            value={title}
            maxLength={REVIEW_RULES.maxTitle}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Looks just like real gold"
          />
        </label>

        <label className="mt-4 block">
          <span className="ak-label">Your experience</span>
          <textarea
            className="ak-input min-h-28"
            value={body}
            maxLength={REVIEW_RULES.maxBody}
            onChange={(e) => setBody(e.target.value)}
            placeholder="How did it look and feel? Did you wear it for a function?"
          />
          <span className="mt-1 block text-right text-xs text-ink-muted">
            {body.length} / {REVIEW_RULES.maxBody}
          </span>
        </label>

        <div className="mt-2">
          <p className="ak-label">Photos of you wearing it (optional)</p>
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div key={src} className="relative size-20 overflow-hidden rounded-lg border border-line">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {photos.length < REVIEW_RULES.maxPhotos && (
              <label className="grid size-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line text-ink-muted hover:border-primary hover:text-primary">
                <ImagePlus className="size-6" />
                <span className="sr-only">Add photos</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        {error && <p className="ak-error mt-4">{error}</p>}

        <button type="submit" disabled={busy} className="ak-btn-primary mt-5 w-full py-3">
          {busy ? <Loader2 className="size-5 animate-spin" /> : 'Submit review'}
        </button>
        <p className="mt-2 text-center text-xs text-ink-muted">Shown with your first name and town. We check every review before it goes live.</p>
      </form>
    </Overlay>
  )
}
