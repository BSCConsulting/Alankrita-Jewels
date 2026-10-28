import type { Env } from './env'
import { error } from './http'
import { fetchOrder, hasSupabase } from './supabase'

export type Provider = 'SHIPROCKET' | 'DELHIVERY'

/** Order shape posted by the admin panel (subset of the `orders` row + items). */
export interface ShipOrderPayload {
  id: string
  order_number: string
  created_at: string
  customer_name: string
  customer_phone: string
  shipping_address: { address_line: string; landmark?: string; city: string; state: string; pincode: string }
  final_amount: number
  payment_mode: 'PREPAID_UPI' | 'PARTIAL_COD' | 'COD'
  balance_due_on_delivery: number
  items?: Array<{ id: string; product_id: string | null; product_title: string; quantity: number; unit_price: number }>
}

export interface ShipmentResult {
  provider: Provider
  awb: string
  trackingUrl: string
  providerRef?: string
  mock: boolean
}

export const trackingUrlFor = (provider: Provider, awb: string) =>
  provider === 'DELHIVERY' ? `https://www.delhivery.com/track-v2/package/${awb}` : `https://shiprocket.co/tracking/${awb}`

export function mockShipment(provider: Provider): ShipmentResult {
  const awb = `${provider === 'DELHIVERY' ? '1490' : '1913'}${Math.floor(1e8 + Math.random() * 9e8)}`
  return { provider, awb, trackingUrl: trackingUrlFor(provider, awb), mock: true }
}

export const tenDigitPhone = (e164: string) => e164.replace(/\D/g, '').slice(-10)

export const fullAddress = (a: ShipOrderPayload['shipping_address']) => [a.address_line, a.landmark].filter(Boolean).join(', ')

export function isValidPayload(o: Partial<ShipOrderPayload> | undefined): o is ShipOrderPayload {
  return Boolean(o?.id && o.order_number && o.customer_phone && o.shipping_address?.pincode && o.final_amount !== undefined)
}

/**
 * The order to book, read from the database rather than trusted from the request body, and only once
 * it is paid (or is a cash-on-delivery order) and not yet shipped. Without Supabase (local mock mode)
 * the posted order is used as-is.
 */
export async function loadShippableOrder(env: Env, posted: Partial<ShipOrderPayload> | undefined): Promise<ShipOrderPayload | Response> {
  if (!hasSupabase(env)) return isValidPayload(posted) ? posted : error('A complete order payload is required', 400)
  const order = posted?.id ? await fetchOrder(env, posted.id) : null
  if (!order) return error('Order not found', 404)
  if (order.order_status === 'CANCELLED') return error('Order is cancelled', 409)
  const paid = order.payment_status === 'PAID' || order.payment_status === 'PARTIAL_PAID'
  const codUnpaid = order.payment_mode === 'COD' && order.payment_status === 'PENDING'
  if (!paid && !codUnpaid) return error('Payment not received yet', 409)
  if (order.order_status !== 'PLACED' && order.order_status !== 'CONFIRMED') return error(`Order is already ${order.order_status.toLowerCase()}`, 409)
  if (order.awb_number) return error('AWB already generated', 409)
  return { ...order, created_at: order.created_at ?? new Date().toISOString() }
}

/** Default parcel for a boxed jewellery set; override per order once weights are tracked. */
export const DEFAULT_PARCEL = { lengthCm: 15, breadthCm: 12, heightCm: 6, weightKg: 0.4 }
