export type ThemeVariant = 'heritage' | 'modern'
export type JewelleryType = '1-gram-gold' | 'anti-tarnish' | 'american-diamond' | 'korean' | 'nakshi-temple'
export type MediaType = 'image' | 'video_reel'
export type PaymentMode = 'PREPAID_UPI' | 'PARTIAL_COD'
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL_PAID' | 'FAILED'
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'
export type ShippingProvider = 'SHIPROCKET' | 'DELHIVERY' | 'MANUAL'

export const JEWELLERY_TYPES: JewelleryType[] = ['1-gram-gold', 'nakshi-temple', 'american-diamond', 'anti-tarnish', 'korean']
export const PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'PAID', 'PARTIAL_PAID', 'FAILED']
export const ORDER_STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED']
export const PAYMENT_MODES: PaymentMode[] = ['PREPAID_UPI', 'PARTIAL_COD']

export interface Category {
  id: string
  name: string
  telugu_name: string | null
  slug: string
  parent_id: string | null
  description: string | null
  theme_default: ThemeVariant
  display_order: number
}

export interface ProductMedia {
  id: string
  product_id: string
  media_type: MediaType
  url: string
  is_thumbnail: boolean
  display_order: number
}

export interface Product {
  id: string
  title: string
  telugu_title: string | null
  slug: string
  description: string | null
  category_id: string | null
  mrp: number
  sale_price: number
  jewellery_type: JewelleryType
  plating_type: string | null
  warranty_details: string | null
  available_sizes: string[]
  in_stock: boolean
  stock_count: number
  featured: boolean
  created_at: string
  category?: Category | null
  media: ProductMedia[]
}

export interface ShippingAddress {
  address_line: string
  landmark?: string
  city: string
  state: string
  pincode: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_title: string
  quantity: number
  unit_price: number
  selected_size: string | null
}

export interface Order {
  id: string
  order_number: string
  user_id: string | null
  customer_phone: string
  customer_name: string
  shipping_address: ShippingAddress
  total_mrp: number
  discount_amount: number
  final_amount: number
  payment_mode: PaymentMode
  advance_paid: number
  balance_due_on_delivery: number
  payment_gateway_ref: string | null
  payment_status: PaymentStatus
  order_status: OrderStatus
  shipping_provider: ShippingProvider | null
  awb_number: string | null
  tracking_url: string | null
  created_at: string
  items?: OrderItem[]
}
