import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  // 全体タイムアウト（ハング防止の安全ネット）。本番ビルド起動（next build）と
  // 3ブラウザ分の全スイートを 1 worker で直列実行する wall-clock を含むため 20 分とする。
  // 600s では build + 全テストが収まらず途中で "did not run" 打ち切りが発生していた。
  globalTimeout: 1200 * 1000,
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
    locale: "en-US",
    timezoneId: "UTC",
    contextOptions: {
      reducedMotion: "reduce",
    },
  },
  webServer: {
    // 既定は本番ビルド（next build && next start）で起動する。
    // 理由: (1) dev/Turbopack の長時間実行不安定によるサーバー停止を回避し、
    //       実行途中の ERR_CONNECTION_REFUSED 連鎖を防ぐ、
    //       (2) Next.js dev ツールのオーバーレイ（"Open Next.js Dev Tools" ボタン）が
    //       消え、getByRole('button',{name:'Next'}) 衝突や a11y(axe) の dev 由来
    //       false positive が無くなる、(3) CI/本番の実態と一致する。
    // ローカルの高速反復には E2E_USE_DEV=1 で従来の dev 起動へ退避できる。
    command: process.env.E2E_USE_DEV
      ? "bun run dev"
      : "bun run build && bun run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // build を含むため十分なタイムアウトを確保（ビルド + 起動）
    timeout: 600 * 1000,
    stdout: "pipe", // サーバー出力を表示（起動状況・クラッシュの可視化）
    stderr: "pipe",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
