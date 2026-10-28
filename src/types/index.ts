export type ThemeVariant = 'heritage' | 'modern'
export type JewelleryType = '1-gram-gold' | 'anti-tarnish' | 'american-diamond' | 'korean' | 'nakshi-temple'
export type MediaType = 'image' | 'video_reel'
export type PaymentMode = 'PREPAID_UPI' | 'PARTIAL_COD' | 'COD'
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL_PAID' | 'FAILED'
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'
export type ShippingProvider = 'SHIPROCKET' | 'DELHIVERY' | 'MANUAL'
export type Occasion = 'wedding' | 'festival' | 'daily' | 'office' | 'party'
export type Stone = 'kempu' | 'emerald' | 'pearl' | 'cz' | 'plain'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export const JEWELLERY_TYPES: JewelleryType[] = ['1-gram-gold', 'nakshi-temple', 'american-diamond', 'anti-tarnish', 'korean']
export const PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'PAID', 'PARTIAL_PAID', 'FAILED']
export const ORDER_STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED']
export const PAYMENT_MODES: PaymentMode[] = ['PREPAID_UPI', 'PARTIAL_COD', 'COD']
// Keep in sync with the products_occasions_valid / products_stones_valid checks in migration 005.
export const OCCASIONS: Occasion[] = ['wedding', 'festival', 'daily', 'office', 'party']
export const STONES: Stone[] = ['kempu', 'emerald', 'pearl', 'cz', 'plain']

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
  /** ~480px copy for grids; null for media uploaded before thumbnails existed. */
  thumb_url?: string | null
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
  occasions: Occasion[]
  stones: Stone[]
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
  /** The guarantee the piece was sold with (migration 006). */
  warranty_details: string | null
}

export interface Order {
  id: string
  order_number: string
  user_id: string | null
  customer_phone: string
  customer_name: string
  shipping_address: ShippingAddress
  total_mrp: number
  subtotal: number
  discount_amount: number
  offer_label: string | null
  offer_discount: number
  prepaid_discount: number
  coupon_code: string | null
  cod_fee: number
  gift_wrap: boolean
  gift_wrap_fee: number
  gift_message: string | null
  gift_card_id?: string | null
  gift_card_amount: number
  free_gift: string | null
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
  delivered_at: string | null
  created_at: string
  items?: OrderItem[]
}

export interface Review {
  id: string
  product_id: string
  user_id?: string
  rating: number
  title: string | null
  body: string
  photos: string[]
  display_name: string
  status: ReviewStatus
  created_at: string
  product?: { title: string; slug: string } | null
}

export interface Coupon {
  id: string
  code: string
  description: string | null
  kind: 'percent' | 'flat'
  value: number
  min_subtotal: number
  max_discount: number | null
  first_order_only: boolean
  usage_limit: number | null
  per_customer_limit: number
  starts_at: string | null
  ends_at: string | null
  active: boolean
  created_at: string
  times_used?: number
}

export interface GiftCard {
  id: string
  code: string
  initial_amount: number
  balance: number
  recipient_name: string | null
  note: string | null
  active: boolean
  expires_at: string | null
  created_at: string
}

export interface StockAlert {
  id: string
  product_id: string
  phone: string
  created_at: string
  notified_at: string | null
}
