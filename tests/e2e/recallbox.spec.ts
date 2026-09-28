import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function newDeck(page: Page) {
  await page.goto('/decks')
  await page.getByRole('button', { name: 'New deck', exact: true }).click()
  await page.getByLabel('Deck name').fill('Trip Japanese')
  await page
    .getByLabel('Description optional')
    .fill('A small travel vocabulary')
  await page.getByLabel('Tags optional').fill('languages, travel')
  await page.getByRole('button', { name: 'Create deck', exact: true }).click()
  await page
    .getByRole('main')
    .getByRole('link', { name: /Trip Japanese/ })
    .click()
}
async function newCard(page: Page, image = false) {
  await page
    .getByRole('button', { name: 'Add card', exact: true })
    .first()
    .click()
  await page.getByLabel('Prompt', { exact: true }).fill('こんにちは')
  await page
    .getByLabel('Answer', { exact: true })
    .fill('**Hello**\n\nA friendly daytime greeting.')
  await page.getByRole('switch', { name: 'Practice both ways' }).click()
  await page.getByLabel('Reverse prompt optional').fill('Hello')
  await page.getByLabel('Tags optional').fill('greetings, travel')
  if (image) {
    await page
      .getByLabel('Upload card image')
      .setInputFiles('public/icon-192.png')
    await page.getByRole('tab', { name: 'Preview' }).click()
    await expect(
      page.getByRole('dialog').locator('.markdown img'),
    ).toBeVisible()
    await expect
      .poll(() =>
        page
          .getByRole('dialog')
          .locator('.markdown img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBe(192)
  }
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add card', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'One more thing to remember' }),
  ).toHaveCount(0)
}

test('creates a Markdown card, preserves its image, and reviews both directions independently', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await newDeck(page)
  await newCard(page, true)
  const deckUrl = page.url()
  await page.reload()
  await expect(page.getByText('2 reviews ready')).toBeVisible()
  await page.getByRole('button', { name: /^こんにちは/ }).click()
  await expect(page.getByRole('dialog').locator('.markdown img')).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByRole('dialog')
        .locator('.markdown img')
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(192)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Review deck' }).click()
  await expect(page.getByText('0 of 2 reviewed')).toBeVisible()
  await expect(page.locator('.study-answer')).toHaveCount(0)
  await page.keyboard.press('Space')
  await expect(page.locator('.study-answer')).toContainText('Hello')
  await page.getByRole('button', { name: /Easy/ }).click()
  await expect(page.getByText('1 of 2 reviewed')).toBeVisible()
  await expect(page.locator('.study-question')).toContainText('Hello')
  await expect(page.locator('.study-question')).not.toContainText(
    'friendly daytime',
  )
  await page.getByRole('button', { name: 'Reveal answer' }).click()
  await expect(page.locator('.study-answer')).toContainText('こんにちは')
  await page.getByRole('button', { name: /Easy/ }).click()
  await expect(
    page.getByRole('heading', { name: 'That’s time well spent.' }),
  ).toBeVisible()
  await page.goto(deckUrl)
  await expect(page.getByText('You’re all caught up')).toBeVisible()
  expect(errors).toEqual([])
})

test('ZIP restore recovers a deleted deck and its local image', async ({
  page,
}, testInfo) => {
  await newDeck(page)
  await newCard(page, true)
  await page.goto('/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export ZIP' }).click()
  const download = await downloadPromise
  const backupPath = testInfo.outputPath('backup.zip')
  await download.saveAs(backupPath)
  await page.goto('/decks')
  await page.getByRole('button', { name: 'Options for Trip Japanese' }).click()
  await page.getByRole('menuitem', { name: 'Delete deck' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(
    page.getByRole('main').getByRole('link', { name: /Trip Japanese/ }),
  ).toHaveCount(0)
  await page.goto('/settings')
  await page.getByLabel('Import backup file').setInputFiles(backupPath)
  await expect(page.getByRole('alertdialog')).toContainText('5 decks')
  await page
    .getByRole('button', { name: 'Restore backup', exact: true })
    .click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await page.goto('/decks')
  await page
    .getByRole('main')
    .getByRole('link', { name: /Trip Japanese/ })
    .click()
  await page.getByRole('button', { name: /^こんにちは/ }).click()
  await expect
    .poll(() =>
      page
        .getByRole('dialog')
        .locator('.markdown img')
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(192)
})

test('rejects an invalid import without replacing the library', async ({
  page,
}) => {
  await page.goto('/settings')
  await expect(page.getByText(/4 decks · 14 cards/)).toBeVisible()
  await page
    .getByLabel('Import backup file')
    .setInputFiles({
      name: 'broken.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from('not a zip'),
    })
  await expect(
    page.getByRole('region', { name: 'Notifications' }),
  ).toContainText(/zip|end of central directory/i)
  await expect(page.getByText(/4 decks · 14 cards/)).toBeVisible()
})

test('keeps unsaved edits until discard is confirmed', async ({ page }) => {
  await page.goto('/decks')
  await page.getByRole('button', { name: 'New deck', exact: true }).click()
  await page.getByLabel('Deck name').fill('Unsaved')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await expect(page.getByLabel('Deck name')).toHaveValue('Unsaved')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'A new place to learn' }),
  ).toHaveCount(0)
})

test('renders every screen without overflow or serious accessibility violations', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  for (const path of [
    '/',
    '/decks',
    '/tags',
    '/activity',
    '/settings',
    '/study',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('main')).toBeVisible()
    await expect
      .poll(() => page.locator('h1, .study-card').count())
      .toBeGreaterThan(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy()
    await page.evaluate(async () => {
      await document.fonts.ready
      await navigator.serviceWorker.ready
    })
    await expect(page.getByRole('main').locator(':scope > div')).toHaveCSS(
      'opacity',
      '1',
    )
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (a) =>
                  a.playState === 'running' &&
                  a.effect?.getTiming().iterations !== Infinity,
              ).length,
        ),
      )
      .toBe(0)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(
      results.violations
        .filter((v) => v.impact === 'critical' || v.impact === 'serious')
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  }
  await page.goto('/')
  await expect(page.getByRole('main').locator(':scope > div')).toHaveCSS(
    'opacity',
    '1',
  )
  await page.screenshot({
    path: testInfo.outputPath('overview.png'),
    fullPage: true,
    scale: 'css',
  })
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveClass('dark')
  await expect(page.getByRole('main').locator(':scope > div')).toHaveCSS(
    'opacity',
    '1',
  )
  await page.screenshot({
    path: testInfo.outputPath('dark.png'),
    fullPage: true,
    scale: 'css',
  })
  const darkResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(
    darkResults.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => v.id),
  ).toEqual([])
  expect(errors).toEqual([])
})

test('loads and reviews offline after the first successful visit', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBeTruthy()
  await context.setOffline(true)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: /A little practice/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Start reviewing/ }).click()
  await page.getByRole('button', { name: 'Reveal answer' }).click()
  await page.getByRole('button', { name: /Easy/ }).click()
  await expect(page.getByText('1 of 18 reviewed')).toBeVisible()
  await context.setOffline(false)
})
