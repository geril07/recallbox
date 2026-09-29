import { expect, test, type Locator, type Page } from "@playwright/test"

// Hold a real transaction so local operations remain pending without mocking app code.
async function holdLibrary(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("recallbox")
        open.addEventListener("error", () => reject(open.error))
        open.addEventListener("success", () => {
          const db = open.result
          const transaction = db.transaction(
            Array.from(db.objectStoreNames),
            "readwrite",
          )
          let held = true
          const finished = new Promise<void>((done) => {
            transaction.addEventListener("complete", () => {
              db.close()
              done()
            })
          })
          Object.assign(window, {
            releaseLibrary: () => {
              held = false
              return finished
            },
          })
          function keepAlive() {
            const request = transaction
              .objectStore("settings")
              .get("__loading_test__")
            request.addEventListener("success", () => {
              resolve()
              if (held) keepAlive()
            })
          }
          keepAlive()
        })
      }),
  )
  return () =>
    page.evaluate(() =>
      (
        window as unknown as { releaseLibrary: () => Promise<void> }
      ).releaseLibrary(),
    )
}

async function checkPending(page: Page, button: Locator) {
  await button.scrollIntoViewIfNeeded()
  await page.evaluate(() => document.fonts.ready)
  const before = await button.boundingBox()
  const release = await holdLibrary(page)
  try {
    await button.click()
    await expect(button).toHaveAttribute("aria-busy", "true")
    await expect(button).toBeDisabled()
    expect(await button.boundingBox()).toEqual(before)
    await expect(page.locator("button[aria-busy=true]")).toHaveCount(1)
  } finally {
    await release()
  }
}

test("editor saves and delete confirmations keep their button size while pending", async ({
  page,
}) => {
  await page.goto("/decks")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByLabel("Deck name").fill("Loading checks")
  await checkPending(
    page,
    page.getByRole("button", { name: "Create deck", exact: true }),
  )
  await expect(
    page.getByRole("dialog", { name: "A new place to learn" }),
  ).toHaveCount(0)
  await page
    .getByRole("main")
    .getByRole("link", { name: "Loading checks" })
    .click()
  await page
    .getByRole("button", { name: "Add card", exact: true })
    .first()
    .click()
  await page.getByLabel("Prompt", { exact: true }).fill("Pending prompt")
  await page.getByLabel("Answer", { exact: true }).fill("Pending answer")
  await checkPending(
    page,
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Add card", exact: true }),
  )
  await expect(
    page.getByRole("dialog", { name: "One more thing to remember" }),
  ).toHaveCount(0)
  await page
    .getByRole("button", { name: "Delete Pending prompt", exact: true })
    .click()
  await checkPending(
    page,
    page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true }),
  )
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Delete Pending prompt", exact: true }),
  ).toHaveCount(0)
})

test("ZIP creation and restore actions stay in their buttons", async ({
  page,
}) => {
  await page.goto("/settings")
  const downloadButton = page.getByRole("button", {
    name: "Download ZIP",
    exact: true,
  })
  const download = page.waitForEvent("download")
  await checkPending(page, downloadButton)
  await expect(page.locator(".backup-progress")).toHaveCount(0)
  const file = await download
  const path = test.info().outputPath("loading-backup.zip")
  await file.saveAs(path)
  await expect(downloadButton).toBeEnabled()
  await page.getByLabel("Import backup file").setInputFiles(path)
  const review = page.getByRole("dialog", { name: "Review backup" })
  await expect(review).toBeVisible()
  const safetyDownload = page.waitForEvent("download")
  await checkPending(
    page,
    review.getByRole("button", { name: "Download current library first" }),
  )
  await safetyDownload
  await expect(
    review.getByRole("button", { name: "Replace library" }),
  ).toBeEnabled()
  await checkPending(
    page,
    review.getByRole("button", { name: "Replace library" }),
  )
  await expect(review).toHaveCount(0)
})
