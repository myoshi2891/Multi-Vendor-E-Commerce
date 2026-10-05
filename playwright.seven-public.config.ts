import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "./tests/e2e",
    testMatch: "seven-public-design.spec.ts",
    outputDir: "test-results/seven-public",
    workers: 1,
    retries: 0,
    timeout: 90000,
    use: {
        baseURL: "http://localhost:3122",
        browserName: "chromium",
        contextOptions: { reducedMotion: "reduce" },
        trace: "retain-on-failure",
    },
    webServer: {
        command:
            "NEXT_DEV_DIST_DIR=.next/seven-public bun run dev -- --port 3122",
        url: "http://localhost:3122/seller/apply",
        reuseExistingServer: false,
        timeout: 90000,
    },
});
