export interface PhotoSize {
  width: number
  height: number
}

export interface PhotoCheck {
  id: 'count' | 'sharp' | 'square' | 'reel'
  label: string
  ok: boolean
  hint: string | null
}

export const PHOTO_TARGET = { min: 5, max: 8 } as const
/** Shortest side below this looks soft in the zoomed gallery. */
export const MIN_SHARP_PX = 800

/**
 * Automatic checks for a product's photos. `sizes` holds one entry per photo in display order, null while that
 * photo is still loading; `main` is the photo shown on product cards.
 */
export function photoChecks(sizes: Array<PhotoSize | null>, main: PhotoSize | null, hasReel: boolean): PhotoCheck[] {
  const n = sizes.length
  const small = sizes.filter((s): s is PhotoSize => s != null && Math.min(s.width, s.height) < MIN_SHARP_PX).length
  const ratio = main ? main.width / main.height : null

  return [
    {
      id: 'count',
      label: `${n} ${n === 1 ? 'photo' : 'photos'} (aim for ${PHOTO_TARGET.min}–${PHOTO_TARGET.max})`,
      ok: n >= PHOTO_TARGET.min && n <= PHOTO_TARGET.max,
      hint:
        n < PHOTO_TARGET.min
          ? 'Add the front, back, clasp or hook, a close-up of the work, and the piece being worn.'
          : n > PHOTO_TARGET.max
            ? `Keep the best ${PHOTO_TARGET.max}; more makes the page slower without helping customers decide.`
            : null,
    },
    {
      id: 'sharp',
      label: 'Photos are sharp enough to zoom',
      ok: n > 0 && small === 0,
      hint:
        small > 0
          ? `${small} ${small === 1 ? 'photo is' : 'photos are'} smaller than ${MIN_SHARP_PX}px and may look blurry. Use the original from the camera, not a copy forwarded on WhatsApp.`
          : null,
    },
    {
      id: 'square',
      label: 'Main photo is close to square',
      ok: ratio != null && ratio >= 0.8 && ratio <= 1.25,
      hint: ratio != null && (ratio < 0.8 || ratio > 1.25) ? 'Product cards crop the main photo to a square, so parts of the piece may be cut off.' : null,
    },
    {
      id: 'reel',
      label: 'Short video added (optional)',
      ok: hasReel,
      hint: hasReel ? null : 'A 5–10 second video shows how the piece moves and catches the light.',
    },
  ]
}

export const PHOTO_TIPS = [
  'Main photo on a plain, light background with the whole piece in view.',
  'One photo being worn, so customers can judge the size.',
  'A close-up of the stones or Nakshi work.',
  'Daylight near a window and no beauty filters — the gold colour must match what the customer receives.',
] as const
