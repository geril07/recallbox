import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import JSZip from "jszip"

async function mockDrive(
  page: Page,
  options: {
    listStatus?: number
    empty?: boolean
    invalid?: boolean
    large?: boolean
  } = {},
) {
  let listStatus = options.listStatus ?? 200
  let connections = 0
  let uploads = 0
  let folderCreates = 0
  let downloads = 0
  let folderExists = !options.empty
  const backup = new JSZip().file(
    "recallbox.json",
    JSON.stringify({
      format: "recallbox",
      version: 1,
      exportedAt: new Date().toISOString(),
      decks: [],
      cards: [],
      reviews: [],
      assets: [],
    }),
  )
  const zip = await backup.generateAsync({ type: "nodebuffer" })
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    window.google = { accounts: { oauth2: {
      initTokenClient: ({callback}) => ({ requestAccessToken: () => {
        fetch('/test-connect', {method: 'POST'}).then(() => callback({access_token: 'test-token', expires_in: 3600}));
      }}),
      hasGrantedAllScopes: () => true,
      revoke: (_, done) => done()
    }}};
  `,
    }),
  )
  await page.route("**/test-connect", (route) => {
    connections++
    return route.fulfill({ body: "ok" })
  })
  await page.route("https://apis.google.com/js/api.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    window.gapi = { load: (_, options) => options.callback() };
    class DocsView {
      setIncludeFolders() { return this } setSelectFolderEnabled() { return this } setMimeTypes() { return this }
    }
    class PickerBuilder {
      addView() { return this } setTitle() { return this } setOAuthToken() { return this }
      setDeveloperKey() { return this } setAppId() { return this } setOrigin() { return this }
      setCallback(callback) { this.callback = callback; return this }
      build() {
        const overlay = document.createElement('div');
        overlay.style = 'position:fixed;inset:0;background:white;z-index:1000;padding:30px;color:black';
        for (const [label, action] of [['Pick test ZIP', 'picked'], ['Cancel Google chooser', 'cancel']]) {
          const button = document.createElement('button'); button.textContent = label;
          button.onclick = () => this.callback({action, docs: [{id:'external'}]}); overlay.append(button);
        }
        return { setVisible: () => document.body.append(overlay), dispose: () => overlay.remove() };
      }
    }
    window.google.picker = { DocsView, PickerBuilder, Action: { PICKED: 'picked', CANCEL: 'cancel' } };
  `,
    }),
  )
  await page.route("https://www.googleapis.com/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.headers().authorization).toBe("Bearer test-token")
    if (url.pathname.includes("/upload/")) {
      if (request.method() === "POST") {
        expect(request.postDataJSON().name).toMatch(/^recallbox-.*\.zip$/)
        await route.fulfill({
          status: 200,
          headers: {
            Location: "https://www.googleapis.com/upload/session",
            "Access-Control-Expose-Headers": "Location",
          },
        })
      } else {
        uploads++
        await route.fulfill({ status: 200, body: "{}" })
      }
    } else if (request.method() === "POST") {
      folderCreates++
      folderExists = true
      await route.fulfill({ json: { id: "folder", name: "Recallbox" } })
    } else if (url.searchParams.has("q")) {
      const folderQuery = url.searchParams.get("q")!.includes("appProperties")
      if (!folderQuery && listStatus !== 200) {
        const status = listStatus
        listStatus = 200
        await route.fulfill({ status, body: "error" })
      } else {
        if (!folderQuery)
          expect(url.searchParams.get("orderBy")).toBe("createdTime desc")
        await route.fulfill({
          json: {
            files: folderQuery
              ? folderExists
                ? [{ id: "folder", name: "Recallbox" }]
                : []
              : [
                  {
                    id: "backup",
                    name: "recallbox-test.zip",
                    createdTime: "2026-01-01T12:00:00Z",
                    size: String(zip.length),
                  },
                ],
          },
        })
      }
    } else if (url.searchParams.get("alt") === "media") {
      downloads++
      await route.fulfill({
        contentType: "application/zip",
        body: options.invalid ? Buffer.from("invalid ZIP") : zip,
      })
    } else {
      await route.fulfill({
        json: {
          id: "external",
          name: "external-backup.zip",
          size: String(options.large ? 101 * 1024 * 1024 : zip.length),
        },
      })
    }
  })
  await page.goto("/settings")
  return {
    connections: () => connections,
    uploads: () => uploads,
    folderCreates: () => folderCreates,
    downloads: () => downloads,
  }
}

