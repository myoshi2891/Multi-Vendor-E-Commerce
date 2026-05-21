#!/usr/bin/env tsx
/**
 * Coverage Dashboard CLI.
 *
 * 実行: `bun run coverage:dashboard` または `tsx scripts/coverage-dashboard/build.ts`
 *
 * 出力: docs/coverage-dashboard.html
 *   - リポジトリ内のテストファイルをスキャン
 *   - coverage/lcov.info があればパースしてカバレッジ%を統合
 *   - Editorial Laboratory 美学の単一 HTML を生成
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildMatrix } from "./build-matrix";
import { parseLcov } from "./parse-lcov";
import { renderHtml } from "./render-html";
import { scanTests } from "./scan-tests";

async function main(): Promise<void> {
    const repoRoot = resolve(__dirname, "..", "..");
    const outPath = resolve(repoRoot, "docs", "coverage-dashboard.html");
    const lcovPath = resolve(repoRoot, "coverage", "lcov.info");

    console.log(`[coverage-dashboard] scanning ${repoRoot}`);
    const tests = await scanTests(repoRoot);
    console.log(`[coverage-dashboard] found ${tests.length} test file(s)`);

    let lcov = new Map<string, ReturnType<typeof parseLcov>["get"] extends (k: string) => infer R ? NonNullable<R> : never>();
    if (existsSync(lcovPath)) {
        const content = await readFile(lcovPath, "utf-8");
        lcov = parseLcov(content, { repoRoot }) as typeof lcov;
        console.log(`[coverage-dashboard] parsed lcov entries: ${lcov.size}`);
    } else {
        console.log(`[coverage-dashboard] no lcov.info found (skipping coverage overlay)`);
    }

    const matrix = buildMatrix(tests, lcov);
    console.log(
        `[coverage-dashboard] matrix: ${matrix.summary.coveredCells}/${matrix.summary.totalCells} cells covered (${matrix.summary.coveragePct}%)`
    );

    const html = renderHtml(matrix, {
        generatedAt: new Date(),
        projectName: "Multi-Vendor E-Commerce",
        testRunners: ["Jest 30", "Playwright 1.57", "ts-jest 29"],
    });

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, html, "utf-8");
    console.log(`[coverage-dashboard] wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[coverage-dashboard] fatal:", message);
    if (stack) console.error(stack);
    process.exit(1);
});
