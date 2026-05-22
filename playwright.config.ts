import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTimeout: 600 * 1000, // 全体タイムアウト 10分（globalSetup ハング防止の安全ネット）
  testDir: "./tests/e2e",
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
    // Visual Regression: スクリーンショット差分の許容ピクセル比率
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  fullyParallel: true,
  // Serial execution is required to prevent shared DB and auth session conflicts
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Visual Regression のため、アニメーション・ロケール・タイムゾーンを固定
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
  },
  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300 * 1000,
    stdout: "pipe", // dev サーバーの出力を表示（起動状況の可視化）
    stderr: "pipe",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
