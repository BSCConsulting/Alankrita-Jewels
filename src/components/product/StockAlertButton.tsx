import { lazy, Suspense, useEffect, useState } from 'react'
import { BellRing, Check, Loader2, X } from 'lucide-react'
import { Overlay } from '@/components/ui/Overlay'
import { toast } from '@/components/ui/Toaster'
import { cn } from '@/lib/format'
import { toCustomerMessage } from '@/lib/supabase'
import { requestStockAlert } from '@/services/stockAlerts'
import { useAuthStore } from '@/stores/useAuthStore'

// The OTP form is only needed after a tap, so it stays out of the product page bundle.
const MobileVerificationStep = lazy(() =>
  import('@/components/checkout/MobileVerificationStep').then((m) => ({ default: m.MobileVerificationStep })),
)

/** "Notify me" for sold-out pieces. Uses the OTP-verified number, so nobody can sign up someone else's phone. */
export function StockAlertButton({ productId, className }: { productId: string; className?: string }) {
  const { userId, phone, init } = useAuthStore()
  const [verifying, setVerifying] = useState(false)
  const [wanted, setWanted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    if (!wanted || !userId || !phone || busy) return
    setWanted(false)
    setVerifying(false)
    setBusy(true)
    requestStockAlert(productId, phone)
      .then(() => {
        setDone(true)
        toast.success('Done! We’ll WhatsApp you as soon as it’s back.')
      })
      .catch((e) => toast.error(toCustomerMessage(e, 'Could not save your request. Please try again.')))
      .finally(() => setBusy(false))
  }, [wanted, userId, phone, productId, busy])

  if (done) {
    return (
      <p className={cn('flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800', className)}>
        <Check className="size-4" /> We’ll WhatsApp you when it’s back in stock
      </p>
    )
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setWanted(true)
          if (!userId) setVerifying(true)
        }}
        className={cn('ak-btn-outline w-full border-primary', className ?? 'py-3.5 text-base')}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <BellRing className="size-5" />} Notify me when it’s back
      </button>

      <Overlay open={verifying} onClose={() => (setVerifying(false), setWanted(false))} label="Verify your number" placement="bottom-sheet">
        <div className="ak-card bg-bg max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-b-[inherit]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm text-ink-muted">Verify your WhatsApp number and we’ll message you the moment this piece is restocked.</p>
            <button type="button" onClick={() => (setVerifying(false), setWanted(false))} className="-m-2 p-2 text-ink-muted" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <Suspense fallback={<Loader2 className="mx-auto my-8 size-6 animate-spin text-ink-muted" />}>
            <MobileVerificationStep />
          </Suspense>
        </div>
      </Overlay>
    </>
  )
}
