import { useState, type ReactNode } from 'react'
import { Copy, Gift, Loader2, Plus, TicketPercent } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { OFFER_RULES } from '@/config/site'
import { useAsync } from '@/hooks/useAsync'
import { cn, formatDay, formatINR } from '@/lib/format'
import { SITE_URL } from '@/lib/seo'
import { toErrorMessage } from '@/lib/supabase'
import { whatsappLink } from '@/lib/whatsapp'
import {
  couponProblem,
  createCoupon,
  createGiftCard,
  formatGiftCardCode,
  listCoupons,
  listGiftCards,
  setCouponActive,
  setGiftCardActive,
  type CouponInput,
} from '@/services/offers'
import type { Coupon, GiftCard } from '@/types'

/** "2026-12-31" (date input) → end of that day in India. */
const endOfDayIst = (date: string) => (date ? new Date(`${date}T23:59:59+05:30`).toISOString() : null)
const optionalNumber = (v: string) => (v.trim() === '' ? null : Number(v))

export default function OffersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Offers & gift cards</h1>
      <p className="mt-1 text-sm text-slate-500">
        Automatic offers always apply: {OFFER_RULES.tiers.map((t) => `${formatINR(t.discount)} off on ${formatINR(t.minSubtotal)}+`).join(', ')}, and
        the bridal set saving. A customer gets whichever single offer (automatic or coupon) saves them the most.
      </p>
      <CouponsSection />
      <GiftCardsSection />
    </div>
  )
}

