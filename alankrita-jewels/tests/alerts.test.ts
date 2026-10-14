import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alertNewOrder, alertServerError, sendAlert } from '../functions/_lib/alerts'
import type { Env } from '../functions/_lib/env'
import type { OrderRow } from '../functions/_lib/supabase'

const env = { TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_CHAT_ID: '42' } as Env

const order: OrderRow = {
  id: 'order-1',
  order_number: 'AK-1001',
  user_id: 'u1',
  customer_name: 'Sita <script>',
  customer_phone: '+919000000000',
  shipping_address: { address_line: '1-2', city: 'Madhira', state: 'Telangana', pincode: '507203' },
  final_amount: 2500,
  payment_mode: 'PARTIAL_COD',
  balance_due_on_delivery: 2350,
  advance_paid: 0,
  payment_status: 'PENDING',
  order_status: 'PLACED',
  payment_gateway_ref: null,
  items: [{ id: 'i1', product_id: 'p1', product_title: 'Jhumka & Studs', quantity: 2, unit_price: 1250 }],
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const sentText = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body as string).text as string

describe('alerts', () => {
  it('does nothing until both Telegram secrets are set', async () => {
    await sendAlert({ TELEGRAM_BOT_TOKEN: 'x' } as Env, 'hi')
    await alertNewOrder({} as Env, order, 'https://shop')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends a new-order summary with escaped customer text', async () => {
    await alertNewOrder(env, order, 'https://shop')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.telegram.org/botbot-token/sendMessage')
    const text = sentText()
    expect(text).toContain('New order AK-1001')
    expect(text).toContain('Sita &lt;script&gt;')
    expect(text).toContain('Jhumka &amp; Studs × 2')
    expect(text).toContain('awaiting ₹150')
    expect(text).toContain('https://shop/admin/orders')
  })

  it('never throws when Telegram is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sendAlert(env, 'hi')).resolves.toEqual({ ok: false, reason: 'Telegram could not be reached' })
    spy.mockRestore()
  })

  it('passes on Telegram\'s reason when it rejects the message', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"ok":false,"description":"Bad Request: chat not found"}', { status: 400 }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sendAlert(env, 'hi')).resolves.toEqual({ ok: false, reason: 'Bad Request: chat not found' })
    spy.mockRestore()
  })

  it('rate-limits repeated server-error alerts for the same endpoint', async () => {
    await alertServerError(env, 'POST', '/api/test-throttle', new Error('boom'))
    await alertServerError(env, 'POST', '/api/test-throttle', new Error('boom again'))
    await alertServerError(env, 'POST', '/api/other-endpoint', new Error('boom'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentText(0)).toContain('POST /api/test-throttle')
  })
})
