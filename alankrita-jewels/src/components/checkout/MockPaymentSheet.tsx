import { FlaskConical } from 'lucide-react'
import { Overlay } from '@/components/ui/Overlay'
import { formatINR } from '@/lib/format'

/** Stand-in for Razorpay Checkout while RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured. */
export function MockPaymentSheet({ amount, onResult }: { amount: number | null; onResult: (approved: boolean) => void }) {
  return (
    <Overlay open={amount !== null} onClose={() => onResult(false)} label="Test payment" placement="bottom-sheet" className="w-full sm:max-w-sm">
      <div className="rounded-t-3xl bg-white p-6 text-slate-800 sm:rounded-3xl">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-amber-700 uppercase">
          <FlaskConical className="size-4" /> Test mode · Razorpay not configured
        </div>
        <p className="mt-4 text-sm text-slate-500">Amount payable</p>
        <p className="text-4xl font-bold">{formatINR(amount ?? 0)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-600">
          {['GPay', 'PhonePe', 'Paytm'].map((app) => (
            <span key={app} className="rounded-lg border border-slate-200 py-2">
              {app}
            </span>
          ))}
        </div>
        <button onClick={() => onResult(true)} className="mt-6 w-full rounded-full bg-emerald-600 py-3.5 font-semibold text-white">
          Simulate successful payment
        </button>
        <button onClick={() => onResult(false)} className="mt-2 w-full py-2.5 text-sm text-slate-500">
          Cancel
        </button>
      </div>
    </Overlay>
  )
}
