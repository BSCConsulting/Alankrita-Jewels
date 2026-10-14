import { describe, expect, it } from 'vitest'
import { ordersToCsv, PRODUCT_COLUMNS, productsToCsv, toCsv, toCsvCell } from '../src/lib/csv'
import type { Order, Product } from '../src/types'

describe('toCsvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsvCell('a,b')).toBe('"a,b"')
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(toCsvCell('line\nbreak')).toBe('"line\nbreak"')
  })

  it('neutralises spreadsheet formulas but leaves numbers alone', () => {
    expect(toCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(toCsvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(toCsvCell('-cmd')).toBe("'-cmd")
    expect(toCsvCell('+919032654111')).toBe('+919032654111')
    expect(toCsvCell(-5)).toBe('-5')
  })

  it('writes empty cells for null and undefined, and keeps Telugu text', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, 'లక్ష్మీ']])).toBe('a,b,c\r\n,,లక్ష్మీ')
  })
})

describe('productsToCsv', () => {
  const product: Product = {
    id: 'p1',
    title: 'Lakshmi Kasu Haram',
    telugu_title: 'లక్ష్మీ కాసుల హారం',
    slug: 'lakshmi-kasu-haram',
    description: 'Antique, for weddings',
    category_id: 'c1',
    mrp: 8999,
    sale_price: 5499,
    jewellery_type: 'nakshi-temple',
    plating_type: 'Micro Gold',
    warranty_details: null,
    available_sizes: ['2.4', '2.6'],
    in_stock: true,
    stock_count: 8,
    featured: false,
    created_at: '2026-01-01T00:00:00Z',
    media: [
      { id: 'm2', product_id: 'p1', media_type: 'image', url: 'https://x/2.jpg', is_thumbnail: false, display_order: 1 },
      { id: 'm3', product_id: 'p1', media_type: 'video_reel', url: 'https://x/r.mp4', is_thumbnail: false, display_order: 2 },
      { id: 'm1', product_id: 'p1', media_type: 'image', url: 'https://x/1.jpg', is_thumbnail: true, display_order: 0 },
    ],
  }

  it('uses the bulk-upload columns so an export can be re-imported', () => {
    const [header, row] = productsToCsv([product], new Map([['c1', '1-gram-gold-jewellery']])).split('\r\n')
    expect(header).toBe(PRODUCT_COLUMNS.join(','))
    expect(row).toContain('1-gram-gold-jewellery')
    expect(row).toContain('https://x/1.jpg|https://x/2.jpg')
    expect(row).toContain('2.4|2.6')
    expect(row).toContain('"Antique, for weddings"')
    expect(row.endsWith('https://x/r.mp4')).toBe(true)
  })
})

describe('ordersToCsv', () => {
  it('flattens the address and line items', () => {
    const order = {
      id: 'o1',
      order_number: 'AK-1001',
      user_id: null,
      customer_phone: '+919000000000',
      customer_name: 'Sita',
      shipping_address: { address_line: '1-2, Main Rd', city: 'Madhira', state: 'Telangana', pincode: '507203' },
      total_mrp: 2000,
      discount_amount: 500,
      final_amount: 1500,
      payment_mode: 'PARTIAL_COD',
      advance_paid: 150,
      balance_due_on_delivery: 1350,
      payment_gateway_ref: null,
      payment_status: 'PARTIAL_PAID',
      order_status: 'CONFIRMED',
      shipping_provider: null,
      awb_number: null,
      tracking_url: null,
      created_at: '2026-10-14T05:30:00Z',
      items: [
        { id: 'i1', order_id: 'o1', product_id: 'p1', product_title: 'Jhumka', quantity: 2, unit_price: 500, selected_size: null },
        { id: 'i2', order_id: 'o1', product_id: 'p2', product_title: 'Bangle', quantity: 1, unit_price: 500, selected_size: '2.6' },
      ],
    } satisfies Order
    const row = ordersToCsv([order]).split('\r\n')[1]
    expect(row.startsWith('AK-1001,')).toBe(true)
    expect(row).toContain('"1-2, Main Rd"')
    expect(row).toContain('Jhumka × 2 | Bangle (2.6) × 1')
    expect(row).toContain('PARTIAL_COD,PARTIAL_PAID,150,1350')
  })
})
