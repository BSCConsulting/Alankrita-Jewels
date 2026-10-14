// GET /sitemap.xml — collections + every product slug (from Supabase, or catalog.json in mock mode).
import catalog from '../src/data/catalog.json'
import { siteUrl, type Env } from './_lib/env'
import { hasSupabase, rest } from './_lib/supabase'

interface CategoryRow {
  id: string
  slug: string
  parent_id: string | null
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const base = siteUrl(env, request)

  let categories: CategoryRow[]
  let products: Array<{ slug: string; updated_at?: string }>
  if (hasSupabase(env)) {
    ;[categories, products] = await Promise.all([
      rest<CategoryRow[]>(env, 'categories?select=id,slug,parent_id'),
      rest<Array<{ slug: string; updated_at: string }>>(env, 'products?select=slug,updated_at'),
    ])
  } else {
    const idBySlug = new Map(catalog.categories.map((c) => [c.slug, c.id]))
    categories = catalog.categories.map((c) => ({ id: c.id, slug: c.slug, parent_id: c.parent_slug ? (idBySlug.get(c.parent_slug) ?? null) : null }))
    products = catalog.products.map((p) => ({ slug: p.slug }))
  }

  const pathFor = (c: CategoryRow) => {
    const parent = categories.find((p) => p.id === c.parent_id)
    return parent ? `/collections/${parent.slug.replace(/-jewellery$/, '')}/${c.slug}` : `/collections/${c.slug}`
  }

  const urls = [
    { loc: '/', priority: '1.0' },
    ...categories.map((c) => ({ loc: pathFor(c), priority: '0.9' })),
    ...products.map((p) => ({ loc: `/product/${p.slug}`, priority: '0.8', lastmod: p.updated_at?.slice(0, 10) })),
    ...['/contact', '/policies/shipping', '/policies/returns', '/policies/privacy', '/policies/terms'].map((loc) => ({ loc, priority: '0.3' })),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url><loc>${base}${u.loc}</loc>${'lastmod' in u && u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`)
  .join('\n')}
</urlset>`

  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
