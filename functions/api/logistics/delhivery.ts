// POST /api/logistics/delhivery  { order }  (admin only)
// Creates a Delhivery B2C shipment (CMU API). Env: DELHIVERY_TOKEN, DELHIVERY_BASE_URL, DELHIVERY_PICKUP_NAME.
import type { Env } from '../../_lib/env'
import { error, json, readJson } from '../../_lib/http'
import { DEFAULT_PARCEL, fullAddress, loadShippableOrder, mockShipment, tenDigitPhone, trackingUrlFor, type ShipOrderPayload } from '../../_lib/shipping'
import { requireAdmin } from '../../_lib/supabase'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const live = Boolean(env.DELHIVERY_TOKEN)
  const denied = await requireAdmin(env, request, live)
  if (denied) return denied

  const order = await loadShippableOrder(env, (await readJson<{ order: ShipOrderPayload }>(request)).order)
  if (order instanceof Response) return order
  if (!live) return json(mockShipment('DELHIVERY'))

  const isCod = order.payment_mode === 'PARTIAL_COD'
  const items = order.items ?? []
  const data = {
    shipments: [
      {
        name: order.customer_name,
        add: fullAddress(order.shipping_address),
        pin: order.shipping_address.pincode,
        city: order.shipping_address.city,
        state: order.shipping_address.state,
        country: 'India',
        phone: tenDigitPhone(order.customer_phone),
        order: order.order_number,
        payment_mode: isCod ? 'COD' : 'Prepaid',
        cod_amount: isCod ? Number(order.balance_due_on_delivery) : 0,
        total_amount: Number(order.final_amount),
        products_desc: items.map((i) => `${i.product_title} x${i.quantity}`).join(', ').slice(0, 250) || 'Jewellery',
        quantity: String(items.reduce((n, i) => n + i.quantity, 0) || 1),
        weight: DEFAULT_PARCEL.weightKg * 1000,
        shipment_length: DEFAULT_PARCEL.lengthCm,
        shipment_width: DEFAULT_PARCEL.breadthCm,
        shipment_height: DEFAULT_PARCEL.heightCm,
        shipping_mode: 'Surface',
      },
    ],
    pickup_location: { name: env.DELHIVERY_PICKUP_NAME ?? 'ALANKRITA JEWELS' },
  }

  const res = await fetch(`${env.DELHIVERY_BASE_URL ?? 'https://track.delhivery.com'}/api/cmu/create.json`, {
    method: 'POST',
    headers: {
      authorization: `Token ${env.DELHIVERY_TOKEN}`,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: `format=json&data=${encodeURIComponent(JSON.stringify(data))}`,
  })
  const body = (await res.json()) as { success?: boolean; packages?: Array<{ waybill?: string; remarks?: string[] }>; rmk?: string }
  const pkg = body.packages?.[0]
  if (!res.ok || !body.success || !pkg?.waybill) {
    return error(`Delhivery: ${pkg?.remarks?.join('; ') || body.rmk || 'shipment creation failed'}`, 502)
  }

  return json({ provider: 'DELHIVERY', awb: pkg.waybill, trackingUrl: trackingUrlFor('DELHIVERY', pkg.waybill), mock: false })
}
