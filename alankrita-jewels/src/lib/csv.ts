// CSV exports for the admin panel. Products use the bulk-upload columns, so an export can be re-imported.
import type { Order, Product } from '@/types'

export const PRODUCT_REQUIRED_COLUMNS = ['title', 'category_slug', 'mrp', 'sale_price', 'jewellery_type', 'image_urls'] as const
export const PRODUCT_OPTIONAL_COLUMNS = [
  'slug', 'telugu_title', 'description', 'plating_type', 'warranty_details',
  'available_sizes', 'stock_count', 'in_stock', 'featured', 'reel_url',
] as const
export const PRODUCT_COLUMNS = [...PRODUCT_REQUIRED_COLUMNS, ...PRODUCT_OPTIONAL_COLUMNS]

type Cell = string | number | boolean | null | undefined

/** Spreadsheet apps run cells starting with = + - @ as formulas; numbers like -5 or +91… stay as they are. */
function neutralise(value: string): string {
  if (/^[=@\t\r]/.test(value)) return `'${value}`
  if (/^[+-]/.test(value) && !/^[+-]?\d+(\.\d+)?$/.test(value)) return `'${value}`
  return value
}

export function toCsvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  const s = neutralise(String(value))
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCsv(header: readonly string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(toCsvCell).join(',')).join('\r\n')
}

export function productsToCsv(products: Product[], categorySlugById: Map<string, string>): string {
  return toCsv(
    PRODUCT_COLUMNS,
    products.map((p) => {
      const media = [...p.media].sort((a, b) => Number(b.is_thumbnail) - Number(a.is_thumbnail) || a.display_order - b.display_order)
      const row: Record<(typeof PRODUCT_COLUMNS)[number], Cell> = {
        title: p.title,
        category_slug: (p.category_id && categorySlugById.get(p.category_id)) || p.category?.slug || '',
        mrp: p.mrp,
        sale_price: p.sale_price,
        jewellery_type: p.jewellery_type,
        image_urls: media.filter((m) => m.media_type === 'image').map((m) => m.url).join('|'),
        slug: p.slug,
        telugu_title: p.telugu_title,
        description: p.description,
        plating_type: p.plating_type,
        warranty_details: p.warranty_details,
        available_sizes: p.available_sizes.join('|'),
        stock_count: p.stock_count,
        in_stock: p.in_stock,
        featured: p.featured,
        reel_url: media.find((m) => m.media_type === 'video_reel')?.url,
      }
      return PRODUCT_COLUMNS.map((c) => row[c])
    }),
  )
}

const ORDER_COLUMNS = [
  'order_number', 'placed_at_ist', 'customer_name', 'customer_phone', 'address', 'landmark', 'city', 'state', 'pincode',
  'items', 'total_mrp', 'discount', 'final_amount', 'payment_mode', 'payment_status', 'advance_paid', 'balance_due_on_delivery',
  'payment_ref', 'order_status', 'courier', 'awb', 'tracking_url',
] as const

const istTimestamp = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })

export function ordersToCsv(orders: Order[]): string {
  return toCsv(
    ORDER_COLUMNS,
    orders.map((o) => [
      o.order_number,
      istTimestamp(o.created_at),
      o.customer_name,
      o.customer_phone,
      o.shipping_address.address_line,
      o.shipping_address.landmark,
      o.shipping_address.city,
      o.shipping_address.state,
      o.shipping_address.pincode,
      (o.items ?? []).map((i) => `${i.product_title}${i.selected_size ? ` (${i.selected_size})` : ''} × ${i.quantity}`).join(' | '),
      o.total_mrp,
      o.discount_amount,
      o.final_amount,
      o.payment_mode,
      o.payment_status,
      o.advance_paid,
      o.balance_due_on_delivery,
      o.payment_gateway_ref,
      o.order_status,
      o.shipping_provider,
      o.awb_number,
      o.tracking_url,
    ]),
  )
}

/** The BOM makes Excel open the file as UTF-8, so Telugu text survives. */
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const datedFilename = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`
