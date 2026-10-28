import { describe, expect, it } from 'vitest'
import { buildMerchantFeed, type FeedProduct } from '../src/lib/merchantFeed'

const base: FeedProduct = {
  id: 'p1',
  title: 'Kempu & Emerald <Bridal> Choker',
  slug: 'kempu-choker',
  description: 'Antique finish',
  mrp: 4499,
  sale_price: 2799,
  in_stock: true,
  stock_count: 3,
  plating_type: 'Micro Gold Plated',
  category: { name: 'Choker Sets' },
  media: [
    { url: '/products/b.webp', media_type: 'image', display_order: 1 },
    { url: 'https://cdn.example/a.webp', media_type: 'image', display_order: 0, is_thumbnail: true },
    { url: '/products/r.mp4', media_type: 'video_reel', display_order: 2 },
  ],
}

const itemOf = (feed: string) => feed.slice(feed.indexOf('<item>'), feed.indexOf('</item>'))

describe('buildMerchantFeed', () => {
  const feed = buildMerchantFeed([base], 'https://shop.example')
  const item = itemOf(feed)

  it('is an RSS 2.0 feed in the Google namespace', () => {
    expect(feed).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0" xmlns:g="http:\/\/base.google.com\/ns\/1.0">/)
  })

  it('lists MRP as the price and the selling price as sale_price', () => {
    expect(item).toContain('<g:price>4499.00 INR</g:price>')
    expect(item).toContain('<g:sale_price>2799.00 INR</g:sale_price>')
  })

  it('uses the thumbnail first, makes URLs absolute and skips videos', () => {
    expect(item).toContain('<g:image_link>https://cdn.example/a.webp</g:image_link>')
    expect(item).toContain('<g:additional_image_link>https://shop.example/products/b.webp</g:additional_image_link>')
    expect(item).not.toContain('r.mp4')
  })

  it('escapes XML special characters', () => {
    expect(item).toContain('<g:title>Kempu &amp; Emerald &lt;Bridal&gt; Choker</g:title>')
  })

  it('declares free shipping in India and no GTIN', () => {
    expect(item).toContain('<g:shipping><g:country>IN</g:country><g:price>0.00 INR</g:price></g:shipping>')
    expect(item).toContain('<g:identifier_exists>no</g:identifier_exists>')
    expect(item).toContain('<g:link>https://shop.example/product/kempu-choker</g:link>')
  })

  it('marks sold-out products and omits sale_price when there is no discount', () => {
    const sold = itemOf(buildMerchantFeed([{ ...base, stock_count: 0, sale_price: 4499 }], 'https://shop.example'))
    expect(sold).toContain('<g:availability>out_of_stock</g:availability>')
    expect(sold).not.toContain('g:sale_price')
  })

  it('leaves out products without images', () => {
    expect(buildMerchantFeed([{ ...base, media: [] }], 'https://shop.example')).not.toContain('<item>')
  })
})
