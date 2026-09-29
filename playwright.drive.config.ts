import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/drive",
  fullyParallel: true,
  timeout: 45000,
  use: {
    baseURL: "http://localhost:4174",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "npx vite build --outDir artifacts/drive-build && npx vite preview --outDir artifacts/drive-build --host 127.0.0.1 --port 4174",
    url: "http://localhost:4174",
    reuseExistingServer: false,
    env: {
      VITE_GOOGLE_CLIENT_ID: "test-client",
      VITE_GOOGLE_API_KEY: "test-key",
      VITE_GOOGLE_PROJECT_NUMBER: "123456789",
    },
  },
})
