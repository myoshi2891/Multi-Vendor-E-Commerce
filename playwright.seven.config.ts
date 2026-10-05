import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "./tests/browser",
    testMatch: "seven-design.spec.ts",
    workers: 1,
    retries: 0,
    use: {
        baseURL: "http://127.0.0.1:3121",
        browserName: "chromium",
        contextOptions: { reducedMotion: "reduce" },
        trace: "retain-on-failure",
    },
    webServer: {
        command: "node tests/fixtures/seven/server.mjs",
        url: "http://127.0.0.1:3121",
        reuseExistingServer: false,
        timeout: 60000,
    },
});
