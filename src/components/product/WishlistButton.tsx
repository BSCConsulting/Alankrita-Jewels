import { Heart } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { cn } from '@/lib/format'
import { useIsWishlisted, useWishlistStore } from '@/stores/useWishlistStore'

/** Round heart button laid over a product photo. */
export function WishlistButton({ productId, title, className }: { productId: string; title: string; className?: string }) {
  const saved = useIsWishlisted(productId)
  const toggle = useWishlistStore((s) => s.toggle)

  return (
    <button
      type="button"
      onClick={() => toast.success(toggle(productId) ? 'Saved to your wishlist' : 'Removed from your wishlist')}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
      className={cn('ak-hit grid place-items-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition hover:scale-105 active:scale-90', className)}
    >
      <Heart className={cn('size-[55%]', saved && 'fill-rose-500 text-rose-500')} />
    </button>
  )
}
