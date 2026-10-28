import { BellPlus, ShieldCheck } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { cn, formatDay } from '@/lib/format'
import { guaranteeReminderIcs, orderGuarantees, type Guarantee } from '@/lib/guarantee'
import { whatsappLink } from '@/lib/whatsapp'
import type { Order } from '@/types'

const claimText = (g: Guarantee) =>
  `Hi Alankrita Jewels, I'd like to use the ${g.text} for ${g.title}${g.size ? ` (${g.size})` : ''} from order ${g.orderNumber}.`

function downloadReminder(g: Guarantee) {
  const ics = guaranteeReminderIcs(g, whatsappLink(claimText(g)))
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `alankrita-guarantee-${g.orderNumber}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The customer's guarantee for each piece of a delivered order; renders nothing when no piece has one. */
export function GuaranteeCard({ order }: { order: Order }) {
  const guarantees = orderGuarantees(order)
  if (!guarantees.length) return null

  return (
    <section className="ak-card mt-8 overflow-hidden" aria-labelledby="guarantee-heading">
      <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-hero-from to-hero-to px-5 py-4 text-hero-ink">
        <ShieldCheck className="size-7 shrink-0" />
        <div>
          <h2 id="guarantee-heading" className="font-display text-lg font-semibold">
            Your guarantee card
          </h2>
          <p className="text-xs opacity-80">Counted from your order date, {formatDay(order.created_at)}</p>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {guarantees.map((g) => (
          <li key={g.key} className="space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {g.title}
                  {g.size && <span className="font-normal text-ink-muted"> · {g.size}</span>}
                </p>
                <p className="text-sm text-ink-muted">{g.text}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                  g.status === 'active' && 'bg-emerald-100 text-emerald-800',
                  g.status === 'ending-soon' && 'bg-amber-100 text-amber-900',
                  g.status === 'ended' && 'bg-slate-100 text-slate-600',
                )}
              >
                {g.status === 'ended'
                  ? `Ended ${formatDay(g.endsAt.toISOString())}`
                  : `Valid till ${formatDay(g.endsAt.toISOString())}`}
              </span>
            </div>
            {g.status === 'ending-soon' && (
              <p className="text-sm font-medium text-amber-900">
                {g.daysLeft} {g.daysLeft === 1 ? 'day' : 'days'} left — message us now to use it.
              </p>
            )}
            {g.status !== 'ended' && (
              <div className="flex flex-wrap gap-2">
                <a href={whatsappLink(claimText(g))} target="_blank" rel="noopener noreferrer" className="ak-btn-whatsapp px-4 py-2 text-sm">
                  <WhatsAppIcon className="size-4" /> Use my guarantee
                </a>
                {g.status === 'active' && (
                  <button type="button" onClick={() => downloadReminder(g)} className="ak-btn-outline px-4 py-2 text-sm">
                    <BellPlus className="size-4" /> Remind me before it ends
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
