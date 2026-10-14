import { Link } from 'react-router'
import { ArrowRight, Crown, Sparkles } from 'lucide-react'
import { CollectionTiles } from '@/components/home/CollectionTiles'
import { Hero } from '@/components/home/Hero'
import { ReelStrip } from '@/components/home/ReelStrip'
import { REVIEWS, Testimonials } from '@/components/home/Testimonials'
import { TrustBar } from '@/components/home/TrustBar'
import { ProductGrid } from '@/components/product/ProductGrid'
import { JsonLd } from '@/components/seo/JsonLd'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { THEME_BY_JEWELLERY_TYPE } from '@/config/collections'
import { SITE } from '@/config/site'
import { useAsync } from '@/hooks/useAsync'
import { storeJsonLd } from '@/lib/jsonld'
import { SITE_URL, useSeo } from '@/lib/seo'
import { fetchProducts } from '@/services/catalog'
import { useActiveTheme, useThemeStore } from '@/stores/useThemeStore'
import { THEMES } from '@/theme/themes'
import type { JewelleryType } from '@/types'

export default function HomePage() {
  const theme = useActiveTheme()
  const setOverride = useThemeStore((s) => s.setOverride)
  const other = theme === 'heritage' ? 'modern' : 'heritage'
  const types = (Object.keys(THEME_BY_JEWELLERY_TYPE) as JewelleryType[]).filter((t) => THEME_BY_JEWELLERY_TYPE[t] === theme)

  const featured = useAsync(() => fetchProducts({ jewelleryTypes: types, limit: 8 }), [theme])
  const reels = useAsync(() => fetchProducts({ featured: true }), [])

  useSeo({
    title: `${SITE.name} | 1 Gram Gold, Vaddanam & Anti-Tarnish Jewellery — Hyderabad, Vijayawada, Vizag`,
    description:
      'Shop 1 gram gold, Nakshi temple, Vaddanam, Nallapusalu, American diamond and waterproof anti-tarnish jewellery. Extra 5% off on UPI, Partial COD, 2–3 day delivery across Andhra Pradesh & Telangana.',
    path: '/',
  })

  return (
    <>
      <JsonLd data={storeJsonLd(SITE_URL)} />
      <Hero />
      <TrustBar />

      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <SectionHeading eyebrow="Shop by collection" title="Find your alankaram" telugu="మీకు నచ్చిన ఆభరణాన్ని ఎంచుకోండి" />
        <CollectionTiles />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <SectionHeading
          eyebrow={THEMES[theme].name}
          title={THEMES[theme].featuredTitle}
          action={
            <Link to={THEMES[theme].hero.primaryCta.to} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          }
        />
        <ProductGrid products={featured.data} loading={featured.loading} error={featured.error} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <SectionHeading eyebrow="Watch before you buy" title="5-second sparkle reels" telugu="కొనే ముందు మెరుపును చూడండి" />
        <ReelStrip products={reels.data ?? []} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div
          className={
            other === 'modern'
              ? 'relative overflow-hidden rounded-3xl bg-gradient-to-r from-modern-champagne to-modern-rose/60 p-8 text-modern-charcoal sm:p-12'
              : 'relative overflow-hidden rounded-md bg-gradient-to-r from-heritage-maroon to-[#6b1622] p-8 text-heritage-ivory sm:p-12'
          }
        >
          <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-70">Also at Alankrita</p>
          <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">{THEMES[other].name}</p>
          <p className="mt-3 max-w-xl opacity-85">{THEMES[other].hero.valueProp}</p>
          <button
            onClick={() => {
              setOverride(other)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className={
              other === 'modern'
                ? 'mt-6 inline-flex items-center gap-2 rounded-full bg-modern-charcoal px-6 py-3 text-sm font-semibold text-white'
                : 'mt-6 inline-flex items-center gap-2 rounded-md bg-heritage-gold px-6 py-3 text-sm font-semibold text-heritage-maroon'
            }
          >
            {other === 'modern' ? <Sparkles className="size-4" /> : <Crown className="size-4" />} {THEMES[other].switchLabel}
          </button>
        </div>
      </section>

      {REVIEWS.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <SectionHeading eyebrow="Love from AP & Telangana" title="Worn at every celebration" />
          <Testimonials />
        </section>
      )}
    </>
  )
}
