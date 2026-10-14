// GET /api/payments/config → { mode: 'live' | 'mock' | 'offline' }
// Lets checkout word its button and notes correctly before an order is placed.
import type { Env } from '../../_lib/env'
import { json } from '../../_lib/http'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const live = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)
  return json({ mode: live ? 'live' : env.ALLOW_MOCK_PAYMENTS === 'true' ? 'mock' : 'offline' })
}