function Panel({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {icon} {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="block text-sm">
    <span className="mb-1 block font-medium text-slate-700">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
  </label>
)

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
const EMPTY_COUPON = {
  code: '',
  description: '',
  kind: 'percent' as 'percent' | 'flat',
  value: '',
  min: '',
  max: '',
  firstOrder: false,
  limit: '',
  perCustomer: '1',
  ends: '',
}

function describe(c: Coupon) {
  const off = c.kind === 'percent' ? `${c.value}% off${c.max_discount ? ` (up to ${formatINR(c.max_discount)})` : ''}` : `${formatINR(c.value)} off`
  return [off, c.min_subtotal > 0 && `on ${formatINR(c.min_subtotal)}+`, c.first_order_only && 'first order only'].filter(Boolean).join(' ')
}

function CouponsSection() {
  const [version, setVersion] = useState(0)
  const { data, loading, error } = useAsync(() => listCoupons(), [version])
  const [form, setForm] = useState<typeof EMPTY_COUPON | null>(null)
  const [busy, setBusy] = useState(false)

  const toInput = (f: typeof EMPTY_COUPON): CouponInput => ({
    code: f.code.trim().toUpperCase(),
    description: f.description.trim() || null,
    kind: f.kind,
    value: Number(f.value),
    min_subtotal: Number(f.min || 0),
    max_discount: f.kind === 'percent' ? optionalNumber(f.max) : null,
    first_order_only: f.firstOrder,
    usage_limit: optionalNumber(f.limit),
    per_customer_limit: Number(f.perCustomer || 1),
    ends_at: endOfDayIst(f.ends),
  })

  const save = async () => {
    if (!form) return
    const coupon = toInput(form)
    const problem = couponProblem(coupon)
    if (problem) return toast.error(problem)
    setBusy(true)
    try {
      await createCoupon(coupon)
      toast.success(`Coupon ${coupon.code} created`)
      setForm(null)
      setVersion((v) => v + 1)
    } catch (e) {
      toast.error(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (c: Coupon) => {
    try {
      await setCouponActive(c.id, !c.active)
      toast.success(c.active ? `${c.code} paused` : `${c.code} is live again`)
      setVersion((v) => v + 1)
    } catch (e) {
      toast.error(toErrorMessage(e))
    }
  }

  const set = (patch: Partial<typeof EMPTY_COUPON>) => setForm((f) => (f ? { ...f, ...patch } : f))

  return (
    <Panel
      icon={<TicketPercent className="size-5 text-slate-500" />}
      title="Coupons"
      action={
        !form && (
          <button onClick={() => setForm(EMPTY_COUPON)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            <Plus className="size-4" /> New coupon
          </button>
        )
      }
    >
      {form && (
        <div className="grid gap-4 border-b border-slate-100 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Code" hint="Capital letters and digits, e.g. DIWALI15">
            <input className={cn(input, 'uppercase')} value={form.code} maxLength={20} onChange={(e) => set({ code: e.target.value.replace(/[^A-Za-z0-9]/g, '') })} />
          </Field>
          <Field label="Type">
            <select className={input} value={form.kind} onChange={(e) => set({ kind: e.target.value as 'percent' | 'flat' })}>
              <option value="percent">Percentage off</option>
              <option value="flat">Flat ₹ off</option>
            </select>
          </Field>
          <Field label={form.kind === 'percent' ? 'Discount %' : 'Discount ₹'} hint={form.kind === 'percent' ? 'Up to 50%' : undefined}>
            <input className={input} type="number" min={1} value={form.value} onChange={(e) => set({ value: e.target.value })} />
          </Field>
          <Field label="Minimum order ₹" hint="Bag value before offers; leave empty for none">
            <input className={input} type="number" min={0} value={form.min} onChange={(e) => set({ min: e.target.value })} />
          </Field>
          {form.kind === 'percent' && (
            <Field label="Maximum discount ₹" hint="Recommended, e.g. 300">
              <input className={input} type="number" min={1} value={form.max} onChange={(e) => set({ max: e.target.value })} />
            </Field>
          )}
          <Field label="Last day" hint="Leave empty to run until you pause it">
            <input className={input} type="date" value={form.ends} onChange={(e) => set({ ends: e.target.value })} />
          </Field>
          <Field label="Total uses" hint="Leave empty for unlimited">
            <input className={input} type="number" min={1} value={form.limit} onChange={(e) => set({ limit: e.target.value })} />
          </Field>
          <Field label="Uses per customer">
            <input className={input} type="number" min={1} value={form.perCustomer} onChange={(e) => set({ perCustomer: e.target.value })} />
          </Field>
          <Field label="Description shown at checkout">
            <input className={input} value={form.description} maxLength={120} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
            <input type="checkbox" checked={form.firstOrder} onChange={(e) => set({ firstOrder: e.target.checked })} />
            Only for a customer’s first order
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 className="size-4 animate-spin" />} Create coupon
            </button>
            <button onClick={() => setForm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && !data ? (
        <Loader2 className="mx-auto my-10 size-6 animate-spin text-slate-400" />
      ) : error ? (
        <p className="p-5 text-sm text-red-700">Couldn’t load coupons: {toErrorMessage(error)}</p>
      ) : !data?.length ? (
        <p className="p-5 text-sm text-slate-500">No coupons yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((c) => {
            const expired = !!c.ends_at && new Date(c.ends_at) < new Date()
            const usedUp = c.usage_limit !== null && (c.times_used ?? 0) >= c.usage_limit
            const status = !c.active ? 'Paused' : expired ? 'Ended' : usedUp ? 'Used up' : 'Live'
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono font-semibold">{c.code}</p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        status === 'Live' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{describe(c)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Used {c.times_used ?? 0}
                    {c.usage_limit ? ` of ${c.usage_limit}` : ''} {(c.usage_limit ?? c.times_used ?? 0) === 1 ? 'time' : 'times'} ·{' '}
                    {c.per_customer_limit} per customer
                    {c.ends_at ? ` · until ${formatDay(c.ends_at)}` : ''}
                  </p>
                </div>
                <button onClick={() => toggle(c)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                  {c.active ? 'Pause' : 'Resume'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Gift cards
// ---------------------------------------------------------------------------
const giftCardMessage = (g: GiftCard) =>
  `🎁 ${g.recipient_name ? `${g.recipient_name}, you` : 'You'}'ve received an Alankrita Jewels gift card worth ${formatINR(g.initial_amount)}!` +
  `${g.note ? `\n\n“${g.note}”` : ''}\n\nGift card code: ${formatGiftCardCode(g.code)}\nShop at ${SITE_URL} and enter the code at checkout.` +
  `${g.expires_at ? `\nValid until ${formatDay(g.expires_at)}.` : ''}`

function GiftCardsSection() {
  const [version, setVersion] = useState(0)
  const { data, loading, error } = useAsync(() => listGiftCards(), [version])
  const [form, setForm] = useState<{ amount: string; recipient: string; note: string; expires: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<GiftCard | null>(null)

  const save = async () => {
    if (!form) return
    setBusy(true)
    try {
      const card = await createGiftCard({
        amount: Number(form.amount),
        recipient_name: form.recipient,
        note: form.note,
        expires_at: endOfDayIst(form.expires),
      })
      setCreated(card)
      setForm(null)
      setVersion((v) => v + 1)
    } catch (e) {
      toast.error(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (g: GiftCard) => {
    if (g.active && !confirm(`Block gift card ${formatGiftCardCode(g.code)}? It can’t be used until you unblock it.`)) return
    try {
      await setGiftCardActive(g.id, !g.active)
      setVersion((v) => v + 1)
    } catch (e) {
      toast.error(toErrorMessage(e))
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy. Please select and copy it manually.')
    }
  }

  return (
    <Panel
      icon={<Gift className="size-5 text-slate-500" />}
      title="Gift cards"
      action={
        !form && (
          <button
            onClick={() => {
              setCreated(null)
              setForm({ amount: '', recipient: '', note: '', expires: '' })
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> New gift card
          </button>
        )
      }
    >
      <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
        Create a card after the buyer has paid you. The code is generated securely; send it to the recipient on WhatsApp. Any unused balance stays on
        the card for their next order.
      </p>

      {form && (
        <div className="grid gap-4 border-b border-slate-100 bg-slate-50 p-5 sm:grid-cols-2">
          <Field label="Value ₹" hint="₹100 to ₹50,000">
            <input className={input} type="number" min={100} max={50000} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Recipient name (optional)">
            <input className={input} maxLength={80} value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
          </Field>
          <Field label="Message (optional)">
            <input className={input} maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <Field label="Valid until (optional)" hint="Consider at least 12 months">
            <input className={input} type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 className="size-4 animate-spin" />} Create gift card
            </button>
            <button onClick={() => setForm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {created && (
        <div className="border-b border-slate-100 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-900">Gift card created: {formatINR(created.initial_amount)}</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-wider">{formatGiftCardCode(created.code)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => copy(formatGiftCardCode(created.code))} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold">
              <Copy className="size-4" /> Copy code
            </button>
            <a
              href={whatsappLink(giftCardMessage(created), '')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
            >
              Send on WhatsApp
            </a>
          </div>
        </div>
      )}

      {loading && !data ? (
        <Loader2 className="mx-auto my-10 size-6 animate-spin text-slate-400" />
      ) : error ? (
        <p className="p-5 text-sm text-red-700">Couldn’t load gift cards: {toErrorMessage(error)}</p>
      ) : !data?.length ? (
        <p className="p-5 text-sm text-slate-500">No gift cards yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((g) => {
            const expired = !!g.expires_at && new Date(g.expires_at) < new Date()
            const status = !g.active ? 'Blocked' : expired ? 'Expired' : g.balance <= 0 ? 'Fully used' : 'Active'
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono font-semibold">{formatGiftCardCode(g.code)}</p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Balance {formatINR(g.balance)} of {formatINR(g.initial_amount)}
                    {g.recipient_name ? ` · for ${g.recipient_name}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Created {formatDay(g.created_at)}
                    {g.expires_at ? ` · valid until ${formatDay(g.expires_at)}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={whatsappLink(giftCardMessage(g), '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                  >
                    Share
                  </a>
                  <button onClick={() => toggle(g)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                    {g.active ? 'Block' : 'Unblock'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