test("Drive restore connects on demand, reviews first, and replaces only after confirmation", async ({
  page,
}) => {
  const mock = await mockDrive(page)
  await page.getByRole("button", { name: "Choose from Google Drive" }).click()
  const chooser = page.getByRole("dialog", { name: "Choose a Drive backup" })
  await expect(
    chooser.getByRole("button", {
      name: "Choose backup recallbox-test.zip",
      exact: true,
    }),
  ).toBeVisible()
  expect(mock.connections()).toBe(1)
  await page.screenshot({
    path: `artifacts/drive-chooser-${test.info().project.name}.png`,
    animations: "disabled",
  })
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([])
  await chooser.getByRole("button", { name: /Choose backup/ }).click()
  const review = page.getByRole("dialog", { name: "Review backup" })
  await expect(review).toContainText("Source: Google Drive")
  await expect(review).toBeVisible()
  await page.screenshot({
    path: `artifacts/drive-review-${test.info().project.name}.png`,
    animations: "disabled",
  })
  await expect(review).toContainText("0 decks · 0 cards")
  await expect(review).toContainText(
    "Your current library has 4 decks and 14 cards",
  )
  await review.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByText(/4 decks · 14 cards/)).toBeVisible()
  await page.getByRole("button", { name: "Choose from Google Drive" }).click()
  await page.getByRole("button", { name: /Choose backup/ }).click()
  await review.getByRole("button", { name: "Replace library" }).click()
  await expect(review).toHaveCount(0)
  await expect(page.getByText(/0 decks · 0 cards/)).toBeVisible()
  expect(mock.connections()).toBe(1)
})

for (const status of [401, 503])
  test(`Drive list failure ${status} is not an empty state and can be retried`, async ({
    page,
  }) => {
    const mock = await mockDrive(page, { listStatus: status })
    await page.getByRole("button", { name: "Choose from Google Drive" }).click()
    const chooser = page.getByRole("dialog")
    await expect(chooser.getByRole("alert")).toBeVisible()
    await expect(chooser).not.toContainText("No backups")
    await chooser
      .getByRole("button", {
        name: status === 401 ? "Reconnect and retry" : "Retry",
        exact: true,
      })
      .click()
    await expect(
      chooser.getByRole("button", { name: /Choose backup/ }),
    ).toBeVisible()
    expect(mock.connections()).toBe(status === 401 ? 2 : 1)
  })

test("browsing an empty Drive does not create a folder; saving creates one and uploads", async ({
  page,
}) => {
  const mock = await mockDrive(page, { empty: true })
  await page.getByRole("button", { name: "Choose from Google Drive" }).click()
  await expect(page.getByRole("dialog")).toContainText(
    "No backups in your Recallbox folder yet",
  )
  expect(mock.folderCreates()).toBe(0)
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Save to Google Drive" }).click()
  await expect(
    page.getByRole("region", { name: "Notifications" }),
  ).toContainText("Saved to Google Drive: recallbox-")
  expect(mock.uploads()).toBe(1)
  expect(mock.folderCreates()).toBe(1)
  await page.getByRole("button", { name: "Disconnect", exact: true }).click()
  await expect(page.getByText("Google Drive · Not connected")).toBeVisible()
})

test("other Drive files can be selected and cancellation returns to recent backups", async ({
  page,
}) => {
  await mockDrive(page)
  await page.getByRole("button", { name: "Choose from Google Drive" }).click()
  await page
    .getByRole("button", { name: "Choose another file in Drive" })
    .click()
  await page.getByRole("button", { name: "Cancel Google chooser" }).click()
  await expect(
    page.getByRole("dialog", { name: "Choose a Drive backup" }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Choose another file in Drive" })
    .click()
  await page.getByRole("button", { name: "Pick test ZIP" }).click()
  await expect(
    page.getByRole("dialog", { name: "Review backup" }),
  ).toContainText("external-backup.zip")
})

for (const kind of ["invalid", "large"] as const)
  test(`rejects ${kind} Drive backup without replacing local data`, async ({
    page,
  }) => {
    const mock = await mockDrive(page, { [kind]: true })
    await page.getByRole("button", { name: "Choose from Google Drive" }).click()
    await page
      .getByRole("button", { name: "Choose another file in Drive" })
      .click()
    await page.getByRole("button", { name: "Pick test ZIP" }).click()
    await expect(page.getByRole("alert")).toContainText(
      kind === "large" ? /100 MB/ : /zip|central directory/i,
    )
    await expect(
      page.getByRole("dialog", { name: "Review backup" }),
    ).toHaveCount(0)
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(page.getByText(/4 decks · 14 cards/)).toBeVisible()
    if (kind === "large") expect(mock.downloads()).toBe(0)
  })
