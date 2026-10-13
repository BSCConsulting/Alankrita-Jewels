// Shiprocket + Delhivery clients. Server half: functions/api/logistics/{shiprocket,delhivery}.ts
// Env bindings (server): SHIPROCKET_TOKEN, SHIPROCKET_PICKUP_LOCATION, DELHIVERY_TOKEN, DELHIVERY_BASE_URL.
import type { Order, ShippingProvider } from '@/types'
import { callApi } from './apiClient'

export interface ShipmentResult {
  provider: ShippingProvider
  awb: string
  trackingUrl: string
  providerRef?: string
  mock: boolean
}

export const trackingUrlFor = (provider: ShippingProvider, awb: string) =>
  provider === 'DELHIVERY' ? `https://www.delhivery.com/track-v2/package/${awb}` : `https://shiprocket.co/tracking/${awb}`

function mockShipment(provider: ShippingProvider): ShipmentResult {
  const awb = `${provider === 'DELHIVERY' ? '1490' : '1913'}${Math.floor(1e8 + Math.random() * 9e8)}`
  return { provider, awb, trackingUrl: trackingUrlFor(provider, awb), mock: true }
}

async function createShipment(provider: Exclude<ShippingProvider, 'MANUAL'>, order: Order): Promise<ShipmentResult> {
  const path = provider === 'SHIPROCKET' ? '/api/logistics/shiprocket' : '/api/logistics/delhivery'
  const res = await callApi<ShipmentResult>(path, { order })
  return res.available ? res.data : mockShipment(provider)
}

export const createShiprocketOrder = (order: Order) => createShipment('SHIPROCKET', order)
export const createDelhiveryShipment = (order: Order) => createShipment('DELHIVERY', order)
