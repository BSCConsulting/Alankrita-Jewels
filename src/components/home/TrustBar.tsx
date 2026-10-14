import { BadgeIndianRupee, Droplets, ShieldCheck, Truck } from 'lucide-react'

const ITEMS = [
  { icon: ShieldCheck, title: '1-Year Re-polish Guarantee', body: 'On all 1 gram gold' },
  { icon: Droplets, title: 'Waterproof PVD Range', body: '316L steel, never fades' },
  { icon: Truck, title: '2–3 Day Delivery', body: 'Insured across AP & TS' },
  { icon: BadgeIndianRupee, title: 'Partial COD', body: 'Reserve with just ₹150' },
]

export function TrustBar() {
  return (
    <section className="border-b border-line bg-surface-muted/60">
      <ul className="no-scrollbar mx-auto flex max-w-7xl snap-x scroll-px-4 gap-6 overflow-x-auto px-4 py-5 sm:scroll-px-6 sm:px-6 md:grid md:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex min-w-[210px] snap-start items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-ink-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
