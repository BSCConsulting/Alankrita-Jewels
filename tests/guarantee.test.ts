import { describe, expect, it } from 'vitest'
import { addMonths, guaranteeReminderIcs, orderGuarantees, warrantyMonths } from '../src/lib/guarantee'
import type { Order, OrderItem } from '../src/types'

const item = (id: string, warranty: string | null): OrderItem => ({
  id,
  order_id: 'o1',
  product_id: `p-${id}`,
  product_title: `Piece ${id}`,
  quantity: 1,
  unit_price: 1000,
  selected_size: null,
  warranty_details: warranty,
})

const order = (status: Order['order_status'], items: OrderItem[]) => ({
  order_number: 'ALK-12345',
  order_status: status,
  created_at: new Date(2026, 0, 31, 12).toISOString(),
  items,
})

describe('warrantyMonths', () => {
  it('reads the duration from the guarantee text', () => {
    expect(warrantyMonths('1-Year Re-polishing Guarantee')).toBe(12)
    expect(warrantyMonths('6-Month Stone & Plating Guarantee')).toBe(6)
    expect(warrantyMonths('2 years colour warranty')).toBe(24)
    expect(warrantyMonths('One year plating warranty')).toBe(12)
  })
  it('returns null when no duration is stated', () => {
    expect(warrantyMonths('Quality checked before dispatch')).toBeNull()
    expect(warrantyMonths('0-Year warranty')).toBeNull()
    expect(warrantyMonths(null)).toBeNull()
  })
})

describe('addMonths', () => {
  it('falls back to the last day of shorter months', () => {
    expect(addMonths(new Date(2026, 0, 31), 1).getDate()).toBe(28)
    expect(addMonths(new Date(2026, 0, 31), 12)).toEqual(new Date(2027, 0, 31))
  })
})

describe('orderGuarantees', () => {
  const items = [item('a', '1-Year Re-polishing Guarantee'), item('b', '6-Month Stone & Plating Guarantee'), item('c', null)]

  it('only covers delivered orders, and only pieces with a stated duration', () => {
    expect(orderGuarantees(order('DISPATCHED', items))).toEqual([])
    const g = orderGuarantees(order('DELIVERED', items), new Date(2026, 2, 1))
    expect(g.map((x) => x.key)).toEqual(['a', 'b'])
    expect(g[0].endsAt.getFullYear()).toBe(2027)
    expect(g[1].endsAt.getMonth()).toBe(6)
  })

  it('flags guarantees ending soon and ended ones', () => {
    const at = (d: Date) => orderGuarantees(order('DELIVERED', items), d).map((x) => x.status)
    expect(at(new Date(2026, 1, 1))).toEqual(['active', 'active'])
    expect(at(new Date(2026, 6, 15))).toEqual(['active', 'ending-soon'])
    expect(at(new Date(2026, 7, 1))).toEqual(['active', 'ended'])
  })
})

describe('guaranteeReminderIcs', () => {
  it('sets an all-day reminder a month before the end, escaping text', () => {
    const [g] = orderGuarantees(order('DELIVERED', [item('a', '1-Year Re-polishing Guarantee')]), new Date(2026, 2, 1))
    const ics = guaranteeReminderIcs(g, 'https://wa.me/91', new Date(2026, 2, 1))
    expect(ics).toContain('DTSTART;VALUE=DATE:20270101')
    expect(ics).toContain('DTEND;VALUE=DATE:20270102')
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
  it('wraps long lines at 75 bytes without losing text', () => {
    const [g] = orderGuarantees(order('DELIVERED', [item('a', '1-Year Re-polishing Guarantee')]), new Date(2026, 2, 1))
    const link = `https://wa.me/91?text=${'x'.repeat(200)}`
    const ics = guaranteeReminderIcs(g, link, new Date(2026, 2, 1))
    const lines = ics.split('\r\n')
    expect(Math.max(...lines.map((l) => new TextEncoder().encode(l).length))).toBeLessThanOrEqual(75)
    expect(ics.replace(/\r\n /g, '')).toContain(link)
  })
  it('uses tomorrow when the month-before date has passed', () => {
    const [g] = orderGuarantees(order('DELIVERED', [item('a', '1-Year Re-polishing Guarantee')]), new Date(2027, 0, 20))
    expect(guaranteeReminderIcs(g, 'x', new Date(2027, 0, 20))).toContain('DTSTART;VALUE=DATE:20270121')
  })
})
