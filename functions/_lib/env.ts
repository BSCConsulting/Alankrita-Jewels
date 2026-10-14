export interface Env {
  ASSETS: Fetcher
  SITE_URL?: string

  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  /** Legacy JWT secret (Supabase → Project Settings → JWT Keys). Signs customer sessions after Firebase phone OTP. */
  SUPABASE_JWT_SECRET?: string

  FIREBASE_PROJECT_ID?: string

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

  /** Store-owner alerts (new orders, refunds needed, server errors). Bot from @BotFather; chat id of the owner or a group. */
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
}

export const siteUrl = (env: Env, request: Request) => (env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, '')
