export interface Env {
  ASSETS: Fetcher
  SITE_URL?: string

  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string

  RAZORPAY_KEY_ID?: string
  RAZORPAY_KEY_SECRET?: string
  RAZORPAY_WEBHOOK_SECRET?: string
  ALLOW_MOCK_PAYMENTS?: string

  SHIPROCKET_TOKEN?: string
  SHIPROCKET_PICKUP_LOCATION?: string
  SHIPROCKET_BILLING_EMAIL?: string

  DELHIVERY_TOKEN?: string
  DELHIVERY_BASE_URL?: string
  DELHIVERY_PICKUP_NAME?: string

  WHATSAPP_TOKEN?: string
  WHATSAPP_PHONE_NUMBER_ID?: string
  WHATSAPP_TRACKING_TEMPLATE?: string
}

export const siteUrl = (env: Env, request: Request) => (env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, '')
