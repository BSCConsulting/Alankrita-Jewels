import { useEffect } from 'react'
import { SITE } from '@/config/site'

export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? SITE.defaultUrl).replace(/\/$/, '')

interface SeoOptions {
  title: string
  description?: string
  path?: string
  image?: string
  type?: 'website' | 'product'
  noindex?: boolean
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!content) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

/** Imperatively syncs <head> tags so they replace (not duplicate) the static defaults in index.html. */
export function useSeo({ title, description, path, image, type = 'website', noindex }: SeoOptions) {
  useEffect(() => {
    const fullTitle = title.includes(SITE.name) ? title : `${title} | ${SITE.name}`
    const url = `${SITE_URL}${path ?? window.location.pathname}`
    const img = image ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : undefined

    document.title = fullTitle
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : undefined)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:image', img)
    upsertMeta('name', 'twitter:card', img ? 'summary_large_image' : 'summary')
    upsertCanonical(url)
  }, [title, description, path, image, type, noindex])
}
