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
  await page.getByRole("tab", { name: "Reverse", exact: true }).click()
  await expect(
    page
      .getByRole("tabpanel", { name: "Reverse" })
      .locator(".preview-question"),
  ).toContainText("Hello")
  await expect(
    page.getByRole("tabpanel", { name: "Reverse" }).locator(".preview-answer"),
  ).toContainText("こんにちは")
  await page.getByRole("tab", { name: "Forward", exact: true }).click()
  await expect(
    page
      .getByRole("tabpanel", { name: "Forward" })
      .locator(".preview-question"),
  ).toContainText("こんにちは")
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
  await expect(page.getByText("Reverse", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Show answer" }).click()
  await expect(page.locator(".study-answer")).toContainText("こんにちは")
  await page.getByRole("button", { name: /Easy/ }).click()
  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Back to deck" }).click()
  await expect(page).toHaveURL(deckUrl)
  await expect(page.getByText("You’re all caught up")).toBeVisible()
  expect(errors).toEqual([])
})

test("forward-only preview has no direction switch or filler", async ({
  page,
}) => {
  await newDeck(page)
  await page
    .getByRole("button", { name: "Add card", exact: true })
    .first()
    .click()
  await page.getByLabel("Prompt", { exact: true }).fill("Why is the sky blue?")
  await page.getByLabel("Answer", { exact: true }).fill("Rayleigh scattering")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add card", exact: true })
    .click()
  await page.getByRole("button", { name: /^Why is the sky blue/ }).click()
  const preview = page.getByRole("dialog", { name: "Card preview" })
  await expect(preview).toBeVisible()
  await expect(preview.getByRole("tablist")).toHaveCount(0)
  await expect(preview).not.toContainText("A little piece of your knowledge.")
  await expect(preview.locator(".preview-question")).toContainText(
    "Why is the sky blue?",
  )
  await expect(preview.locator(".preview-answer")).toContainText(
    "Rayleigh scattering",
  )
})

test("deck stays still and highlighted when the pointer enters its menu", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Hover requires a mouse")
  await newDeck(page)
  await page.goto("/decks")
  const tile = page.locator(".deck-tile").filter({ hasText: "Trip Japanese" })
  await page.mouse.move(0, 0)
  const initial = await tile.boundingBox()
  const initialBackground = await tile.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  await tile.hover()
  await expect(tile).toHaveCSS("transform", "none")
  const trigger = tile.getByRole("button", {
    name: "Options for Trip Japanese",
  })
  await trigger.click()
  await page.getByRole("menuitem", { name: "Edit deck", exact: true }).hover()
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await expect(tile).not.toHaveCSS("background-color", initialBackground)
  await page.keyboard.press("Escape")
  await page.mouse.move(0, 0)
  await expect(tile).toHaveCSS("background-color", initialBackground)
  expect(await tile.boundingBox()).toEqual(initial)
})

