// Generates themed SVG placeholder product art (public/placeholders) and supabase/seed.sql
// from the single catalog source of truth: src/data/catalog.json.
//   node scripts/generate-assets.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(root, 'src/data/catalog.json'), 'utf8'))
const W = 800
const H = 1000
const CX = 400
const CY = 470

const METALS = {
  gold: ['#FFF1B8', '#E7C35A', '#A87B1E'],
  rose: ['#FCE3DC', '#E8A99C', '#B26F64'],
  silver: ['#FFFFFF', '#D9DEE6', '#8C96A5'],
}
const BACKDROPS = {
  heritage: [['#6B1622', '#2A060C'], ['#8A1F2E', '#3A0911']],
  modern: [['#FFFFFF', '#F2DCD3'], ['#FDF6EF', '#EBC9C4']],
}
const KEMPU = '#B3122E'
const EMERALD = '#0F7B4F'

const quad = (p0, p1, p2, t) => ({
  x: (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
  y: (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1],
})
const along = (p0, p1, p2, n, fn) =>
  Array.from({ length: n }, (_, i) => fn(quad(p0, p1, p2, (i + 0.5) / n), i)).join('')

const gem = (x, y, r, color) =>
  `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="url(#m)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/><circle cx="${x - r / 3}" cy="${y - r / 3}" r="${r / 3.5}" fill="#fff" opacity=".55"/>`
const bead = (x, y, r, fill = 'url(#m)') =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/><circle cx="${x - r / 3}" cy="${y - r / 3}" r="${r / 3}" fill="#fff" opacity=".5"/>`
const czStone = (x, y, r) =>
  `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="#F8FBFF" stroke="#C9D3E0" stroke-width="2"/><polygon points="${x},${y - r} ${x + r / 2},${y} ${x},${y + r / 2.2} ${x - r / 2},${y}" fill="#fff"/>`

const MOTIFS = {
  necklace: (p) => {
    const a = [180, 260], c = [400, 820], b = [620, 260]
    const stones = p.metal === 'silver'
      ? along(a, c, b, 15, ({ x, y }) => czStone(x, y, 16))
      : along(a, c, b, 15, ({ x, y }, i) => (i % 3 === 1 ? gem(x, y, 11, KEMPU) : bead(x, y, 13)))
    return `<path d="M${a} Q${c} ${b}" fill="none" stroke="url(#m)" stroke-width="8"/>${stones}
      <path d="M400 560 q-46 50 0 120 q46 -70 0 -120z" fill="url(#m)"/>${p.metal === 'silver' ? czStone(400, 612, 26) : gem(400, 612, 20, KEMPU)}`
  },
  choker: () => {
    const a = [200, 320], c = [400, 610], b = [600, 320]
    return `<path d="M${a} Q${c} ${b}" fill="none" stroke="url(#m)" stroke-width="44" stroke-linecap="round"/>
      ${along(a, c, b, 9, ({ x, y }, i) => gem(x, y, 13, i % 2 ? EMERALD : KEMPU) + bead(x, y + 52, 9, '#FDF8EE') + `<line x1="${x}" y1="${y + 20}" x2="${x}" y2="${y + 44}" stroke="url(#m)" stroke-width="3"/>`)}
      <circle cx="400" cy="520" r="46" fill="url(#m)"/>${gem(400, 520, 22, KEMPU)}`
  },
  vaddanam: () => {
    const links = Array.from({ length: 10 }, (_, i) => {
      const x = 130 + i * 60 + (i >= 5 ? 60 : 0)
      return `<rect x="${x}" y="430" width="48" height="80" rx="10" fill="url(#m)"/>${gem(x + 24, 470, 9, i % 2 ? EMERALD : KEMPU)}`
    }).join('')
    const petals = Array.from({ length: 12 }, (_, i) => {
      const t = (i / 12) * Math.PI * 2
      return bead(CX + Math.cos(t) * 96, CY + Math.sin(t) * 96, 13)
    }).join('')
    return `<rect x="110" y="446" width="580" height="48" rx="24" fill="url(#m)" opacity=".55"/>${links}
      <circle cx="${CX}" cy="${CY}" r="110" fill="url(#m)"/>${petals}<circle cx="${CX}" cy="${CY}" r="70" fill="url(#m)" stroke="#7A5512" stroke-width="3"/>${gem(CX, CY, 30, KEMPU)}`
  },
  bangles: () =>
    [0, 1, 2, 3].map((i) =>
      `<ellipse cx="${CX}" cy="${330 + i * 70}" rx="210" ry="70" fill="none" stroke="url(#m)" stroke-width="20"/>` +
      Array.from({ length: 9 }, (_, k) => {
        const t = Math.PI * (k / 8)
        return `<circle cx="${CX - Math.cos(t) * 210}" cy="${330 + i * 70 + Math.sin(t) * 70}" r="4" fill="#fff" opacity=".7"/>`
      }).join(''),
    ).join(''),
  nallapusalu: () => {
    const a = [200, 220], c = [400, 900], b = [600, 220]
    const a2 = [240, 220], c2 = [400, 820], b2 = [560, 220]
    const line = (p0, p1, p2, n) =>
      along(p0, p1, p2, n, ({ x, y }, i) => (i % 5 === 2 ? bead(x, y, 10) : bead(x, y, 7, '#121212')))
    return `${line(a, c, b, 46)}${line(a2, c2, b2, 40)}
      <circle cx="372" cy="600" r="34" fill="url(#m)"/><circle cx="428" cy="600" r="34" fill="url(#m)"/>
      <circle cx="372" cy="600" r="22" fill="none" stroke="#7A5512" stroke-width="3"/><circle cx="428" cy="600" r="22" fill="none" stroke="#7A5512" stroke-width="3"/>`
  },
  chain: () => {
    const a = [180, 240], c = [400, 860], b = [620, 240]
    return along(a, c, b, 13, ({ x, y }, i) => {
      const t = (i + 0.5) / 13
      const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0])
      const dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1])
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI
      return `<rect x="${x - 26}" y="${y - 9}" width="52" height="18" rx="9" fill="none" stroke="url(#m)" stroke-width="6" transform="rotate(${deg} ${x} ${y})"/>`
    })
  },
  hoops: () =>
    [290, 510].map((x) =>
      `<circle cx="${x}" cy="${CY}" r="78" fill="none" stroke="url(#m)" stroke-width="26"/>
       <path d="M${x} ${CY + 96} l-26 -18 q-8 26 26 30 q34 -4 26 -30z" fill="url(#m)"/>`,
    ).join(''),
  bracelet: () =>
    `<ellipse cx="${CX}" cy="${CY}" rx="230" ry="120" fill="none" stroke="url(#m)" stroke-width="16"/>
     <ellipse cx="${CX}" cy="${CY}" rx="230" ry="120" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>${czStone(CX, CY + 120, 22)}`,
  ring: () =>
    `<circle cx="${CX}" cy="${CY + 60}" r="130" fill="none" stroke="url(#m)" stroke-width="24"/>
     ${Array.from({ length: 10 }, (_, i) => {
       const t = (i / 10) * Math.PI * 2
       return czStone(CX + Math.cos(t) * 64, CY - 110 + Math.sin(t) * 64, 12)
     }).join('')}${czStone(CX, CY - 110, 44)}`,
  pearls: () =>
    [300, 500].map((x) =>
      `<path d="M${x} 300 q-30 40 0 80" fill="none" stroke="url(#m)" stroke-width="7"/>
       <circle cx="${x}" cy="300" r="18" fill="url(#m)"/>
       <circle cx="${x}" cy="470" r="70" fill="url(#p)"/><circle cx="${x - 22}" cy="448" r="16" fill="#fff" opacity=".8"/>
       <line x1="${x}" y1="380" x2="${x}" y2="402" stroke="url(#m)" stroke-width="7"/>`,
    ).join(''),
  heart: () => {
    const a = [200, 200], c = [400, 760], b = [600, 200]
    return `<path d="M${a} Q${c} ${b}" fill="none" stroke="url(#m)" stroke-width="5"/>
      <path d="M400 640 C320 580 300 520 340 490 C370 468 400 490 400 512 C400 490 430 468 460 490 C500 520 480 580 400 640z" fill="url(#m)"/>
      <path d="M352 500 q12 -12 26 -4" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>`
  },
}

const sparkles = (seed, n, color) =>
  Array.from({ length: n }, (_, i) => {
    const x = (Math.sin(seed * 13.1 + i * 7.7) * 0.5 + 0.5) * W
    const y = (Math.cos(seed * 5.3 + i * 3.1) * 0.5 + 0.5) * (H - 160)
    const s = 6 + ((i * 7) % 10)
    return `<path d="M${x} ${y - s} L${x + s / 4} ${y - s / 4} L${x + s} ${y} L${x + s / 4} ${y + s / 4} L${x} ${y + s} L${x - s / 4} ${y + s / 4} L${x - s} ${y} L${x - s / 4} ${y - s / 4}z" fill="${color}" opacity="${0.35 + ((i * 3) % 5) / 10}"/>`
  }).join('')

function renderSvg(product, theme, variant) {
  const [hi, mid, lo] = METALS[product.metal] ?? METALS.gold
  const [from, to] = BACKDROPS[theme][variant]
  const ink = theme === 'heritage' ? '#E7C35A' : '#1E293B'
  const seed = product.slug.length + variant * 11
  const art = MOTIFS[product.motif]?.(product) ?? MOTIFS.necklace(product)
  const zoom = variant === 1 ? `transform="translate(${CX} ${CY}) scale(1.65) translate(${-CX} ${-CY})"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <radialGradient id="bg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></radialGradient>
  <linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
  <radialGradient id="p" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#F3ECE4"/><stop offset="1" stop-color="#CFC3B6"/></radialGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${hi}" stop-opacity=".35"/><stop offset="1" stop-color="${hi}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<ellipse cx="${CX}" cy="${CY}" rx="330" ry="330" fill="url(#glow)"/>
<g ${zoom}>${art}</g>
${sparkles(seed, variant === 1 ? 18 : 10, theme === 'heritage' ? '#FFF1B8' : '#FFFFFF')}
<text x="${CX}" y="${H - 56}" text-anchor="middle" font-family="Georgia, serif" font-size="22" letter-spacing="10" fill="${ink}" opacity=".6">ALANKRITA JEWELS</text>
</svg>
`
}

const categoriesBySlug = Object.fromEntries(catalog.categories.map((c) => [c.slug, c]))
const outDir = join(root, 'public/placeholders')
mkdirSync(outDir, { recursive: true })

for (const p of catalog.products) {
  const theme = categoriesBySlug[p.category_slug]?.theme_default ?? 'heritage'
  for (const variant of [0, 1]) {
    writeFileSync(join(outDir, `${p.slug}-${variant + 1}.svg`), renderSvg(p, theme, variant))
  }
}

// ---------------- seed.sql ----------------
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`)
const arr = (a) => `array[${a.map(q).join(', ')}]::text[]`

