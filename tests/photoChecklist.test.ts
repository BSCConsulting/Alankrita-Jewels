import { describe, expect, it } from 'vitest'
import { photoChecks } from '../src/lib/photoChecklist'

const sq = { width: 1400, height: 1400 }
const byId = (checks: ReturnType<typeof photoChecks>) => Object.fromEntries(checks.map((c) => [c.id, c.ok]))

describe('photoChecks', () => {
  it('passes a complete set of square, sharp photos with a reel', () => {
    expect(byId(photoChecks(Array(6).fill(sq), sq, true))).toEqual({ count: true, sharp: true, square: true, reel: true })
  })

  it('flags too few or too many photos', () => {
    expect(byId(photoChecks([sq, sq], sq, false)).count).toBe(false)
    expect(byId(photoChecks(Array(9).fill(sq), sq, false)).count).toBe(false)
  })

  it('flags small photos but ignores ones still loading', () => {
    const checks = photoChecks([sq, { width: 640, height: 640 }, null], sq, false)
    expect(checks.find((c) => c.id === 'sharp')).toMatchObject({ ok: false, hint: expect.stringContaining('1 photo is') })
    expect(byId(photoChecks([sq, null], sq, false)).sharp).toBe(true)
    expect(byId(photoChecks([], null, false)).sharp).toBe(false)
  })

  it('flags a tall main photo that product cards would crop', () => {
    expect(byId(photoChecks([sq], { width: 900, height: 1600 }, false)).square).toBe(false)
    expect(byId(photoChecks([sq], { width: 1200, height: 1400 }, false)).square).toBe(true)
  })
})
