import { customerDb } from '@/lib/customerSession'
import { supabase } from '@/lib/supabase'
import { commitMockDb, delay, mockDb, uid } from './mockDb'

/** Signs the verified customer up for a WhatsApp message when a sold-out piece is restocked. */
export async function requestStockAlert(productId: string, phone: string): Promise<void> {
  if (!customerDb) {
    await delay(120)
    const db = mockDb()
    const product = db.products.find((p) => p.id === productId)
    if (!product) throw new Error('This piece is no longer available')
    if (product.in_stock && product.stock_count > 0) throw new Error('Good news — this piece is in stock now')
    const existing = db.stockAlerts.find((a) => a.product_id === productId && a.phone === phone)
    if (existing) existing.notified_at = null
    else db.stockAlerts.push({ id: uid(), product_id: productId, phone, created_at: new Date().toISOString(), notified_at: null })
    commitMockDb()
    return
  }
  const { error } = await customerDb.rpc('request_stock_alert', { p_product_id: productId })
  if (error) throw error
}

export interface PendingStockAlerts {
  product: { id: string; title: string; slug: string; stock_count: number; in_stock: boolean }
  alerts: Array<{ id: string; phone: string; created_at: string }>
}

/** Waiting customers grouped by piece, restocked pieces first. */
export async function listPendingStockAlerts(): Promise<PendingStockAlerts[]> {
  let rows: Array<{ id: string; phone: string; created_at: string; product: PendingStockAlerts['product'] | null }>
  if (!supabase) {
    await delay(80)
    const products = new Map(mockDb().products.map((p) => [p.id, p]))
    rows = mockDb()
      .stockAlerts.filter((a) => !a.notified_at)
      .map((a) => {
        const p = products.get(a.product_id)
        return { ...a, product: p ? { id: p.id, title: p.title, slug: p.slug, stock_count: p.stock_count, in_stock: p.in_stock } : null }
      })
  } else {
    const { data, error } = await supabase
      .from('stock_alerts')
      .select('id, phone, created_at, product:products(id, title, slug, stock_count, in_stock)')
      .is('notified_at', null)
      .order('created_at')
      .limit(1000)
    if (error) throw error
    rows = (data ?? []) as unknown as typeof rows
  }

  const groups = new Map<string, PendingStockAlerts>()
  for (const r of rows) {
    if (!r.product) continue
    const g = groups.get(r.product.id) ?? { product: r.product, alerts: [] }
    g.alerts.push({ id: r.id, phone: r.phone, created_at: r.created_at })
    groups.set(r.product.id, g)
  }
  const restocked = (g: PendingStockAlerts) => g.product.in_stock && g.product.stock_count > 0
  return [...groups.values()].sort((a, b) => Number(restocked(b)) - Number(restocked(a)) || b.alerts.length - a.alerts.length)
}

export async function markStockAlertsNotified(ids: string[]): Promise<void> {
  if (!ids.length) return
  const now = new Date().toISOString()
  if (!supabase) {
    for (const a of mockDb().stockAlerts) if (ids.includes(a.id)) a.notified_at = now
    commitMockDb()
    return
  }
  const { data, error } = await supabase.from('stock_alerts').update({ notified_at: now }).in('id', ids).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Your admin session has expired. Please sign in again.')
}