const lines = [
  '-- Generated by scripts/generate-assets.mjs from src/data/catalog.json — do not edit by hand.',
  '-- Placeholder image URLs are site-relative (/placeholders/*.svg) and served by Cloudflare Pages.',
  '',
  'insert into public.categories (id, name, telugu_name, slug, parent_id, description, theme_default, display_order) values',
  catalog.categories
    .map((c) => `  (${q(c.id)}, ${q(c.name)}, ${q(c.telugu_name)}, ${q(c.slug)}, ${c.parent_slug ? q(categoriesBySlug[c.parent_slug].id) : 'null'}, ${q(c.description)}, ${q(c.theme_default)}, ${c.display_order})`)
    .join(',\n') + '\non conflict (id) do nothing;',
  '',
  'insert into public.products (id, title, telugu_title, slug, description, category_id, mrp, sale_price, jewellery_type, plating_type, warranty_details, available_sizes, stock_count, featured) values',
  catalog.products
    .map((p) => `  (${q(p.id)}, ${q(p.title)}, ${q(p.telugu_title)}, ${q(p.slug)}, ${q(p.description)}, ${q(categoriesBySlug[p.category_slug].id)}, ${p.mrp}, ${p.sale_price}, ${q(p.jewellery_type)}, ${q(p.plating_type)}, ${q(p.warranty_details)}, ${arr(p.available_sizes)}, ${p.stock_count}, ${p.featured})`)
    .join(',\n') + '\non conflict (id) do nothing;',
  '',
  'insert into public.product_media (product_id, media_type, url, is_thumbnail, display_order) values',
  catalog.products
    .flatMap((p) => [
      `  (${q(p.id)}, 'image', ${q(`/placeholders/${p.slug}-1.svg`)}, true, 0)`,
      `  (${q(p.id)}, 'image', ${q(`/placeholders/${p.slug}-2.svg`)}, false, 1)`,
      ...(p.reel ? [`  (${q(p.id)}, 'video_reel', ${q(catalog.sampleReelUrl)}, false, 2)`] : []),
    ])
    .join(',\n') + ';',
  '',
]
writeFileSync(join(root, 'supabase/seed.sql'), lines.join('\n'))
console.log(`Wrote ${catalog.products.length * 2} placeholders and supabase/seed.sql`)
