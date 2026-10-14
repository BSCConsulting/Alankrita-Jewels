import { describe, expect, it } from 'vitest'
import { BUSINESS, BUSINESS_ADDRESS } from '../src/config/site'
import { storeJsonLd } from '../src/lib/jsonld'

describe('storeJsonLd', () => {
  const graph = storeJsonLd('https://shop.example')['@graph']
  const store = graph.find((n) => n['@type'] === 'JewelryStore')!
  const website = graph.find((n) => n['@type'] === 'WebSite')!

  it('uses the registered business address', () => {
    expect(store).toMatchObject({
      address: { addressLocality: BUSINESS_ADDRESS.locality, postalCode: BUSINESS_ADDRESS.postalCode, addressCountry: 'IN' },
      email: BUSINESS.email,
    })
    expect(BUSINESS.address).toContain('Madhira')
  })

  it('advertises the site search to Google', () => {
    expect(website).toMatchObject({
      potentialAction: { target: { urlTemplate: 'https://shop.example/search?q={search_term_string}' } },
    })
  })
})
