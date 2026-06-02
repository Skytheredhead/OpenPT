import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  timeout: 30_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: 'OPENPT_DATA_DIR="$(mktemp -d)" OPENPT_ACCOUNT_EMAIL_DEBUG=1 HOST=127.0.0.1 PORT=5173 npm run dev',
    url: "http://127.0.0.1:5173/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
