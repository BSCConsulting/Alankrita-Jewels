// POST /api/logistics/shiprocket  { order }  (admin only)
// Creates a Shiprocket ad-hoc order and assigns an AWB. Env: SHIPROCKET_TOKEN, SHIPROCKET_PICKUP_LOCATION.
import type { Env } from '../../_lib/env'
import { error, json, readJson } from '../../_lib/http'
import { DEFAULT_PARCEL, fullAddress, loadShippableOrder, mockShipment, tenDigitPhone, trackingUrlFor, type ShipOrderPayload } from '../../_lib/shipping'
import { requireAdmin } from '../../_lib/supabase'

const API = 'https://apiv2.shiprocket.in/v1/external'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const live = Boolean(env.SHIPROCKET_TOKEN)
  const denied = await requireAdmin(env, request, live)
  if (denied) return denied

  const order = await loadShippableOrder(env, (await readJson<{ order: ShipOrderPayload }>(request)).order)
  if (order instanceof Response) return order
  if (!live) return json(mockShipment('SHIPROCKET'))

  const headers = { authorization: `Bearer ${env.SHIPROCKET_TOKEN}`, 'content-type': 'application/json' }
  const [firstName, ...rest] = order.customer_name.trim().split(/\s+/)
  const isCod = Number(order.balance_due_on_delivery) > 0

  const createRes = await fetch(`${API}/orders/create/adhoc`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      order_id: order.order_number,
      order_date: order.created_at.slice(0, 16).replace('T', ' '),
      pickup_location: env.SHIPROCKET_PICKUP_LOCATION ?? 'Primary',
      billing_customer_name: firstName,
      billing_last_name: rest.join(' ') || '.',
      billing_address: fullAddress(order.shipping_address),
      billing_city: order.shipping_address.city,
      billing_pincode: order.shipping_address.pincode,
      billing_state: order.shipping_address.state,
      billing_country: 'India',
      billing_email: env.SHIPROCKET_BILLING_EMAIL ?? 'orders@alankritajewels.in',
      billing_phone: tenDigitPhone(order.customer_phone),
      shipping_is_billing: true,
      order_items: (order.items ?? []).map((i) => ({
        name: i.product_title,
        sku: i.product_id ?? i.id,
        units: i.quantity,
        selling_price: Number(i.unit_price),
      })),
      payment_method: isCod ? 'COD' : 'Prepaid',
      sub_total: Number(order.final_amount),
      // The courier collects only the balance due; anything already paid online is passed as a discount.
      total_discount: isCod ? Number(order.final_amount) - Number(order.balance_due_on_delivery) : 0,
      length: DEFAULT_PARCEL.lengthCm,
      breadth: DEFAULT_PARCEL.breadthCm,
      height: DEFAULT_PARCEL.heightCm,
      weight: DEFAULT_PARCEL.weightKg,
    }),
  })
  const created = (await createRes.json()) as { order_id?: number; shipment_id?: number; message?: string }
  if (!createRes.ok || !created.shipment_id) return error(`Shiprocket: ${created.message ?? 'order creation failed'}`, 502)

  const awbRes = await fetch(`${API}/courier/assign/awb`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ shipment_id: created.shipment_id }),
  })
  const assigned = (await awbRes.json()) as { response?: { data?: { awb_code?: string } }; message?: string }
  const awb = assigned.response?.data?.awb_code
  if (!awbRes.ok || !awb) return error(`Shiprocket AWB: ${assigned.message ?? 'no courier available'}`, 502)

  return json({ provider: 'SHIPROCKET', awb, trackingUrl: trackingUrlFor('SHIPROCKET', awb), providerRef: String(created.shipment_id), mock: false })
}
