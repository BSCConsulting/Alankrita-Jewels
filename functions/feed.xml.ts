// GET /feed.xml — Google Merchant Center product feed. Merchant Center fetches it on a schedule
// (Products → Add products from a file → scheduled fetch), so admin changes reach Shopping automatically.
import { buildMerchantFeed, type FeedProduct } from '../src/lib/merchantFeed'
import { siteUrl, type Env } from './_lib/env'
import { hasSupabase, rest } from './_lib/supabase'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  let products: FeedProduct[] = []
  if (hasSupabase(env)) {
    try {
      products = await rest<FeedProduct[]>(
        env,
        'products?select=id,title,slug,description,mrp,sale_price,in_stock,stock_count,plating_type,category:categories(name),media:product_media(url,media_type,display_order,is_thumbnail)&order=created_at.desc',
      )
    } catch (err) {
      // An empty feed would make Merchant Center delist every product; a 503 makes it keep the last good fetch.
      console.error('Merchant feed lookup failed', err)
      return new Response('Feed temporarily unavailable', { status: 503, headers: { 'retry-after': '3600' } })
    }
  }

  return new Response(buildMerchantFeed(products, siteUrl(env, request)), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
