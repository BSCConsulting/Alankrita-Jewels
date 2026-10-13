// Razorpay client. Server half: functions/api/payments/{create-order,verify}.ts
// Env bindings (server): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET. The key id is returned to the browser by the API.
import { SITE } from '@/config/site'
import { isSupabaseConfigured } from '@/lib/supabase'
import { amountDueNow, markMockOrderPaid } from '@/services/orders'
import type { Order } from '@/types'
import { callApi } from './apiClient'

type CreateOrderResponse =
  | { mode: 'live'; keyId: string; razorpayOrderId: string; amount: number; currency: 'INR' }
  | { mode: 'mock'; amount: number }

interface RazorpaySuccess {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayInstance {
  open(): void
  on(event: 'payment.failed', cb: (resp: { error: { description: string } }) => void): void
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance
  }
}

export type PaymentOutcome = { status: 'paid'; ref: string } | { status: 'dismissed' } | { status: 'failed'; reason: string }

export interface CollectPaymentOptions {
  order: Order
  /** Shown instead of Razorpay when no gateway keys are configured. Resolve true to simulate success. */
  onMockPayment: (amount: number) => Promise<boolean>
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Razorpay. Check your connection.'))
    document.body.appendChild(script)
  })
}

export async function collectPayment({ order, onMockPayment }: CollectPaymentOptions): Promise<PaymentOutcome> {
  const created = await callApi<CreateOrderResponse>('/api/payments/create-order', { orderId: order.id })
  const amount = amountDueNow(order)

  if (!created.available || created.data.mode === 'mock') {
    const approved = await onMockPayment(amount)
    if (!approved) return { status: 'dismissed' }
    const ref = `mock_pay_${Date.now()}`
    if (!isSupabaseConfigured) await markMockOrderPaid(order.id, ref)
    else if (created.available) await callApi('/api/payments/verify', { orderId: order.id, mock: true })
    return { status: 'paid', ref }
  }

  const live = created.data
  await loadCheckoutScript()

  return new Promise<PaymentOutcome>((resolve) => {
    const rzp = new window.Razorpay!({
      key: live.keyId,
      order_id: live.razorpayOrderId,
      amount: live.amount,
      currency: live.currency,
      name: SITE.name,
      description:
        order.payment_mode === 'PARTIAL_COD' ? `Advance to reserve ${order.order_number}` : `Payment for ${order.order_number}`,
      prefill: { name: order.customer_name, contact: order.customer_phone },
      notes: { order_number: order.order_number },
      theme: { color: '#4A0E17' },
      config: { display: { preferences: { show_default_blocks: true } } },
      handler: async (resp: RazorpaySuccess) => {
        try {
          await callApi('/api/payments/verify', { orderId: order.id, ...resp })
          resolve({ status: 'paid', ref: resp.razorpay_payment_id })
        } catch (err) {
          resolve({ status: 'failed', reason: err instanceof Error ? err.message : 'Verification failed' })
        }
      },
      modal: { ondismiss: () => resolve({ status: 'dismissed' }) },
    })
    rzp.on('payment.failed', (resp) => resolve({ status: 'failed', reason: resp.error.description }))
    rzp.open()
  })
}
