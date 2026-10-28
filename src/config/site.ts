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
  /** Same window as supportHours, in 24h IST, for the chat "online" indicator. */
  supportOpenHour: 10,
  supportCloseHour: 20,
  defaultUrl: 'https://alankritajewels.in',
  serviceCities: ['Hyderabad', 'Vijayawada', 'Visakhapatnam', 'Guntur', 'Warangal', 'Tirupati', 'Nellore', 'Kakinada'],
} as const

/** Registered address, structured for schema.org; BUSINESS.address is the display form. */
export const BUSINESS_ADDRESS = {
  street: '12-381, Sundarayya Nagar',
  locality: 'Madhira',
  district: 'Khammam',
  region: 'Telangana',
  postalCode: '507203',
} as const

/** Seller details shown on the Contact and policy pages (Consumer Protection (E-Commerce) Rules, 2020). Empty fields are hidden. */
export const BUSINESS: { legalName: string; address: string; gstin: string; email: string; grievanceOfficer: string } = {
  legalName: 'Alankrita Jewels, a vertical of BSC Consulting',
  address: `${BUSINESS_ADDRESS.street}, ${BUSINESS_ADDRESS.locality}, ${BUSINESS_ADDRESS.district} (Dt), ${BUSINESS_ADDRESS.region} – ${BUSINESS_ADDRESS.postalCode}`,
  gstin: '36ABAFB0544P1ZE',
  email: 'bsc.consulting123@gmail.com',
  grievanceOfficer: 'Lakshmi · +91 90326 54111',
}

// Every value in PAYMENT_RULES and OFFER_RULES is enforced by public.place_order() in
// supabase/migrations/005_growth_features.sql; tests/pricingParity.test.ts fails if the two drift apart.
export const PAYMENT_RULES = {
  prepaidDiscountRate: 0.05,
  partialCodAdvance: 150,
  /** Matches the cancel-stale-orders cron in supabase/migrations/003_auto_cancel_unpaid_orders.sql. */
  unpaidHoldHours: 48,
  /** Full cash on delivery: handling fee, largest amount a courier collects, and open COD orders per customer. */
  codFee: 49,
  codMaxAmount: 5999,
  maxOpenCodOrders: 2,
} as const

export const OFFER_RULES = {
  /** Automatic cart-value savings; the highest tier reached applies. */
  tiers: [
    { minSubtotal: 2499, discount: 150 },
    { minSubtotal: 4999, discount: 350 },
    { minSubtotal: 9999, discount: 800 },
  ],
  /** Bridal set saving: distinct traditional pieces in one order. The highest step reached applies. */
  bundleTypes: ['1-gram-gold', 'nakshi-temple', 'american-diamond'],
  bundleSteps: [
    { minPieces: 3, rate: 0.07 },
    { minPieces: 5, rate: 0.12 },
  ],
  freeGiftMinSubtotal: 3999,
  freeGift: 'Velvet jewellery pouch',
  giftWrapFee: 49,
  giftMessageMaxLength: 200,
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
