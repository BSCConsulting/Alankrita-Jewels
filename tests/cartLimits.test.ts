import { beforeEach, describe, expect, it } from 'vitest'
import { addLimitMessage, MAX_PIECES_PER_ORDER, MAX_QTY_PER_PRODUCT, useCartStore } from '../src/stores/useCartStore'

const item = (productId: string, size: string | null = null, maxQty = 50) => ({
  productId,
  slug: productId,
  title: productId,
  teluguTitle: null,
  image: '',
  mrp: 1000,
  salePrice: 800,
  size,
  maxQty,
})

const pieces = () => useCartStore.getState().items.reduce((n, i) => n + i.quantity, 0)

describe('cart limits (mirror place_order)', () => {
  beforeEach(() => useCartStore.setState({ items: [] }))

  it('caps one design across all its sizes', () => {
    const { add } = useCartStore.getState()
    expect(add(item('bangle', '2.4'), 7)).toBe(7)
    expect(add(item('bangle', '2.6'), 7)).toBe(MAX_QTY_PER_PRODUCT - 7)
    expect(add(item('bangle', '2.8'), 1)).toBe(0)
  })

  it('caps the whole bag', () => {
    const { add } = useCartStore.getState()
    add(item('a'), 10)
    add(item('b'), 10)
    expect(add(item('c'), 1)).toBe(0)
    expect(pieces()).toBe(MAX_PIECES_PER_ORDER)
  })

  it('never exceeds stock', () => {
    expect(useCartStore.getState().add(item('ring', null, 3), 5)).toBe(3)
  })

  it('setQuantity respects the other lines of the same design', () => {
    const { add } = useCartStore.getState()
    add(item('bangle', '2.4'), 6)
    add(item('bangle', '2.6'), 1)
    const key = useCartStore.getState().items[1].key
    useCartStore.getState().setQuantity(key, 9)
    expect(useCartStore.getState().items[1].quantity).toBe(4)
  })

  it('sync drops lines over the limits and reports price changes', () => {
    const { add } = useCartStore.getState()
    add(item('a'), 5)
    const result = useCartStore.getState().sync([
      { id: 'a', title: 'a', telugu_title: null, image: '', mrp: 1000, sale_price: 900, stock_count: 2, in_stock: true },
    ])
    expect(result.changed).toEqual(['a'])
    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: 2, salePrice: 900 })
  })

  it('explains partial adds', () => {
    expect(addLimitMessage(2, 2)).toBeNull()
    expect(addLimitMessage(3, 1)).toMatch(/^Only 1 more/)
    expect(addLimitMessage(1, 0)).toMatch(/already the most/)
  })
})
