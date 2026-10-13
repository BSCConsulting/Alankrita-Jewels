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

export const PAYMENT_RULES = {
  prepaidDiscountRate: 0.05,
  partialCodAdvance: 150,
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
