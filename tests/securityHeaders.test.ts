import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

const policy = (name: string) => headers.match(new RegExp(`^\\s+${name}: (.+)$`, 'm'))?.[1] ?? ''

describe('Content-Security-Policy', () => {
  it('allows every inline script in index.html by hash', () => {
    const inline = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    expect(inline.length).toBeGreaterThan(0)
    for (const script of inline) {
      const hash = `'sha256-${createHash('sha256').update(script).digest('base64')}'`
      expect(policy('Content-Security-Policy-Report-Only')).toContain(hash)
    }
  })

  it('always blocks framing, <base> hijacking and plugins', () => {
    const enforced = policy('Content-Security-Policy')
    expect(enforced).toContain("frame-ancestors 'none'")
    expect(enforced).toContain("base-uri 'self'")
    expect(enforced).toContain("object-src 'none'")
  })
})
