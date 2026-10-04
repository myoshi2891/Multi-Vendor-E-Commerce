import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "./tests/e2e",
    testMatch: "priority-public-design.spec.ts",
    workers: 1,
    retries: 0,
    use: {
        baseURL: "http://localhost:3109",
        browserName: "chromium",
        contextOptions: { reducedMotion: "reduce" },
        trace: "retain-on-failure",
    },
    webServer: {
        command: "bun run dev -- --port 3109",
        url: "http://localhost:3109",
        reuseExistingServer: false,
        timeout: 60000,
    },
});
