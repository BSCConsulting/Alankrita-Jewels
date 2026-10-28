import { expect, test, type Page } from '@playwright/test'

const COLLECTION = '/collections/1-gram-gold-jewellery'

/** The product page shows "Add to bag" / "Buy now" twice (desktop column and phone sticky bar); use whichever is on screen. */
const visibleButton = (page: Page, name: string | RegExp) => page.getByRole('button', { name }).filter({ visible: true }).first()

async function openFirstProduct(page: Page) {
  await page.goto(COLLECTION)
  await page.locator('a[href^="/product/"]').first().click()
  await expect(page).toHaveURL(/\/product\//)
  const sizes = page.getByRole('radiogroup', { name: 'Choose size' })
  if (await sizes.count()) await sizes.getByRole('radio').first().click()
}

test('a shopper can buy a piece with UPI, start to finish', async ({ page }) => {
  await openFirstProduct(page)
  await visibleButton(page, 'Buy now').click()
  await expect(page).toHaveURL(/\/checkout/)

  await page.locator('#phone').fill('9000000077')
  await page.getByRole('button', { name: 'Send OTP' }).click()
  // The OTP box submits by itself once all 6 digits are in.
  await page.locator('#otp').fill('123456')

  await page.getByLabel('Full name').fill('Lakshmi Devi')
  await page.getByLabel('House no., street, area').fill('1-2 Main Road, Ward 5')
  await page.getByLabel('Pincode').fill('500001')
  await page.getByLabel('City / Town').fill('Hyderabad')
  await page.getByRole('button', { name: /^(Pay|Place Order)/ }).click()

  await page.getByRole('button', { name: 'Simulate successful payment' }).click()
  await expect(page).toHaveURL(/\/order\/ALK-\d+/)
  await expect(page.getByRole('heading', { name: 'Dhanyavaadalu!' })).toBeVisible()
  await expect(page.getByText(/is confirmed/)).toBeVisible()
})

test('filters narrow a collection and can be cleared', async ({ page }) => {
  await page.goto(COLLECTION)
  const count = page.getByText(/^\d+ designs?$/).first()
  const all = Number((await count.innerText()).split(' ')[0])

  await page.goto(`${COLLECTION}?occasion=wedding`)
  const filtered = Number((await count.innerText()).split(' ')[0])
  expect(filtered).toBeGreaterThan(0)
  expect(filtered).toBeLessThan(all)

  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(count).toHaveText(new RegExp(`^${all} designs?$`))
  await expect(page).not.toHaveURL(/occasion=/)
})

test('the bridal set builder applies the set saving', async ({ page }) => {
  await page.goto('/bridal-set')
  const tiles = page.getByRole('button', { name: 'Add to set' })
  for (let i = 0; i < 3; i++) await tiles.first().click()
  for (const select of await page.locator('select:has(option[value=""])').all()) {
    if ((await select.inputValue()) === '') await select.selectOption({ index: 1 })
  }
  await expect(page.getByText(/Bridal set saving \(7% on 3 pieces\)/)).toBeVisible()
  await page.getByRole('button', { name: 'Add 3 to bag' }).click()
  await expect(page.getByRole('dialog', { name: 'Shopping bag' }).getByText(/Bridal set saving \(7% on 3 pieces\)/)).toBeVisible()
})

test('saving to the wishlist shows in the header and the wishlist page', async ({ page }) => {
  await page.goto(COLLECTION)
  await page.getByRole('button', { name: /^Save .* to wishlist$/ }).first().click()
  await expect(page.getByRole('link', { name: 'Wishlist, 1 saved' })).toBeVisible()
  await page.goto('/wishlist')
  await expect(page.locator('a[href^="/product/"]').first()).toBeVisible()
})

test('a page whose code was replaced by a new release reloads, then explains itself', async ({ page }) => {
  await page.route(/\/assets\/WishlistPage-[^/]+\.js$/, (route) => route.abort())
  await page.goto('/wishlist')
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible()
  await expect(page.getByText('We have just updated the site')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload page' })).toBeVisible()
})