test("review keeps navigation and progress while isolating shortcuts from menus and help", async ({
  page,
}) => {
  await page.goto("/study")
  await expect(page.getByRole("button", { name: "Show answer" })).toBeVisible()
  const progress = page.getByRole("progressbar", { name: "Session progress" })
  await expect(progress).toHaveAttribute("aria-valuenow", "0")
  expect(
    await progress.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeGreaterThan(100)
  await expect(page.getByText("FOCUS MODE", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "End session" })).toHaveCount(0)

  await page.getByRole("button", { name: "Color theme", exact: true }).click()
  await page.keyboard.press("Space")
  await expect(page.locator(".study-answer")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Review help", exact: true }).click()
  const help = page.getByRole("dialog", { name: "Review help", exact: true })
  await expect(help).toContainText("Each direction appears once per session")
  await help.focus()
  await page.keyboard.press("Space")
  await expect(page.locator(".study-answer")).toHaveCount(0)
  await help.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Show answer" }).click()
  await expect(page.locator(".study-actions").getByRole("button")).toHaveCount(
    4,
  )

  await page.getByRole("button", { name: "Review help", exact: true }).click()
  await expect(
    help.getByRole("heading", { name: "Estimated next review" }),
  ).toBeVisible()
  await page.keyboard.press("3")
  await expect(page.locator(".study-progress")).toContainText(
    "0 of 18 reviewed",
  )
  await help.getByRole("button", { name: "Close", exact: true }).click()
  await expect(help).toHaveCount(0)
  await page.keyboard.press("3")
  await expect(
    page.getByText("1 of 18 reviewed", { exact: true }),
  ).toBeVisible()
  await expect(progress).toHaveAttribute("aria-valuenow", /5\.5/)

  const navigation = page.getByRole("button", { name: "Open navigation" })
  if (await navigation.isVisible()) await navigation.click()
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Overview", exact: true })
    .click()
  await expect(
    page.getByText("1 reviewed today", { exact: true }),
  ).toBeVisible()
})

test("long review answers scroll without hiding controls or the end of the answer", async ({
  page,
}, testInfo) => {
  await newDeck(page)
  const deckUrl = page.url()
  for (const [prompt, answer] of [
    [
      "Long answer",
      [
        "First answer line.",
        ...Array.from(
          { length: 45 },
          (_, i) =>
            `Paragraph ${i + 1}. A longer explanation to read before rating this card.`,
        ),
        "Final answer line.",
      ].join("\n\n"),
    ],
    ["Next prompt", "Short answer"],
  ]) {
    await page
      .getByRole("button", { name: "Add card", exact: true })
      .first()
      .click()
    await page.getByLabel("Prompt", { exact: true }).fill(prompt)
    await page.getByLabel("Answer", { exact: true }).fill(answer)
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add card", exact: true })
      .click()
    await expect(
      page.getByRole("dialog", { name: "One more thing to remember" }),
    ).toHaveCount(0)
  }
  await page.getByRole("button", { name: "Review deck" }).click()
  await page.getByRole("button", { name: "Show answer" }).click()
  const body = page.getByRole("region", { name: "Review card" })
  const actions = page.locator(".study-actions")
  await expect(
    page.getByRole("heading", { name: "Answer", exact: true }),
  ).toBeInViewport()
  for (const label of ["Again", "Hard", "Good", "Easy"]) {
    await expect(
      actions.getByRole("button", { name: new RegExp(`^${label}`) }),
    ).toBeInViewport({ ratio: 1 })
  }
  await body.evaluate((element) =>
    element.scrollTo({ top: element.scrollHeight }),
  )
  await expect(
    page.getByText("Final answer line.", { exact: true }),
  ).toBeInViewport({ ratio: 1 })
  expect(
    await page
      .getByText("Final answer line.", { exact: true })
      .evaluate((element) => element.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(
    await actions.evaluate((element) => element.getBoundingClientRect().top),
  )
  await expect(
    page.getByRole("button", { name: "Color theme", exact: true }),
  ).toBeInViewport()
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme })
    if (colorScheme === "dark")
      await expect(page.locator("html")).toHaveClass("dark")
    else await expect(page.locator("html")).not.toHaveClass("dark")
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.playState === "running" &&
                  animation.effect?.getTiming().iterations !== Infinity,
              ).length,
        ),
      )
      .toBe(0)
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze()
    expect(
      accessibility.violations
        .filter(
          (violation) =>
            violation.impact === "serious" || violation.impact === "critical",
        )
        .map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => node.target),
        })),
    ).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath(`long-answer-${colorScheme}.png`),
      scale: "css",
    })
  }
  await actions.getByRole("button", { name: /^Again/ }).click()
  await expect(page.getByText("1 of 2 reviewed", { exact: true })).toBeVisible()
  await expect(page.locator(".study-question")).toContainText("Next prompt")
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(0)
  await page.getByRole("button", { name: "Show answer" }).click()
  await actions.getByRole("button", { name: /^Easy/ }).click()
  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible()
  await expect(
    page.getByText("2 reviews completed. Progress saved in this browser.", {
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Back to deck" }).click()
  await expect(page).toHaveURL(deckUrl)
})

test("review save errors retain the answer and offer a working reload", async ({
  page,
  context,
}) => {
  await newDeck(page)
  await newCard(page)
  const deckUrl = page.url()
  await page.getByRole("button", { name: "Review deck" }).click()
  await page.getByRole("button", { name: "Show answer" }).click()
  const editor = await context.newPage()
  await editor.goto(deckUrl)
  await editor
    .getByRole("button", { name: "Edit こんにちは", exact: true })
    .click()
  await editor.getByLabel("Answer", { exact: true }).fill("Updated answer")
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click()
  await expect(
    editor.getByRole("dialog", { name: "Edit card", exact: true }),
  ).toHaveCount(0)
  await editor.close()
  await page.getByRole("button", { name: /^Good/ }).click()
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your last answer was not counted",
  )
  await expect(page.getByText("0 of 2 reviewed", { exact: true })).toBeVisible()
  await expect(page.locator(".study-answer")).toContainText("Hello")
  await page.getByRole("button", { name: "Reload session" }).click()
  await page.getByRole("button", { name: "Show answer" }).click()
  await expect(page.locator(".study-answer")).toContainText("Updated answer")
  await page.getByRole("button", { name: /^Good/ }).click()
  await expect(page.getByText("1 of 2 reviewed", { exact: true })).toBeVisible()
})

