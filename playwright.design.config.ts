import { defineConfig } from "@playwright/test";

/**
 * デザイン移行のブラウザー検証（tests/browser/）専用の Playwright 設定。
 *
 * 本体 E2E（playwright.config.ts）と分けている理由: Playwright の `webServer` は
 * config 単位で、project 単位では選べない。1 本に統合すると本体 E2E のたびに
 * 検証用サーバーがすべて起動してしまう。代わりに、ここでは `DESIGN_SUITE` で
 * 1 suite を選び、その suite のサーバーだけを起動する。
 *
 * 新しい検証を追加するときは、config ファイルを新設せず、下の DESIGN_SUITES に
 * 1 行追加する（.claude/rules/05-playwright-harness.md、
 * .agent/skills/playwright-browser-verification/SKILL.md）。
 *
 * 実行: DESIGN_SUITE=<suite> bun run test:design
 */

type DesignSuite = {
    /** tests/browser/ 配下の spec ファイル名 */
    testMatch: string;
    port: number;
    /** fixture: 部品を bundle した検証用サーバー（DB 不要）/ route: dev サーバー上の実ルート */
    kind: "fixture" | "route";
    command: string;
    /** webServer の起動確認に使うパス（既定: "/"） */
    readyPath?: string;
    /** test と webServer のタイムアウト（ms、既定: test は Playwright 既定値、webServer は 60000） */
    timeout?: number;
    screenshot?: "off" | "on" | "only-on-failure";
};

const DESIGN_SUITES = {
    commerce: {
        testMatch: "commerce-design.spec.ts",
        port: 3107,
        kind: "fixture",
        command: "node tests/fixtures/commerce/server.mjs",
        screenshot: "only-on-failure",
    },
    "priority-public": {
        testMatch: "priority-public-design.spec.ts",
        port: 3109,
        kind: "route",
        command: "bun run dev -- --port 3109",
    },
    priority: {
        testMatch: "priority-design.spec.ts",
        port: 3110,
        kind: "fixture",
        command: "node tests/fixtures/priority/server.mjs",
    },
    seven: {
        testMatch: "seven-design.spec.ts",
        port: 3121,
        kind: "fixture",
        command: "node tests/fixtures/seven/server.mjs",
    },
    "seven-public": {
        testMatch: "seven-public-design.spec.ts",
        port: 3122,
        kind: "route",
        // 並行起動中の別 dev サーバーと .next を共有しないよう distDir を分ける
        command:
            "NEXT_DEV_DIST_DIR=.next/seven-public bun run dev -- --port 3122",
        readyPath: "/seller/apply",
        timeout: 90000,
    },
} as const satisfies Record<string, DesignSuite>;

type DesignSuiteName = keyof typeof DESIGN_SUITES;

const isDesignSuiteName = (value: string): value is DesignSuiteName =>
    Object.hasOwn(DESIGN_SUITES, value);

const suiteName = process.env.DESIGN_SUITE?.trim() ?? "";
if (!isDesignSuiteName(suiteName)) {
    throw new Error(
        `DESIGN_SUITE が未指定または不正です（"${suiteName}"）。有効値: ${Object.keys(DESIGN_SUITES).join(" / ")}`
    );
}
const suite: DesignSuite = DESIGN_SUITES[suiteName];

// fixture サーバーは 127.0.0.1 で listen する。実ルートは Clerk・cookie の domain に合わせて localhost を使う
const host = suite.kind === "fixture" ? "127.0.0.1" : "localhost";
const baseURL = `http://${host}:${suite.port}`;

export default defineConfig({
    testDir: "./tests/browser",
    testMatch: suite.testMatch,
    outputDir: `test-results/design/${suiteName}`,
    workers: 1,
    retries: 0,
    ...(suite.timeout ? { timeout: suite.timeout } : {}),
    use: {
        baseURL,
        browserName: "chromium",
        contextOptions: { reducedMotion: "reduce" },
        trace: "retain-on-failure",
        ...(suite.screenshot ? { screenshot: suite.screenshot } : {}),
    },
    webServer: {
        command: suite.command,
        url: `${baseURL}${suite.readyPath ?? ""}`,
        reuseExistingServer: false,
        timeout: suite.timeout ?? 60000,
        // 未指定だと SIGKILL で終了され、fixture サーバーの SIGTERM ハンドラー（OS tmp の
        // bundle 出力の削除）が動かずに tmp が残り続ける
        gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
});
