// Kept free of browser/Vite globals: also imported by Cloudflare Pages Functions.
export const SITE = {
  name: 'Alankrita Jewels',
  teluguName: 'అలంకృత జ్యువెలర్స్',
  tagline: 'Heritage Meets Everyday Elegance',
  teluguTagline: 'ప్రతి వేడుకకు మీ నిజమైన అలంకరణ',
  phoneDisplay: '+91 90326 54111',
  phoneE164: '+919032654111',
  whatsappNumber: '919032654111',
  supportHours: '10 AM – 8 PM, all days',
  defaultUrl: 'https://alankritajewels.in',
  serviceCities: ['Hyderabad', 'Vijayawada', 'Visakhapatnam', 'Guntur', 'Warangal', 'Tirupati', 'Nellore', 'Kakinada'],
} as const

/** Seller details shown on the Contact and policy pages (Consumer Protection (E-Commerce) Rules, 2020). Empty fields are hidden. */
export const BUSINESS: { legalName: string; address: string; gstin: string; email: string; grievanceOfficer: string } = {
  legalName: 'Alankrita Jewels',
  address: '',
  gstin: '36ABAFB0544P1ZE',
  email: 'bsc.consulting123@gmail.com',
  grievanceOfficer: 'Lakshmi · +91 90326 54111',
}

export const PAYMENT_RULES = {
  prepaidDiscountRate: 0.05,
  partialCodAdvance: 150,
  /** Matches the cancel-stale-orders cron in supabase/migrations/003_auto_cancel_unpaid_orders.sql. */
  unpaidHoldHours: 48,
} as const

/** Category slugs with hand-tuned landing pages. */
export const COLLECTION_SLUGS = {
  oneGramGold: '1-gram-gold-jewellery',
  antiTarnish: 'anti-tarnish-waterproof-jewellery',
  americanDiamond: 'american-diamond-cz-sets',
  korean: 'korean-fashion-accessories',
  vaddanam: 'vaddanam-hip-belts',
  nallapusalu: 'nallapusalu-black-beads',
  chokers: 'choker-sets',
} as const