test("ZIP restore recovers a deleted deck and its local image", async ({
  page,
}, testInfo) => {
  await newDeck(page)
  await newCard(page, true)
  await page.goto("/settings")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download ZIP" }).click()
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
  const review = page.getByRole("dialog", { name: "Review backup" })
  await expect(review).toContainText("5 decks")
  await expect(review).toContainText("Source: This device")
  await expect(review).toContainText("It does not merge.")
  const safetyDownload = page.waitForEvent("download")
  await review
    .getByRole("button", { name: "Download current library first" })
    .click()
  await safetyDownload
  await page
    .getByRole("button", { name: "Replace library", exact: true })
    .click()
  await expect(review).toHaveCount(0)
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
  await expect(page.getByRole("alert")).toContainText(
    /zip|end of central directory/i,
  )
  await expect(page.getByRole("dialog", { name: "Review backup" })).toHaveCount(
    0,
  )
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

test("mobile sheet slides and fades without a backdrop flash, and respects reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible()
  await page.evaluate(() => {
    document.addEventListener("transitionrun", (event) => {
      if (
        !(event.target instanceof HTMLElement) ||
        !event.target.matches(".mobile-nav-dialog") ||
        event.propertyName !== "translate" ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return
      // Pause at the midpoint so the assertions do not depend on machine speed.
      for (const animation of event.target.getAnimations()) {
        if (
          animation instanceof CSSTransition &&
          animation.transitionProperty === "translate"
        ) {
          animation.pause()
          animation.currentTime =
            Number(animation.effect?.getTiming().duration) / 2
        }
      }
    })
  })
  const drawer = page.locator(".mobile-nav-dialog")
  const backdrop = page.locator('[data-slot="sheet-overlay"]')
  const open = page.getByRole("button", { name: "Open navigation" })
  await open.click()
  await expect
    .poll(() =>
      drawer.evaluate((element) =>
        element
          .getAnimations()
          .some((animation) => animation.playState === "paused"),
      ),
    )
    .toBe(true)
  const entering = await drawer.evaluate((element) =>
    element.getBoundingClientRect().toJSON(),
  )
  expect(entering.x).toBeLessThan(0)
  expect(entering.right).toBeGreaterThan(0)
  expect(entering.y).toBe(0)
  await drawer.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.play()),
  )
  await expect
    .poll(() => drawer.evaluate((element) => element.getBoundingClientRect().x))
    .toBe(0)

  await page.getByRole("button", { name: "Close navigation" }).click()
  await expect
    .poll(() =>
      drawer.evaluate((element) =>
        element
          .getAnimations()
          .some((animation) => animation.playState === "paused"),
      ),
    )
    .toBe(true)
  const exiting = await drawer.evaluate((element) =>
    element.getBoundingClientRect().toJSON(),
  )
  expect(exiting.x).toBeLessThan(0)
  expect(exiting.right).toBeGreaterThan(0)
  await expect
    .poll(() =>
      backdrop.evaluate((element) => getComputedStyle(element).opacity),
    )
    .toBe("0")
  await page.waitForTimeout(100)
  expect(
    await backdrop.evaluate((element) => getComputedStyle(element).opacity),
  ).toBe("0")
  await drawer.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.play()),
  )
  await expect(drawer).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: "reduce" })
  await open.click()
  await expect(
    page.getByRole("link", { name: "Recallbox home" }),
  ).toBeInViewport()
  const duration = await drawer.evaluate(
    (element) =>
      Number.parseFloat(getComputedStyle(element).transitionDuration) * 1000,
  )
  expect(duration).toBeLessThanOrEqual(1)
  await page.getByRole("button", { name: "Close navigation" }).click()
  await expect(drawer).toHaveCount(0)
})

