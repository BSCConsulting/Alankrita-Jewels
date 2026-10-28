import { describe, expect, it } from 'vitest'
import { allow, describeBrowser, sameOrigin } from '../functions/_lib/rateLimit'
import { isStaleChunkError } from '../src/lib/errorReporting'

describe('allow', () => {
  it('lets through up to the limit per window, then resets', () => {
    const key = `t-${Math.random()}`
    const results = [0, 1, 2, 3].map(() => allow(key, 3, 1000, 10_000))
    expect(results).toEqual([true, true, true, false])
    expect(allow(key, 3, 1000, 11_000)).toBe(true)
  })
  it('keeps keys separate', () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    expect(allow(a, 1, 1000, 0)).toBe(true)
    expect(allow(a, 1, 1000, 1)).toBe(false)
    expect(allow(b, 1, 1000, 1)).toBe(true)
  })
})

describe('sameOrigin', () => {
  const req = (origin?: string) => new Request('https://shop.example/api/track', { method: 'POST', headers: origin ? { origin } : {} })
  it('accepts the site itself or no origin, and rejects other sites', () => {
    expect(sameOrigin(req('https://shop.example'))).toBe(true)
    expect(sameOrigin(req())).toBe(true)
    expect(sameOrigin(req('https://evil.example'))).toBe(false)
  })
})

describe('describeBrowser', () => {
  it('names common phone browsers', () => {
    expect(describeBrowser('Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36')).toBe(
      'Chrome 130 on Android',
    )
    expect(
      describeBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'),
    ).toBe('Safari 17 on iPhone/iPad')
    expect(describeBrowser('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36')).toBe(
      'Samsung Internet 25 on Android',
    )
    expect(describeBrowser('')).toBe('Browser on unknown system')
  })
})

describe('isStaleChunkError', () => {
  it('recognises a page file replaced by a new release, in each browser', () => {
    expect(isStaleChunkError('Failed to fetch dynamically imported module: https://x/assets/a.js')).toBe(true)
    expect(isStaleChunkError('Importing a module script failed.')).toBe(true)
    expect(isStaleChunkError('error loading dynamically imported module')).toBe(true)
    expect(isStaleChunkError("Cannot read properties of undefined (reading 'id')")).toBe(false)
  })
})
