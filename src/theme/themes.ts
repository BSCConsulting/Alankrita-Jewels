import { COLLECTION_SLUGS } from '@/config/site'
import type { ThemeVariant } from '@/types'

export interface ThemeContent {
  name: string
  switchLabel: string
  metaColor: string
  hero: {
    eyebrow: string
    title: string
    teluguLine: string
    valueProp: string
    primaryCta: { label: string; to: string }
    secondaryCta: { label: string; to: string }
    chips: string[]
    image: string
    floatingNote: { title: string; body: string }
  }
  featuredTitle: string
}

export const THEMES: Record<ThemeVariant, ThemeContent> = {
  heritage: {
    name: 'The Heritage Vault',
    switchLabel: 'Switch to Heritage Vault',
    metaColor: '#4A0E17',
    hero: {
      eyebrow: '1 Gram Gold · Nakshi Temple · Kempu',
      title: 'The Heritage Vault',
      teluguLine: 'ప్రతి వేడుకకు మీ నిజమైన అలంకరణ',
      valueProp: 'Prestige, auspiciousness, and the authentic look of 22K gold — without the exorbitant cost.',
      primaryCta: { label: 'Shop 1 Gram Gold', to: `/collections/${COLLECTION_SLUGS.oneGramGold}` },
      secondaryCta: { label: 'Bridal Vaddanams', to: `/collections/1-gram-gold/${COLLECTION_SLUGS.vaddanam}` },
      chips: ['Vaddanams', 'Nallapusalu', 'Kempu Chokers', 'Temple Jhumkas'],
      image: '/placeholders/nakshi-lakshmi-choker-set-jhumkas-1.svg',
      floatingNote: { title: '1-Year Re-polishing', body: 'Guaranteed 22K-like glow' },
    },
    featuredTitle: 'Auspicious Bestsellers',
  },
  modern: {
    name: 'The Modern Studio',
    switchLabel: 'Switch to Modern Studio',
    metaColor: '#F5EBE1',
    hero: {
      eyebrow: 'Anti-Tarnish · Waterproof PVD · K-Trend',
      title: 'The Modern Studio',
      teluguLine: 'రోజువారీ ఆత్మవిశ్వాసానికి మెరిసే ఆభరణాలు',
      valueProp: 'Durability, waterproof & hypoallergenic materials, everyday confidence — with Tollywood & K-trend aesthetics.',
      primaryCta: { label: 'Shop Anti-Tarnish', to: `/collections/${COLLECTION_SLUGS.antiTarnish}` },
      secondaryCta: { label: 'Korean Earrings', to: `/collections/${COLLECTION_SLUGS.korean}` },
      chips: ['Shower-proof', 'Sweat-proof', 'Nickel-free', 'Office-ready'],
      image: '/placeholders/waterproof-pvd-gold-paperclip-chain-1.svg',
      floatingNote: { title: 'PVD 316L Steel', body: 'Waterproof · Hypoallergenic' },
    },
    featuredTitle: 'Everyday Icons',
  },
}
