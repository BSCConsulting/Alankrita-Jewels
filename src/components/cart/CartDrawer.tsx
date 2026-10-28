import { Link, useNavigate } from 'react-router'
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck, X } from 'lucide-react'
import { Overlay } from '@/components/ui/Overlay'
import { PAYMENT_RULES } from '@/config/site'
import { formatINR } from '@/lib/format'
import { computeTotals } from '@/lib/pricing'
import { lineLimit, toPricedLines, useCartStore } from '@/stores/useCartStore'

export function CartDrawer() {
  const { items, isOpen, close, setQuantity, remove } = useCartStore()
  const navigate = useNavigate()
  const totals = computeTotals(toPricedLines(items), null)
  const upiSaving = Math.round(totals.subtotal * PAYMENT_RULES.prepaidDiscountRate)

  return (
    <Overlay open={isOpen} onClose={close} label="Shopping bag" placement="right">
      <div className="flex h-full flex-col bg-bg">
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <h2 className="font-display text-xl font-semibold">Your Bag ({items.length})</h2>
          <button onClick={close} aria-label="Close bag" className="p-2">
            <X className="size-6" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <ShoppingBag className="size-12 text-ink-muted" />
            <p className="text-ink-muted">Your bag is waiting for something beautiful.</p>
            <button onClick={close} className="ak-btn-primary">
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-4">
              {items.map((item) => (
                <li key={item.key} className="flex gap-3 py-4">
                  <Link to={`/product/${item.slug}`} onClick={close} className="shrink-0">
                    <img src={item.image} alt={item.title} className="size-20 rounded-md border border-line object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                    {item.size && <p className="text-xs text-ink-muted">Size: {item.size}</p>}
                    <p className="mt-1 text-sm">
                      <span className="font-semibold">{formatINR(item.salePrice)}</span>{' '}
                      <span className="text-xs text-ink-muted line-through">{formatINR(item.mrp)}</span>
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center rounded-full border border-line">
                        <button
                          onClick={() => setQuantity(item.key, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="p-1.5 disabled:opacity-30"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => setQuantity(item.key, item.quantity + 1)}
                          disabled={item.quantity >= lineLimit(items, item, item.maxQty)}
                          className="p-1.5 disabled:opacity-30"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <button onClick={() => remove(item.key)} className="p-1.5 text-ink-muted hover:text-red-600" aria-label={`Remove ${item.title}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-line bg-surface-muted/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="rounded-lg border border-dashed border-emerald-600/40 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                Pay via UPI at checkout & save an extra {formatINR(upiSaving)} (5% Shubha Aarambham offer)
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <dt>MRP total</dt>
                  <dd className="line-through">{formatINR(totals.totalMrp)}</dd>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <dt>You save</dt>
                  <dd>−{formatINR(totals.productSavings)}</dd>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <dt>Insured shipping</dt>
                  <dd>FREE</dd>
                </div>
                <div className="flex justify-between pt-1 text-base font-semibold">
                  <dt>Subtotal</dt>
                  <dd>{formatINR(totals.subtotal)}</dd>
                </div>
              </dl>
              <button
                onClick={() => {
                  close()
                  navigate('/checkout')
                }}
                className="ak-btn-primary w-full py-3.5 text-base"
              >
                Secure Checkout
              </button>
              <div className="flex justify-center gap-4 text-[11px] text-ink-muted">
                <span className="flex items-center gap-1">
                  <Truck className="size-3.5" /> 2–3 day AP/TS delivery
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3.5" /> Insured dispatch
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </Overlay>
  )
}
