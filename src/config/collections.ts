import type { Category, JewelleryType, ThemeVariant } from '@/types'
import { COLLECTION_SLUGS } from './site'

export const THEME_BY_JEWELLERY_TYPE: Record<JewelleryType, ThemeVariant> = {
  '1-gram-gold': 'heritage',
  'nakshi-temple': 'heritage',
  'american-diamond': 'heritage',
  'anti-tarnish': 'modern',
  korean: 'modern',
}

export const JEWELLERY_TYPE_LABEL: Record<JewelleryType, string> = {
  '1-gram-gold': '1 Gram Gold',
  'nakshi-temple': 'Nakshi Temple',
  'american-diamond': 'American Diamond / CZ',
  'anti-tarnish': 'Anti-Tarnish (PVD)',
  korean: 'Korean Fashion',
}

/** Parent slug segment used in nested URLs, e.g. /collections/1-gram-gold/choker-sets */
const shortSlug = (slug: string) => slug.replace(/-jewellery$/, '')

export function categoryPath(category: Pick<Category, 'slug' | 'parent_id'>, all: Category[]): string {
  const parent = category.parent_id ? all.find((c) => c.id === category.parent_id) : undefined
  return parent ? `/collections/${shortSlug(parent.slug)}/${category.slug}` : `/collections/${category.slug}`
}

interface CollectionContent {
  seoTitle: string
  seoDescription: string
  eyebrow: string
  intro: string
  seoCopy: string[]
}

export const COLLECTION_CONTENT: Record<string, CollectionContent> = {
  [COLLECTION_SLUGS.oneGramGold]: {
    seoTitle: '1 Gram Gold Jewellery Online | Temple, Kempu & Bridal Sets — Hyderabad, Vijayawada',
    seoDescription:
      'Shop 1 gram gold jewellery online — Nakshi temple sets, Vaddanams, Nallapusalu, Kempu chokers and bangles with a 1-year re-polishing guarantee. 2–3 day delivery in AP & Telangana.',
    eyebrow: 'The Heritage Vault',
    intro: 'Prestige, auspiciousness and the authentic look of 22K gold — without the exorbitant cost.',
    seoCopy: [
      'Our 1 gram gold jewellery is micro gold plated over a skin-friendly copper-brass alloy and sealed with anti-tarnish lacquer, giving you the warm glow of 22-carat gold for weddings, Sankranti, Varalakshmi Vratham and every family function.',
      'Every piece ships insured from our Hyderabad studio within 24 hours, reaching Vijayawada, Visakhapatnam, Guntur, Warangal and Tirupati in 2–3 business days.',
    ],
  },
  [COLLECTION_SLUGS.antiTarnish]: {
    seoTitle: 'Anti-Tarnish Waterproof Jewellery | PVD 316L Stainless Steel — Alankrita Jewels',
    seoDescription:
      'Waterproof, sweat-proof and hypoallergenic anti-tarnish jewellery in PVD-coated 316L stainless steel. Everyday chains, huggies and bracelets that never fade. Fast delivery in Hyderabad & AP.',
    eyebrow: 'The Modern Studio',
    intro: 'Durability, waterproof & hypoallergenic materials, and everyday confidence with Tollywood and K-trend aesthetics.',
    seoCopy: [
      'PVD (Physical Vapour Deposition) bonds 18K gold tone to 316L surgical stainless steel at a molecular level, so your jewellery survives showers, gym sessions and humid Vizag summers without turning green or dull.',
      'Nickel-free and hypoallergenic — made for sensitive skin and for women who never take their jewellery off.',
    ],
  },
  [COLLECTION_SLUGS.americanDiamond]: {
    seoTitle: 'American Diamond & CZ Necklace Sets | AAA Swiss CZ Bridal Jewellery',
    seoDescription:
      'AAA grade Swiss CZ and American diamond necklace sets, rings and bridal jewellery with real-diamond sparkle. Rhodium and rose gold finishes. Delivery across Andhra Pradesh & Telangana.',
    eyebrow: 'Brilliance Edit',
    intro: 'AAA grade Swiss cubic zirconia, hand-set for real-diamond fire at receptions and engagements.',
    seoCopy: [
      'Each stone is AAA graded for clarity and cut, then set in rhodium or rose gold plating that resists scratches and discolouration.',
    ],
  },
  [COLLECTION_SLUGS.korean]: {
    seoTitle: 'Korean Fashion Earrings & Accessories | Dainty K-Trend Jewellery',
    seoDescription:
      'Korean fashion earrings, pearl drops, dainty pendants and K-trend accessories for college and office. Nickel-free, lightweight and delivered fast across Hyderabad, Vijayawada and Vizag.',
    eyebrow: 'The Modern Studio',
    intro: 'Featherlight K-trend pieces for college corridors, office desks and cafe weekends.',
    seoCopy: [
      'Lightweight, nickel-free and anti-tarnish coated — our Korean collection is curated weekly from the latest Seoul and Tollywood street-style trends.',
    ],
  },
  [COLLECTION_SLUGS.vaddanam]: {
    seoTitle: '1 Gram Gold Vaddanam & Hip Belts Online | Nakshi & Kempu Vaddanam',
    seoDescription:
      'Buy 1 gram gold vaddanam and hip belts online — Lakshmi Nakshi, peacock Kempu and bridal vaddanams in sizes 26–40 inches. 1-year re-polishing guarantee, 2–3 day AP & Telangana delivery.',
    eyebrow: 'Heritage Vault · Vaddanam',
    intro: 'Waist belts crafted to sit flat on Kanchi and Gadwal silk, sized for every drape.',
    seoCopy: [
      'Not sure of your size? Measure your waist over the saree pleats and WhatsApp us — our stylists will confirm the fit before dispatch.',
    ],
  },
  [COLLECTION_SLUGS.nallapusalu]: {
    seoTitle: 'Nallapusalu Black Beads Chains Online | 1 Gram Gold Nallapusalu',
    seoDescription:
      'Traditional 1 gram gold nallapusalu and black bead chains with Lakshmi kasulu and gold beads. Daily-wear friendly with re-polishing guarantee. Fast delivery in AP & Telangana.',
    eyebrow: 'Heritage Vault · Nallapusalu',
    intro: 'The auspicious black-bead chain, reimagined for everyday wear.',
    seoCopy: ['Glossy black beads strung on durable wire with micro gold plated spacers — designed to be worn daily.'],
  },
  [COLLECTION_SLUGS.chokers]: {
    seoTitle: '1 Gram Gold Choker Sets with Jhumkas | Bridal Kempu & Nakshi Chokers',
    seoDescription:
      'Bridal and festive 1 gram gold choker sets with matching jhumkas — Nakshi temple, Kempu and emerald designs. Adjustable fit, insured delivery across Andhra Pradesh & Telangana.',
    eyebrow: 'Heritage Vault · Chokers',
    intro: 'Statement chokers with matching jhumkas for Pellikuthuru, reception and festive looks.',
    seoCopy: ['Every choker comes with an adjustable dori so it sits perfectly with boat-neck, round and high-neck blouses.'],
  },
}
