import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "./tests/browser",
    testMatch: "commerce-design.spec.ts",
    workers: 1,
    retries: 0,
    use: {
        baseURL: "http://127.0.0.1:3107",
        browserName: "chromium",
        contextOptions: { reducedMotion: "reduce" },
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    webServer: {
        command: "node tests/fixtures/commerce/server.mjs",
        url: "http://127.0.0.1:3107",
        reuseExistingServer: false,
        timeout: 60000,
    },
});
