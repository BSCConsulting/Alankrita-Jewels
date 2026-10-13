import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { Overlay } from '@/components/ui/Overlay'
import { PriceTag } from '@/components/ui/PriceTag'
import { THEME_BY_JEWELLERY_TYPE } from '@/config/collections'
import { productReel, productThumbnail } from '@/services/catalog'
import type { Product } from '@/types'
import { WhatsAppEnquiryButton } from './WhatsAppEnquiryButton'

const HIGHLIGHTS = {
  heritage: ['Live sparkle', 'True weight & drape', 'Micro-plating luster'],
  modern: ['Real-light shine', 'PVD mirror finish', 'Waterproof tested'],
}

/** Vertical 9:16 reel preview so shoppers can judge sparkle, weight and plating before buying. */
export function ReelModal({ product, open, onClose }: { product: Product; open: boolean; onClose: () => void }) {
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  const reel = productReel(product)
  const poster = productThumbnail(product)

  useEffect(() => {
    if (open) {
      setFailed(false)
      setProgress(0)
    }
  }, [open])

  return (
    <Overlay open={open} onClose={onClose} label={`${product.title} reel`} placement="center">
      <div className="relative mx-auto aspect-[9/16] h-[min(86vh,760px)] max-w-[92vw] overflow-hidden rounded-3xl bg-black shadow-2xl">
        {reel && !failed ? (
          <video
            src={reel}
            poster={poster}
            autoPlay
            loop
            muted={muted}
            playsInline
            className="h-full w-full object-cover"
            onTimeUpdate={(e) => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
            onError={() => setFailed(true)}
          />
        ) : (
          <img src={poster} alt={product.title} className="animate-ken-burns h-full w-full object-cover" />
        )}

        <div className="absolute inset-x-3 top-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white transition-[width] duration-200" style={{ width: `${failed ? 100 : progress}%` }} />
          </div>
          {reel && !failed && (
            <button
              onClick={() => setMuted((m) => !m)}
              className="grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          )}
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur" aria-label="Close reel">
            <X className="size-5" />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-20 text-white">
          <div className="flex flex-wrap gap-1.5">
            {HIGHLIGHTS[THEME_BY_JEWELLERY_TYPE[product.jewellery_type]].map((h) => (
              <span key={h} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
                <Sparkles className="size-3" /> {h}
              </span>
            ))}
          </div>
          <div>
            <p className="font-display text-xl leading-tight font-semibold">{product.title}</p>
            {product.telugu_title && (
              <p lang="te" className="text-sm text-white/75">
                {product.telugu_title}
              </p>
            )}
            {product.plating_type && <p className="mt-1 text-xs text-white/70">{product.plating_type}</p>}
          </div>
          <PriceTag mrp={product.mrp} sale={product.sale_price} inverse />
          <div className="grid grid-cols-2 gap-2">
            <Link to={`/product/${product.slug}`} onClick={onClose} className="ak-btn bg-white text-black">
              View details
            </Link>
            <WhatsAppEnquiryButton productName={product.title} price={product.sale_price} label="Enquire" />
          </div>
        </div>
      </div>
    </Overlay>
  )
}
