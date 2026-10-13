// WhatsApp tracking notifications. Server half: functions/api/notify/whatsapp.ts
// Env bindings (server): WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TRACKING_TEMPLATE.
// Without them, the admin gets a wa.me deep link to send the message from the business phone.
import { SITE } from '@/config/site'
import { formatINR } from '@/lib/format'
import { whatsappLink } from '@/lib/whatsapp'
import type { Order } from '@/types'
import { callApi } from './apiClient'

export function trackingMessage(order: Order): string {
  const lines = [
    `Namaste ${order.customer_name} 🙏`,
    `Your ${SITE.name} order ${order.order_number} has been dispatched!`,
    order.awb_number ? `AWB: ${order.awb_number}` : null,
    order.tracking_url ? `Track: ${order.tracking_url}` : null,
    order.balance_due_on_delivery > 0
      ? `Please keep ${formatINR(order.balance_due_on_delivery)} ready (cash/UPI) for the courier.`
      : 'Fully prepaid — nothing to pay on delivery.',
    'Please record an unboxing video when you open the parcel. 📦',
    `మీ ఆర్డర్ పంపబడింది. ధన్యవాదాలు! — ${SITE.teluguName}`,
  ]
  return lines.filter(Boolean).join('\n')
}

export interface NotifyResult {
  sent: boolean
  waLink: string
}

export async function sendTrackingNotification(order: Order): Promise<NotifyResult> {
  const message = trackingMessage(order)
  const waLink = whatsappLink(message, order.customer_phone.replace(/\D/g, ''))
  const res = await callApi<{ mode: 'live' | 'mock' }>(
    '/api/notify/whatsapp',
    {
      to: order.customer_phone,
      message,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      trackingUrl: order.tracking_url,
      awb: order.awb_number,
    },
    'admin',
  )
  return { sent: res.available && res.data.mode === 'live', waLink }
}
