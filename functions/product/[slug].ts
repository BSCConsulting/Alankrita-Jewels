// GET /product/:slug — serves the SPA shell with product-specific <title>, meta, Open Graph and
// JSON-LD injected at the edge, so Google Rich Results and WhatsApp link previews work without JS.
import { breadcrumbJsonLd, productJsonLd } from '../../src/lib/jsonld'
import { SITE } from '../../src/config/site'
import { siteUrl, type Env } from '../_lib/env'
import { escapeHtml } from '../_lib/http'
import { hasSupabase, rest } from '../_lib/supabase'

interface ProductSeoRow {
  id: string
  title: string
  telugu_title: string | null
  slug: string
  description: string | null
  mrp: number
  sale_price: number
  in_stock: boolean
  stock_count: number
  plating_type: string | null
  warranty_details: string | null
  category: { name: string } | null
  media: Array<{ url: string; media_type: string; display_order: number }>
}

export const onRequestGet: PagesFunction<Env, 'slug'> = async ({ request, env, params }) => {
  const shell = await env.ASSETS.fetch(new Request(new URL('/', request.url), request))
  if (!hasSupabase(env)) return shell

  const slug = String(params.slug)
  let product: ProductSeoRow | undefined
  try {
    ;[product] = await rest<ProductSeoRow[]>(
      env,
      `products?slug=eq.${encodeURIComponent(slug)}&select=id,title,telugu_title,slug,description,mrp,sale_price,in_stock,stock_count,plating_type,warranty_details,category:categories(name),media:product_media(url,media_type,display_order)`,
    )
  } catch (err) {
    console.error('SEO product lookup failed', err)
    return shell
  }

  if (!product) return new Response(shell.body, { status: 404, headers: shell.headers })

  const base = siteUrl(env, request)
  const images = product.media
    .filter((m) => m.media_type === 'image')
    .sort((a, b) => a.display_order - b.display_order)
    .map((m) => (m.url.startsWith('http') ? m.url : `${base}${m.url}`))
  const price = Number(product.sale_price)
  const title = `${product.title} — ₹${price.toLocaleString('en-IN')} | ${SITE.name}`
  const description = (product.description ?? `${product.title} by ${SITE.name}`).slice(0, 158)
  const url = `${base}/product/${product.slug}`

  const ld = [
    productJsonLd(
      { ...product, mrp: Number(product.mrp), sale_price: price, imageUrls: images, categoryName: product.category?.name },
      base,
    ),
    breadcrumbJsonLd(
      [
        { name: 'Home', path: '/' },
        { name: product.title, path: `/product/${product.slug}` },
      ],
      base,
    ),
  ]
  const ldScript = ld.map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`).join('')
  const meta = (attr: string, key: string, value: string) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`

  const rewritten = new HTMLRewriter()
    .on('title', {
      element: (el) => {
        el.setInnerContent(title)
      },
    })
    .on('meta[name="description"]', {
      element: (el) => {
        el.setAttribute('content', description)
      },
    })
    .on('meta[property="og:type"]', {
      element: (el) => {
        el.setAttribute('content', 'product')
      },
    })
    .on('head', {
      element: (el) => {
        el.append(
          [
            `<link rel="canonical" href="${escapeHtml(url)}" />`,
            meta('property', 'og:title', title),
            meta('property', 'og:description', description),
            meta('property', 'og:url', url),
            images[0] ? meta('property', 'og:image', images[0]) : '',
            meta('property', 'product:price:amount', String(price)),
            meta('property', 'product:price:currency', 'INR'),
            meta('name', 'twitter:card', 'summary_large_image'),
            ldScript,
          ].join(''),
          { html: true },
        )
      },
    })
    .transform(shell)

  const headers = new Headers(rewritten.headers)
  headers.set('cache-control', 'public, max-age=0, s-maxage=300')
  return new Response(rewritten.body, { status: 200, headers })
}
