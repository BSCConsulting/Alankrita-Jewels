// Serves the SPA shell with page-specific <title>, meta, Open Graph and JSON-LD injected at the edge,
// so Google and WhatsApp link previews see real titles without running JavaScript.
import type { Env } from './env'
import { escapeHtml } from './http'

export interface PageSeo {
  title: string
  description: string
  url: string
  image?: string
  ogType?: 'website' | 'product'
  extraMeta?: Array<[attr: 'name' | 'property', key: string, value: string]>
  jsonLd?: unknown[]
}

const EDGE_TTL_SECONDS = 300

export function renderShell(shell: Response, seo: PageSeo, status = 200): Response {
  const meta = (attr: string, key: string, value: string) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`
  const ld = (seo.jsonLd ?? [])
    .map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`)
    .join('')

  const rewritten = new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(seo.title) })
    .on('meta[name="description"]', { element: (el) => void el.setAttribute('content', seo.description) })
    .on('meta[property="og:type"]', { element: (el) => void el.setAttribute('content', seo.ogType ?? 'website') })
    .on('meta[property^="og:title"], meta[property^="og:description"], meta[property^="og:image"], meta[name="twitter:card"]', {
      element: (el) => void el.remove(),
    })
    .on('head', {
      element: (el) =>
        void el.append(
          [
            `<link rel="canonical" href="${escapeHtml(seo.url)}" />`,
            meta('property', 'og:title', seo.title),
            meta('property', 'og:description', seo.description),
            meta('property', 'og:url', seo.url),
            seo.image ? meta('property', 'og:image', seo.image) : '',
            ...(seo.extraMeta ?? []).map(([attr, key, value]) => meta(attr, key, value)),
            meta('name', 'twitter:card', seo.image ? 'summary_large_image' : 'summary'),
            ld,
          ].join(''),
          { html: true },
        ),
    })
    .transform(shell)

  const headers = new Headers(rewritten.headers)
  headers.set('cache-control', 'public, max-age=0, must-revalidate')
  return new Response(rewritten.body, { status, headers })
}

/**
 * Caches rendered pages at the Cloudflare edge for 5 minutes, so repeat visits skip the database.
 * The key includes the shell's ETag: after a deploy, cached pages never point at old JS bundles.
 */
export async function withEdgeCache(
  context: EventContext<Env, string, unknown>,
  render: (shell: Response) => Promise<Response>,
): Promise<Response> {
  const { request, env, waitUntil } = context
  // A plain GET: forwarding the visitor's Range / If-None-Match headers could return a partial or empty shell.
  const shell = await env.ASSETS.fetch(new URL('/', request.url).toString())
  if (shell.status !== 200) return shell
  const etag = shell.headers.get('etag')
  const cache = (caches as unknown as { default: Cache }).default
  if (!etag || !cache) return render(shell)

  const url = new URL(request.url)
  const key = new Request(`${url.origin}${url.pathname}?__shell=${encodeURIComponent(etag)}`)
  const hit = await cache.match(key)
  if (hit) {
    const headers = new Headers(hit.headers)
    headers.set('cache-control', 'public, max-age=0, must-revalidate')
    headers.set('x-edge-cache', 'HIT')
    return new Response(hit.body, { status: hit.status, headers })
  }

  const response = await render(shell)
  if (response.status !== 200) return response
  const [forCache, forClient] = [response.clone(), response]
  const stored = new Headers(forCache.headers)
  stored.set('cache-control', `public, max-age=${EDGE_TTL_SECONDS}`)
  waitUntil(cache.put(key, new Response(forCache.body, { status: 200, headers: stored })))
  const headers = new Headers(forClient.headers)
  headers.set('x-edge-cache', 'MISS')
  return new Response(forClient.body, { status: 200, headers })
}
