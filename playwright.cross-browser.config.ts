import { defineConfig, devices } from "@playwright/test";

/**
 * Cross-browser config for the hero accent verification suite.
 *
 * Default: runs locally against Playwright-bundled WebKit + Firefox.
 * With BrowserStack: `npx browserstack-node-sdk playwright test --config=playwright.cross-browser.config.ts`
 * uses the platforms declared in browserstack.yml (real Safari + Firefox).
 */
export default defineConfig({
  testDir: "./tests/cross-browser",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-cross-browser" }]],
  use: {
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
