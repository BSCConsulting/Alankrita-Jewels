// Google Merchant Center product feed (RSS 2.0 + g: namespace), served at /feed.xml for free Shopping listings.
// Spec: https://support.google.com/merchants/answer/7052112
import { SITE } from '../config/site'

export interface FeedProduct {
  id: string
  title: string
  slug: string
  description: string | null
  mrp: number
  sale_price: number
  in_stock: boolean
  stock_count: number
  plating_type: string | null
  category: { name: string } | null
  media: Array<{ url: string; media_type: string; display_order: number; is_thumbnail?: boolean }>
}

/** Google's "Apparel & Accessories > Jewelry" taxonomy id. */
const GOOGLE_JEWELRY_CATEGORY = '188'
const MAX_ADDITIONAL_IMAGES = 10

const xml = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const inr = (n: number) => `${Number(n).toFixed(2)} INR`

function imagesOf(p: FeedProduct, siteUrl: string): string[] {
  return p.media
    .filter((m) => m.media_type === 'image')
    .sort((a, b) => Number(b.is_thumbnail ?? false) - Number(a.is_thumbnail ?? false) || a.display_order - b.display_order)
    .map((m) => (m.url.startsWith('http') ? m.url : `${siteUrl}${m.url}`))
}

/** Products without an image are left out: Merchant Center rejects them. */
export function buildMerchantFeed(products: FeedProduct[], siteUrl: string): string {
  const items = products
    .map((p) => ({ p, images: imagesOf(p, siteUrl) }))
    .filter(({ images }) => images.length > 0)
    .map(({ p, images }) => {
      const mrp = Number(p.mrp)
      const sale = Number(p.sale_price)
      const tags: Array<[string, string]> = [
        ['g:id', p.id],
        ['g:title', p.title.slice(0, 150)],
        ['g:description', (p.description?.trim() || `${p.title} by ${SITE.name}`).slice(0, 5000)],
        ['g:link', `${siteUrl}/product/${p.slug}`],
        ['g:image_link', images[0]],
        ...images.slice(1, 1 + MAX_ADDITIONAL_IMAGES).map((url): [string, string] => ['g:additional_image_link', url]),
        ['g:availability', p.in_stock && p.stock_count > 0 ? 'in_stock' : 'out_of_stock'],
        ['g:price', inr(Math.max(mrp, sale))],
        ...(sale < mrp ? [['g:sale_price', inr(sale)] as [string, string]] : []),
        ['g:condition', 'new'],
        ['g:brand', SITE.name],
        ['g:identifier_exists', 'no'],
        ['g:google_product_category', GOOGLE_JEWELRY_CATEGORY],
        ...(p.category ? [['g:product_type', p.category.name] as [string, string]] : []),
        ...(p.plating_type ? [['g:material', p.plating_type.slice(0, 200)] as [string, string]] : []),
        ['g:gender', 'female'],
        ['g:age_group', 'adult'],
      ]
      const shipping = '<g:shipping><g:country>IN</g:country><g:price>0.00 INR</g:price></g:shipping>'
      return `    <item>\n${tags.map(([k, v]) => `      <${k}>${xml(v)}</${k}>`).join('\n')}\n      ${shipping}\n    </item>`
    })

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(SITE.name)}</title>
    <link>${xml(siteUrl)}</link>
    <description>${xml(`${SITE.name} — ${SITE.tagline}`)}</description>
${items.join('\n')}
  </channel>
</rss>
`
}
