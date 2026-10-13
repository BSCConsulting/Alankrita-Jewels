// Pure schema.org builders — shared by the SPA and the Pages Function that pre-renders product meta.
import { SITE } from '../config/site'

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
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
    additionalProperty: p.warranty_details
      ? [{ '@type': 'PropertyValue', name: 'Warranty', value: p.warranty_details }]
      : undefined,
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

export function storeJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'JewelryStore',
    name: SITE.name,
    alternateName: SITE.teluguName,
    slogan: SITE.tagline,
    url: siteUrl,
    telephone: SITE.phoneE164,
    priceRange: '₹₹',
    areaServed: SITE.serviceCities.map((city) => ({ '@type': 'City', name: city })),
    address: { '@type': 'PostalAddress', addressLocality: 'Hyderabad', addressRegion: 'Telangana', addressCountry: 'IN' },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: SITE.phoneE164,
      contactType: 'customer support',
      availableLanguage: ['English', 'Telugu'],
    },
  }
}