test("desktop sidebar aligns with the header and collapses smoothly", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop sidebar only")
  await page.goto("/decks")
  const sidebar = page.getByRole("complementary", { name: "Main sidebar" })
  const brand = sidebar.locator(".brand")
  const header = page.locator(".topbar")
  const brandBox = await brand.boundingBox()
  const headerBox = await header.boundingBox()
  expect(brandBox).not.toBeNull()
  expect(headerBox).not.toBeNull()
  expect(
    Math.abs(
      brandBox!.y +
        brandBox!.height / 2 -
        (headerBox!.y + headerBox!.height / 2),
    ),
  ).toBeLessThan(1)
  const width = (await sidebar.boundingBox())!.width
  await page.getByRole("button", { name: "Collapse sidebar" }).click()
  const collapsed = page.locator("#desktop-sidebar")
  const frames = await collapsed.evaluate(async (element) => {
    const samples: { sidebar: number; main: number }[] = []
    const main = document.querySelector(".app-main")!
    for (let i = 0; i < 20; i++) {
      await new Promise(requestAnimationFrame)
      samples.push({
        sidebar: element.getBoundingClientRect().width,
        main: main.getBoundingClientRect().left,
      })
    }
    return samples
  })
  expect(
    frames.some((frame) => frame.sidebar > 0 && frame.sidebar < width),
  ).toBe(true)
  for (const frame of frames)
    expect(Math.abs(frame.sidebar - frame.main)).toBeLessThan(1)
  await expect(collapsed).toHaveCSS("width", "0px")
  await expect(collapsed).toHaveAttribute("inert", "")
  await expect(page.locator(".app-main")).toHaveCSS("margin-left", "0px")
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Expand sidebar" }).click()
  await expect(sidebar).toHaveCSS("width", `${width}px`)
  await expect(sidebar).not.toHaveAttribute("inert")
  await expect(page.locator(".app-main")).toHaveCSS("margin-left", `${width}px`)
  await sidebar.getByRole("link", { name: "Tags", exact: true }).click()
  await expect(page).toHaveURL(/\/tags$/)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: "Collapse sidebar" }).click()
  await expect(collapsed).toHaveCSS("width", "0px")
  await expect(collapsed).toHaveCSS("transition-duration", "1e-05s")
})

test("shows the brand mark in navigation and serves the favicon and app icons", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible()
  const navigationButton = page.getByRole("button", { name: "Open navigation" })
  if (await navigationButton.isVisible()) await navigationButton.click()
  const home = page.getByRole("link", { name: "Recallbox home" })
  await expect(home).toBeInViewport()
  await expect(home.locator(".brand-mark")).toHaveCSS(
    "mask-image",
    /brand-mark\.svg/,
  )
  for (const path of [
    "/brand-mark.svg",
    "/icon.svg",
    "/icon-192.png",
    "/icon-512.png",
    "/icon-maskable-512.png",
  ]) {
    const response = await page.request.get(path)
    expect(response.ok()).toBeTruthy()
    expect(response.headers()["content-type"]).toMatch(/image\/(svg\+xml|png)/)
  }
  await home.click()
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible()
})

test("renders every screen without overflow or serious accessibility violations", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme })
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
  }
  await page.emulateMedia({ colorScheme: "light" })
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
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#171717",
  )
  await page.getByRole("button", { name: "Color theme", exact: true }).click()
  await expect(
    page.getByRole("menuitemradio", { name: "System", exact: true }),
  ).toBeChecked()
  await page.keyboard.press("Escape")
  await page.emulateMedia({ colorScheme: "light" })
  await expect(page.locator("html")).not.toHaveClass("dark")
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#fafafa",
  )

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
    await page.getByRole("button", { name: "Show answer" }).click()
    await page.getByRole("button", { name: /Easy/ }).click()
  }
  await expect(
    page.getByRole("heading", { name: "Session complete" }),
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
    await page.getByRole("button", { name: "Show answer" }).click()
    await page.getByRole("button", { name: /Easy/ }).click()
  }
  await expect(
    page.getByRole("heading", { name: "Session complete" }),
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
  await page.getByRole("button", { name: "Show answer" }).click()
  await page.getByRole("button", { name: /Easy/ }).click()
  await expect(page.getByText("1 of 18 reviewed")).toBeVisible()
  await context.setOffline(false)
})
