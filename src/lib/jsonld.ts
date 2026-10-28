// Pure schema.org builders — shared by the SPA and the Pages Function that pre-renders product meta.
import { BUSINESS, BUSINESS_ADDRESS, SITE } from '../config/site'

export interface JsonLdProductInput {
  id: string
  title: string
  telugu_title?: string | null
  slug: string
  description: string | null
  mrp: number
  sale_price: number
  in_stock: boolean
  stock_count: number
  plating_type: string | null
  warranty_details: string | null
  imageUrls: string[]
  categoryName?: string | null
  /** Approved reviews shown on the page; Google only accepts ratings that visitors can see. */
  reviews?: Array<{ rating: number; body: string; display_name: string; created_at: string }>
}

const absolute = (siteUrl: string, url: string) => (url.startsWith('http') ? url : `${siteUrl}${url}`)

export function productJsonLd(p: JsonLdProductInput, siteUrl: string) {
  const url = `${siteUrl}/product/${p.slug}`
  const priceValidUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString().slice(0, 10)

  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.title,
    alternateName: p.telugu_title ?? undefined,
    description: p.description ?? undefined,
    image: p.imageUrls.map((u) => absolute(siteUrl, u)),
    sku: p.id,
    category: p.categoryName ?? undefined,
    material: p.plating_type ?? undefined,
    brand: { '@type': 'Brand', name: SITE.name },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'INR',
      price: p.sale_price.toFixed(2),
      priceValidUntil,
      itemCondition: 'https://schema.org/NewCondition',
      availability: p.in_stock && p.stock_count > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: SITE.name },
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        priceType: 'https://schema.org/ListPrice',
        price: p.mrp.toFixed(2),
        priceCurrency: 'INR',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'INR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 7, unitCode: 'DAY' },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 2,
        // Change-of-mind returns are not accepted; only items that arrive damaged or incorrect.
        itemCondition: 'https://schema.org/DamagedCondition',
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
    additionalProperty: p.warranty_details
      ? [{ '@type': 'PropertyValue', name: 'Warranty', value: p.warranty_details }]
      : undefined,
    ...reviewJsonLd(p.reviews ?? []),
  }
}

function reviewJsonLd(reviews: NonNullable<JsonLdProductInput['reviews']>) {
  if (!reviews.length) return {}
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: average.toFixed(1),
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      author: { '@type': 'Person', name: r.display_name.split(',')[0] },
      datePublished: r.created_at.slice(0, 10),
      reviewBody: r.body,
    })),
  }
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>, siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  }
}

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`

export function storeJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'JewelryStore',
        '@id': `${siteUrl}/#store`,
        name: SITE.name,
        alternateName: SITE.teluguName,
        legalName: BUSINESS.legalName,
        slogan: SITE.tagline,
        url: siteUrl,
        logo: `${siteUrl}/favicon.svg`,
        image: `${siteUrl}/og-image.jpg`,
        telephone: SITE.phoneE164,
        email: BUSINESS.email || undefined,
        vatID: BUSINESS.gstin || undefined,
        priceRange: '₹₹',
        areaServed: SITE.serviceCities.map((city) => ({ '@type': 'City', name: city })),
        address: {
          '@type': 'PostalAddress',
          streetAddress: BUSINESS_ADDRESS.street,
          addressLocality: BUSINESS_ADDRESS.locality,
          addressRegion: BUSINESS_ADDRESS.region,
          postalCode: BUSINESS_ADDRESS.postalCode,
          addressCountry: 'IN',
        },
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: pad(SITE.supportOpenHour),
          closes: pad(SITE.supportCloseHour),
        },
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: SITE.phoneE164,
          email: BUSINESS.email || undefined,
          contactType: 'customer support',
          availableLanguage: ['English', 'Telugu'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: SITE.name,
        alternateName: SITE.teluguName,
        url: siteUrl,
        inLanguage: ['en-IN', 'te-IN'],
        publisher: { '@id': `${siteUrl}/#store` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}
