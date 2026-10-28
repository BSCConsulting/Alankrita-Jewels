// GET /collections/:slug and /collections/:group/:slug — collection title, description, canonical URL,
// breadcrumb and product list injected at the edge, matching what CollectionPage sets in the browser.
import { categoryPath, COLLECTION_CONTENT } from '../../src/config/collections'
import { SITE } from '../../src/config/site'
import { breadcrumbJsonLd } from '../../src/lib/jsonld'
import { siteUrl, type Env } from '../_lib/env'
import { renderShell, withEdgeCache } from '../_lib/seoPage'
import { hasSupabase, rest } from '../_lib/supabase'

interface CategoryRow {
  id: string
  name: string
  slug: string
  parent_id: string | null
  description: string | null
}

interface ProductRow {
  slug: string
  title: string
  media: Array<{ url: string; media_type: string; display_order: number }>
}

export const onRequestGet: PagesFunction<Env, 'path'> = (context) =>
  withEdgeCache(context, async (shell) => {
    const { request, env, params } = context
    if (!hasSupabase(env)) return shell

    const segments = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean)
    const slug = String(segments[segments.length - 1] ?? '')
    if (!slug) return shell

    let categories: CategoryRow[]
    try {
      categories = await rest<CategoryRow[]>(env, 'categories?select=id,name,slug,parent_id,description')
    } catch (err) {
      console.error('SEO collection lookup failed', err)
      return shell
    }
    const category = categories.find((c) => c.slug === slug)
    if (!category) return new Response(shell.body, { status: 404, headers: shell.headers })

    const parent = category.parent_id ? categories.find((c) => c.id === category.parent_id) : undefined
    const treeIds = [category.id, ...categories.filter((c) => c.parent_id === category.id).map((c) => c.id)]
    let products: ProductRow[] = []
    try {
      products = await rest<ProductRow[]>(
        env,
        `products?category_id=in.(${treeIds.join(',')})&select=slug,title,media:product_media(url,media_type,display_order)&order=featured.desc,created_at.desc&limit=20`,
      )
    } catch (err) {
      console.error('SEO collection products lookup failed', err)
    }

    const base = siteUrl(env, request)
    const path = categoryPath(category, categories)
    const url = `${base}${path}`
    const content = COLLECTION_CONTENT[category.slug]
    const rawTitle = content?.seoTitle ?? `${category.name} Online`
    const title = rawTitle.includes(SITE.name) ? rawTitle : `${rawTitle} | ${SITE.name}`
    const description = (content?.seoDescription ?? category.description ?? `${category.name} by ${SITE.name}`).slice(0, 160)
    const firstImage = products
      .flatMap((p) => p.media.filter((m) => m.media_type === 'image').sort((a, b) => a.display_order - b.display_order))
      .map((m) => (m.url.startsWith('http') ? m.url : `${base}${m.url}`))[0]

    return renderShell(shell, {
      title,
      description,
      url,
      image: firstImage,
      jsonLd: [
        breadcrumbJsonLd(
          [
            { name: 'Home', path: '/' },
            ...(parent ? [{ name: parent.name, path: categoryPath(parent, categories) }] : []),
            { name: category.name, path },
          ],
          base,
        ),
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: category.name,
          description,
          url,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: products.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${base}/product/${p.slug}`,
              name: p.title,
            })),
          },
        },
      ],
    })
  })
