import { computeTotals } from '@/lib/pricing'
import { customerDb } from '@/lib/customerSession'
import type { Order, OrderItem, PaymentMode, PaymentStatus, ShippingAddress } from '@/types'
import { commitMockDb, delay, mockDb, uid } from './mockDb'

export interface PlaceOrderInput {
  items: Array<{ product_id: string; quantity: number; selected_size: string | null }>
  customerName: string
  customerPhone: string
  address: ShippingAddress
  paymentMode: PaymentMode
}

export const ORDER_SELECT = '*, items:order_items(*)'

export function normalizeOrder(row: Record<string, unknown>): Order {
  const o = row as unknown as Order
  return {
    ...o,
    total_mrp: Number(o.total_mrp),
    discount_amount: Number(o.discount_amount),
    final_amount: Number(o.final_amount),
    advance_paid: Number(o.advance_paid),
    balance_due_on_delivery: Number(o.balance_due_on_delivery),
    items: (o.items ?? []).map((i) => ({ ...i, unit_price: Number(i.unit_price) })),
  }
}

/** Amount the customer pays online right now for this order. */
export const amountDueNow = (order: Pick<Order, 'payment_mode' | 'final_amount' | 'balance_due_on_delivery'>) =>
  order.payment_mode === 'PARTIAL_COD' ? order.final_amount - order.balance_due_on_delivery : order.final_amount

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (customerDb) {
    const { data, error } = await customerDb.rpc('place_order', {
      p_items: input.items,
      p_customer_name: input.customerName,
      p_shipping_address: input.address,
      p_payment_mode: input.paymentMode,
    })
    if (error) throw error
    return normalizeOrder(data as Record<string, unknown>)
  }
  return placeMockOrder(input)
}

async function placeMockOrder(input: PlaceOrderInput): Promise<Order> {
  await delay(400)
  const db = mockDb()
  const orderId = uid()
  const lines = input.items.map((item) => {
    const product = db.products.find((p) => p.id === item.product_id)
    if (!product) throw new Error('A product in your bag is no longer available')
    if (!product.in_stock || product.stock_count < item.quantity) throw new Error(`${product.title} is out of stock`)
    if (product.available_sizes.length && !product.available_sizes.includes(item.selected_size ?? '')) {
      throw new Error(`Please choose a valid size for ${product.title}`)
    }
    return { product, item }
  })

  const totals = computeTotals(
    lines.map(({ product, item }) => ({ mrp: product.mrp, sale_price: product.sale_price, quantity: item.quantity })),
    input.paymentMode,
  )

  const items: OrderItem[] = lines.map(({ product, item }) => {
    product.stock_count -= item.quantity
    product.in_stock = product.stock_count > 0
    return {
      id: uid(),
      order_id: orderId,
      product_id: product.id,
      product_title: product.title,
      quantity: item.quantity,
      unit_price: product.sale_price,
      selected_size: item.selected_size,
    }
  })

  let orderNumber: string
  do orderNumber = `ALK-${Math.floor(10000 + Math.random() * 90000)}`
  while (db.orders.some((o) => o.order_number === orderNumber))

  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    user_id: null,
    customer_phone: input.customerPhone,
    customer_name: input.customerName,
    shipping_address: input.address,
    total_mrp: totals.totalMrp,
    discount_amount: totals.discountAmount,
    final_amount: totals.finalAmount,
    payment_mode: input.paymentMode,
    advance_paid: 0,
    balance_due_on_delivery: totals.balanceOnDelivery,
    payment_gateway_ref: null,
    payment_status: 'PENDING',
    order_status: 'PLACED',
    shipping_provider: null,
    awb_number: null,
    tracking_url: null,
    created_at: new Date().toISOString(),
    items,
  }
  db.orders.unshift(order)
  commitMockDb()
  return order
}

/** Mock-mode only: the Pages Function performs this update (with signature checks) in production. */
export async function markMockOrderPaid(orderId: string, gatewayRef: string): Promise<void> {
  const order = mockDb().orders.find((o) => o.id === orderId)
  if (!order) return
  const status: PaymentStatus = order.payment_mode === 'PARTIAL_COD' ? 'PARTIAL_PAID' : 'PAID'
  Object.assign(order, {
    payment_status: status,
    advance_paid: amountDueNow(order),
    payment_gateway_ref: gatewayRef,
    order_status: 'CONFIRMED',
  } satisfies Partial<Order>)
  commitMockDb()
}

/** The signed-in customer's orders, newest first. RLS limits rows to the customer's own orders. */
export async function fetchMyOrders(phone: string | null): Promise<Order[]> {
  if (!customerDb) {
    await delay(150)
    return mockDb()
      .orders.filter((o) => o.customer_phone === phone)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  const { data, error } = await customerDb.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []).map(normalizeOrder)
}

export async function fetchOrderByNumber(orderNumber: string): Promise<Order | null> {
  if (!customerDb) {
    await delay(100)
    return mockDb().orders.find((o) => o.order_number === orderNumber) ?? null
  }
  const { data, error } = await customerDb.from('orders').select(ORDER_SELECT).eq('order_number', orderNumber).maybeSingle()
  if (error) throw error
  return data ? normalizeOrder(data) : null
}
