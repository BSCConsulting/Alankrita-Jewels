// GET /robots.txt — generated so the Sitemap line follows SITE_URL (pages.dev today, custom domain later).
import { siteUrl, type Env } from './_lib/env'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /checkout
Disallow: /order/

Sitemap: ${siteUrl(env, request)}/sitemap.xml
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
