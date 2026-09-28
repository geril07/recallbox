import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

async function newDeck(page: Page) {
  await page.goto("/decks")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByLabel("Deck name").fill("Trip Japanese")
  await page
    .getByLabel("Description optional")
    .fill("A small travel vocabulary")
  for (const tag of ["languages", "travel"]) {
    await page.getByRole("combobox", { name: "Tags optional" }).fill(tag)
    await page.getByRole("option", { name: tag, exact: true }).click()
  }
  await page.getByRole("button", { name: "Create deck", exact: true }).click()
  await page
    .getByRole("main")
    .getByRole("link", { name: /Trip Japanese/ })
    .click()
}
async function newCard(page: Page, image = false) {
  await page
    .getByRole("button", { name: "Add card", exact: true })
    .first()
    .click()
  await page.getByLabel("Prompt", { exact: true }).fill("こんにちは")
  await page
    .getByLabel("Answer", { exact: true })
    .fill("**Hello**\n\nA friendly daytime greeting.")
  await page.getByRole("switch", { name: "Practice both ways" }).click()
  await page.getByLabel("Reverse prompt optional").fill("Hello")
  for (const tag of ["greetings", "travel"]) {
    await page.getByRole("combobox", { name: "Tags optional" }).fill(tag)
    await page.getByRole("option", { name: tag, exact: true }).click()
  }
  if (image) {
    await page
      .getByLabel("Upload card image")
      .setInputFiles("public/icon-192.png")
    await page.getByRole("tab", { name: "Preview" }).click()
    await expect(
      page.getByRole("dialog").locator(".markdown img"),
    ).toBeVisible()
    await expect
      .poll(() =>
        page
          .getByRole("dialog")
          .locator(".markdown img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBe(192)
  }
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add card", exact: true })
    .click()
  await expect(
    page.getByRole("dialog", { name: "One more thing to remember" }),
  ).toHaveCount(0)
}

test("creates a Markdown card, preserves its image, and reviews both directions independently", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await newDeck(page)
  await newCard(page, true)
  const deckUrl = page.url()
  await page.reload()
  await expect(page.getByText("2 reviews ready")).toBeVisible()
  await page.getByRole("button", { name: /^こんにちは/ }).click()
  await expect(page.getByRole("dialog").locator(".markdown img")).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByRole("dialog")
        .locator(".markdown img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(192)
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Review deck" }).click()
  await expect(page.getByText("0 of 2 reviewed")).toBeVisible()
  await expect(page.locator(".study-answer")).toHaveCount(0)
  await page.keyboard.press("Space")
  await expect(page.locator(".study-answer")).toContainText("Hello")
  await page.getByRole("button", { name: /Easy/ }).click()
  await expect(page.getByText("1 of 2 reviewed")).toBeVisible()
  await expect(page.locator(".study-question")).toContainText("Hello")
  await expect(page.locator(".study-question")).not.toContainText(
    "friendly daytime",
  )
  await page.getByRole("button", { name: "Reveal answer" }).click()
  await expect(page.locator(".study-answer")).toContainText("こんにちは")
  await page.getByRole("button", { name: /Easy/ }).click()
  await expect(
    page.getByRole("heading", { name: "That’s time well spent." }),
  ).toBeVisible()
  await page.goto(deckUrl)
  await expect(page.getByText("You’re all caught up")).toBeVisible()
  expect(errors).toEqual([])
})

test("ZIP restore recovers a deleted deck and its local image", async ({
  page,
}, testInfo) => {
  await newDeck(page)
  await newCard(page, true)
  await page.goto("/settings")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export ZIP" }).click()
  const download = await downloadPromise
  const backupPath = testInfo.outputPath("backup.zip")
  await download.saveAs(backupPath)
  await page.goto("/decks")
  await page.getByRole("button", { name: "Options for Trip Japanese" }).click()
  await page.getByRole("menuitem", { name: "Delete deck" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click()
  await expect(
    page.getByRole("main").getByRole("link", { name: /Trip Japanese/ }),
  ).toHaveCount(0)
  await page.goto("/settings")
  await page.getByLabel("Import backup file").setInputFiles(backupPath)
  await expect(page.getByRole("alertdialog")).toContainText("5 decks")
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await page.goto("/decks")
  await page
    .getByRole("main")
    .getByRole("link", { name: /Trip Japanese/ })
    .click()
  await page.getByRole("button", { name: /^こんにちは/ }).click()
  await expect
    .poll(() =>
      page
        .getByRole("dialog")
        .locator(".markdown img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(192)
})

test("file routes keep deck filters and deep links on reload", async ({
  page,
}) => {
  await page.goto("/decks?tag=spanish")
  await expect(
    page.getByRole("main").getByRole("link", { name: /Everyday Spanish/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("main").getByRole("link", { name: /Design essentials/ }),
  ).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole("main").getByRole("link", { name: /Everyday Spanish/ }),
  ).toBeVisible()
  await page
    .getByRole("main")
    .getByRole("link", { name: /Everyday Spanish/ })
    .click()
  await expect(page).toHaveURL(/\/decks\/[^/?]+/)
  await page.reload()
  await expect(page.getByRole("button", { name: "Review deck" })).toBeVisible()
  await page.getByRole("button", { name: "Review deck" }).click()
  await expect(page).toHaveURL(/\/study\?deck=/)
  await expect(page.getByText(/0 of \d+ reviewed/)).toBeVisible()
})

test("tag filters search, clear, and preserve deck URLs", async ({ page }) => {
  await page.goto("/decks")
  await page.getByRole("combobox", { name: "Filter decks by tag" }).click()
  await page
    .getByRole("combobox", { name: "Search tags", exact: true })
    .fill("SPAN")
  await expect(
    page.getByRole("option", { name: "spanish", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("option", { name: "design", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("option", { name: "spanish", exact: true }).click()
  await expect(page).toHaveURL(/tag=spanish/)
  await page.reload()
  await expect(
    page.getByRole("combobox", { name: "Filter decks by tag" }),
  ).toContainText("spanish")
  await expect(
    page.getByRole("main").getByRole("link", { name: /Design essentials/ }),
  ).toHaveCount(0)
  await page.getByRole("combobox", { name: "Filter decks by tag" }).click()
  await page.getByRole("option", { name: "All tags", exact: true }).click()
  await expect(page).toHaveURL((url) => !url.searchParams.get("tag"))
  await expect(
    page.getByRole("main").getByRole("link", { name: /Design essentials/ }),
  ).toBeVisible()

  await page
    .getByRole("main")
    .getByRole("link", { name: /Everyday Spanish/ })
    .click()
  await page.getByRole("combobox", { name: "Filter cards by tag" }).click()
  await page
    .getByRole("combobox", { name: "Search tags", exact: true })
    .fill("no-such-tag")
  await expect(
    page.getByText("No matching tags", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("combobox", { name: "Search tags", exact: true })
    .fill("greet")
  await page
    .getByRole("combobox", { name: "Search tags", exact: true })
    .press("ArrowDown")
  await page
    .getByRole("combobox", { name: "Search tags", exact: true })
    .press("Enter")
  await expect(page.getByRole("button", { name: /^Buenos días/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Gracias/ })).toHaveCount(0)
  await page.getByRole("combobox", { name: "Filter cards by tag" }).click()
  await page.getByRole("option", { name: "All tags", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Gracias/ })).toBeVisible()
})

test("tag editors create, reuse, remove, and persist chips without submitting on Enter", async ({
  page,
}) => {
  await newDeck(page)
  await page.getByRole("button", { name: "Edit deck", exact: true }).click()
  await page
    .getByRole("button", { name: "Remove tag travel", exact: true })
    .click()
  const tagInput = page.getByRole("combobox", { name: "Tags optional" })
  await tagInput.fill("  Focus  ")
  await expect(
    page.getByRole("button", {
      name: "Save changes",
      exact: true,
      includeHidden: true,
    }),
  ).toBeDisabled()
  await expect(
    page.getByRole("option", { name: "Create “focus”", exact: true }),
  ).toBeVisible()
  await tagInput.press("Enter")
  await expect(
    page.getByRole("dialog", { name: "Edit deck", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Remove tag focus", exact: true }),
  ).toBeVisible()
  await tagInput.fill("FOCUS")
  await expect(
    page.getByRole("option", { name: "Create “focus”", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("option", { name: "focus", exact: true }),
  ).toHaveAttribute("aria-selected", "true")
  await tagInput.fill("")
  await page.getByLabel("Deck name").click()
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(
    page.getByRole("dialog", { name: "Edit deck", exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await page.getByRole("button", { name: "Edit deck", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Remove tag focus", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Remove tag travel", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Cancel", exact: true }).click()

  await page
    .getByRole("button", { name: "Add card", exact: true })
    .first()
    .click()
  await page.getByLabel("Prompt", { exact: true }).fill("Tagged prompt")
  await page.getByLabel("Answer", { exact: true }).fill("Tagged answer")
  await tagInput.fill("foc")
  await page.getByRole("option", { name: "focus", exact: true }).click()
  await tagInput.fill("all")
  await page.getByRole("option", { name: "Create “all”", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Remove tag focus", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add card", exact: true })
    .click()
  await expect(
    page.getByRole("dialog", {
      name: "One more thing to remember",
      exact: true,
    }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Add card", exact: true }).click()
  await page.getByLabel("Prompt", { exact: true }).fill("Untagged prompt")
  await page.getByLabel("Answer", { exact: true }).fill("Untagged answer")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add card", exact: true })
    .click()
  await expect(
    page.getByRole("dialog", {
      name: "One more thing to remember",
      exact: true,
    }),
  ).toHaveCount(0)
  await page.reload()
  await page.getByRole("combobox", { name: "Filter cards by tag" }).click()
  await page.getByRole("option", { name: "all", exact: true }).click()
  await expect(
    page.getByRole("button", { name: /^Tagged prompt/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /^Untagged prompt/ }),
  ).toHaveCount(0)
  await page.getByRole("combobox", { name: "Filter cards by tag" }).click()
  await page.getByRole("option", { name: "All tags", exact: true }).click()
  await expect(
    page.getByRole("button", { name: /^Untagged prompt/ }),
  ).toBeVisible()
})

test("tag drafts are guarded and tag controls remain accessible", async ({
  page,
}) => {
  await page.goto("/decks")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  const input = page.getByRole("combobox", { name: "Tags optional" })
  await input.fill("x".repeat(51))
  await expect(
    page.getByText("Use 50 characters or fewer per tag."),
  ).toBeVisible()
  await expect(page.getByRole("option", { name: /^Create/ })).toHaveCount(0)
  await input.press("Enter")
  await expect(
    page.getByRole("dialog", { name: "A new place to learn" }),
  ).toBeVisible()
  await input.fill("draft tag")
  await page.getByLabel("Deck name").click()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(
    page.getByRole("alertdialog", { name: "Discard changes?" }),
  ).toBeVisible()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
  await expect(input).toHaveValue("draft tag")
  await input.fill("science")
  await page.getByRole("option", { name: "science", exact: true }).click()
  await input.fill("lear")
  await expect(
    page.getByRole("option", { name: "learning", exact: true }),
  ).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze()
  expect(
    result.violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([])
})

test("tag chips enforce the tag limit without overflowing the editor", async ({
  page,
}) => {
  await page.goto("/decks")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  const input = page.getByRole("combobox", { name: "Tags optional" })
  const longTag = "t".repeat(50)
  for (const tag of [
    longTag,
    ...Array.from({ length: 29 }, (_, i) => `topic-${i}`),
  ]) {
    await input.fill(tag)
    await page
      .getByRole("option", { name: `Create “${tag}”`, exact: true })
      .click()
  }
  await expect(
    page.getByText("You can add up to 30 tags. Remove a tag to add another."),
  ).toBeVisible()
  await input.fill("extra")
  await expect(
    page.getByRole("option", { name: "Create “extra”", exact: true }),
  ).toBeDisabled()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
  await page.getByLabel("Deck name").click()
  await page
    .getByRole("button", { name: `Remove tag ${longTag}`, exact: true })
    .click()
  await input.fill("replacement")
  await page
    .getByRole("option", { name: "Create “replacement”", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Remove tag replacement", exact: true }),
  ).toBeVisible()
})

test("malformed search values fall back without breaking routes", async ({
  page,
}) => {
  await page.goto("/decks?tag=%5B%22spanish%22%5D")
  await expect(
    page.getByRole("main").getByRole("link", { name: /Everyday Spanish/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("main").getByRole("link", { name: /Design essentials/ }),
  ).toBeVisible()

  await page.goto("/study?deck=42")
  await expect(page.getByText("0 of 18 reviewed")).toBeVisible()
})

test("rejects an invalid import without replacing the library", async ({
  page,
}) => {
  await page.goto("/settings")
  await expect(page.getByText(/4 decks · 14 cards/)).toBeVisible()
  await page.getByLabel("Import backup file").setInputFiles({
    name: "broken.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("not a zip"),
  })
  await expect(
    page.getByRole("region", { name: "Notifications" }),
  ).toContainText(/zip|end of central directory/i)
  await expect(page.getByText(/4 decks · 14 cards/)).toBeVisible()
})

test("keeps unsaved edits until discard is confirmed", async ({ page }) => {
  await page.goto("/decks")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByLabel("Deck name").fill("Unsaved")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
  await expect(page.getByRole("alertdialog")).toBeVisible()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
  await expect(page.getByLabel("Deck name")).toHaveValue("Unsaved")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
  await page.getByRole("button", { name: "Discard", exact: true }).click()
  await expect(
    page.getByRole("dialog", { name: "A new place to learn" }),
  ).toHaveCount(0)
})

test("renders every screen without overflow or serious accessibility violations", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  for (const path of [
    "/",
    "/decks",
    "/tags",
    "/activity",
    "/settings",
    "/study",
  ]) {
    await page.goto(path)
    await expect(page.getByRole("main")).toBeVisible()
    await expect
      .poll(() => page.locator("h1, .study-card").count())
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
    await expect(page.getByRole("main").locator(":scope > div")).toHaveCSS(
      "opacity",
      "1",
    )
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (a) =>
                  a.playState === "running" &&
                  a.effect?.getTiming().iterations !== Infinity,
              ).length,
        ),
      )
      .toBe(0)
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze()
    expect(
      results.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  }
  await page.goto("/")
  await expect(page.getByRole("main").locator(":scope > div")).toHaveCSS(
    "opacity",
    "1",
  )
  await page.screenshot({
    path: testInfo.outputPath("overview.png"),
    fullPage: true,
    scale: "css",
  })
  await page.getByRole("button", { name: "Color theme", exact: true }).click()
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click()
  await page.reload()
  await expect(page.locator("html")).toHaveClass("dark")
  await expect(page.getByRole("main").locator(":scope > div")).toHaveCSS(
    "opacity",
    "1",
  )
  await page.screenshot({
    path: testInfo.outputPath("dark.png"),
    fullPage: true,
    scale: "css",
  })
  const darkResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze()
  expect(
    darkResults.violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map((v) => v.id),
  ).toEqual([])
  expect(errors).toEqual([])
})

test("theme controls share a persisted preference and follow system changes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  await expect(page.locator("html")).toHaveClass("dark")
  await page.getByRole("button", { name: "Color theme", exact: true }).click()
  await expect(
    page.getByRole("menuitemradio", { name: "System", exact: true }),
  ).toBeChecked()
  await page.keyboard.press("Escape")
  await page.emulateMedia({ colorScheme: "light" })
  await expect(page.locator("html")).not.toHaveClass("dark")

  await page.getByRole("button", { name: "Color theme", exact: true }).click()
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click()
  await expect(page.locator("html")).toHaveClass("dark")
  await page.goto("/settings")
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "System", exact: true }).click()
  await expect(page.locator("html")).not.toHaveClass("dark")
  await page.reload()
  await expect(
    page.getByRole("button", { name: "System", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(page.locator("html")).toHaveClass("dark")

  await page.getByRole("button", { name: "Light", exact: true }).click()
  await expect(page.locator("html")).not.toHaveClass("dark")
  await page.emulateMedia({ colorScheme: "light" })
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(page.locator("html")).not.toHaveClass("dark")
  await page.reload()
  await expect(page.locator("html")).not.toHaveClass("dark")
  await page.getByRole("button", { name: "Color theme", exact: true }).click()
  await expect(
    page.getByRole("menuitemradio", { name: "Light", exact: true }),
  ).toBeChecked()
})

test("overview reflects completed reviews and a cleared queue", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "18 reviews ready", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("0 reviewed today", { exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Dismiss starter note" }).click()
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Dismiss starter note" }),
  ).toHaveCount(0)
  await page
    .getByRole("button", { name: "Review Design essentials", exact: true })
    .click()
  for (let i = 0; i < 4; i++) {
    await expect(
      page.getByText(`${i} of 4 reviewed`, { exact: true }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Reveal answer" }).click()
    await page.getByRole("button", { name: /Easy/ }).click()
  }
  await expect(
    page.getByRole("heading", { name: "That’s time well spent." }),
  ).toBeVisible()
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "14 reviews ready", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("4 reviewed today", { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "Design essentials", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Start reviewing" }).click()
  for (let i = 0; i < 14; i++) {
    await expect(
      page.getByText(`${i} of 14 reviewed`, { exact: true }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Reveal answer" }).click()
    await page.getByRole("button", { name: /Easy/ }).click()
  }
  await expect(
    page.getByRole("heading", { name: "That’s time well spent." }),
  ).toBeVisible()
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "No reviews due now" }),
  ).toBeVisible()
  await expect(
    page.getByText("18 reviewed today", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Start reviewing" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Recently created decks" }),
  ).toBeVisible()
})

test("overview offers creation and restore for an empty library", async ({
  page,
}) => {
  await page.goto("/decks")
  for (const name of [
    "Everyday Spanish",
    "Design essentials",
    "The curious mind",
    "Modern JavaScript",
  ]) {
    await page
      .getByRole("button", { name: `Options for ${name}`, exact: true })
      .click()
    await page.getByRole("menuitem", { name: "Delete deck" }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
  }
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Create your first deck" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Start reviewing" }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Import backup", exact: true }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await page.goto("/")
  await page
    .getByRole("main")
    .getByRole("button", { name: "Create deck", exact: true })
    .click()
  await expect(page.getByLabel("Deck name")).toBeVisible()
})

test("loads and reviews offline after the first successful visit", async ({
  page,
  context,
}) => {
  await page.goto("/")
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
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: /Start reviewing/ }).click()
  await page.getByRole("button", { name: "Reveal answer" }).click()
  await page.getByRole("button", { name: /Easy/ }).click()
  await expect(page.getByText("1 of 18 reviewed")).toBeVisible()
  await context.setOffline(false)
})
