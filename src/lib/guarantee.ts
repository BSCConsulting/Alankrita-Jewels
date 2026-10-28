import type { Order } from '../types'

/** Guarantees ending within this many days are flagged, for the customer and for the owner's reminder list. */
export const ENDING_SOON_DAYS = 30
const DAY_MS = 86_400_000

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, six: 6, twelve: 12 }

/** "1-Year Re-polishing Guarantee" → 12, "6-Month Stone & Plating Guarantee" → 6; null when no duration is stated. */
export function warrantyMonths(text: string | null | undefined): number | null {
  const m = text?.match(/\b(\d{1,2}|one|two|three|six|twelve)[\s-]*(years?|yrs?|months?)\b/i)
  if (!m) return null
  const n = NUMBER_WORDS[m[1].toLowerCase()] ?? Number(m[1])
  if (!n) return null
  return /^y/i.test(m[2]) ? n * 12 : n
}

/** Calendar months later; the 31st of a shorter month falls back to its last day. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return d
}

export type GuaranteeStatus = 'active' | 'ending-soon' | 'ended'

export interface Guarantee {
  key: string
  orderNumber: string
  productId: string | null
  title: string
  size: string | null
  text: string
  startsAt: Date
  endsAt: Date
  status: GuaranteeStatus
  daysLeft: number
}

/** Cover runs from the purchase date, as the published policy states; it is shown once the order is delivered. */
export function orderGuarantees(order: Pick<Order, 'order_number' | 'order_status' | 'created_at' | 'items'>, now = new Date()): Guarantee[] {
  if (order.order_status !== 'DELIVERED') return []
  const startsAt = new Date(order.created_at)
  const out: Guarantee[] = []
  for (const item of order.items ?? []) {
    const months = warrantyMonths(item.warranty_details)
    if (!months || !item.warranty_details) continue
    const endsAt = addMonths(startsAt, months)
    const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS)
    out.push({
      key: item.id,
      orderNumber: order.order_number,
      productId: item.product_id,
      title: item.product_title,
      size: item.selected_size,
      text: item.warranty_details,
      startsAt,
      endsAt,
      status: daysLeft <= 0 ? 'ended' : daysLeft <= ENDING_SOON_DAYS ? 'ending-soon' : 'active',
      daysLeft: Math.max(0, daysLeft),
    })
  }
  return out
}

const icsDate = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** Calendar lines may be at most 75 bytes; longer ones continue on lines starting with a space. */
function icsFold(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** An all-day calendar reminder a month before the guarantee ends (or tomorrow, if that has passed). */
export function guaranteeReminderIcs(g: Guarantee, link: string, now = new Date()): string {
  const monthBefore = new Date(g.endsAt.getTime() - ENDING_SOON_DAYS * DAY_MS)
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const day = monthBefore > tomorrow ? monthBefore : tomorrow
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const ends = g.endsAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Alankrita Jewels//Guarantee//EN',
    'BEGIN:VEVENT',
    `UID:${g.key}@alankrita-jewels`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(day)}`,
    `DTEND;VALUE=DATE:${icsDate(next)}`,
    `SUMMARY:${icsText(`Alankrita Jewels guarantee ends ${ends}`)}`,
    `DESCRIPTION:${icsText(`${g.text} for ${g.title} (order ${g.orderNumber}) ends on ${ends}. Message us on WhatsApp to use it: ${link}`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Guarantee reminder',
    'TRIGGER:PT10H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .map(icsFold)
    .join('\r\n')
    .concat('\r\n')
}
