import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { scanTests, type ScannedTest } from "./scan-tests";

/**
 * テスト用に一時ディレクトリを作り、与えられたファイルツリーを書き出す。
 * テストごとに rmSync でクリーンアップする前提。
 */
function makeFixture(tree: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "scan-tests-"));
    for (const [relPath, content] of Object.entries(tree)) {
        const abs = join(root, relPath);
        mkdirSync(join(abs, ".."), { recursive: true });
        writeFileSync(abs, content);
    }
    return root;
}

describe("scanTests", () => {
    let root: string;

    afterEach(() => {
        if (root) rmSync(root, { recursive: true, force: true });
    });

    it("Jest 用 *.test.ts / *.test.tsx を 'jest' kind として返す", async () => {
        // Arrange
        root = makeFixture({
            "src/queries/user.test.ts": "describe('x', () => it.skip('y', () => {}));",
            "src/components/foo.test.tsx": "describe('x', () => it('y', () => {}));",
            "src/components/foo.tsx": "export const X = 1;",
        });

        // Act
        const results = await scanTests(root);

        // Assert
        const paths = results.map((r) => r.relativePath).sort();
        expect(paths).toEqual([
            "src/components/foo.test.tsx",
            "src/queries/user.test.ts",
        ]);
        expect(results.every((r: ScannedTest) => r.kind === "jest")).toBe(true);
    });

    it("Playwright 用 tests/e2e/*.spec.ts を 'playwright' kind として返す", async () => {
        root = makeFixture({
            "tests/e2e/purchase.spec.ts": "test('flow', async () => {});",
            "tests/e2e/login.spec.ts": "test('flow', async () => {});",
        });

        const results = await scanTests(root);

        expect(results).toHaveLength(2);
        expect(results.every((r) => r.kind === "playwright")).toBe(true);
    });

    it("node_modules 配下のテストは無視する", async () => {
        root = makeFixture({
            "node_modules/foo/bar.test.ts": "describe('x', () => {});",
            "src/queries/user.test.ts": "describe('x', () => {});",
        });

        const results = await scanTests(root);

        expect(results.map((r) => r.relativePath)).toEqual([
            "src/queries/user.test.ts",
        ]);
    });

    it(".skip / xdescribe / it.skip / xit を含むファイルを hasSkip=true で返す", async () => {
        root = makeFixture({
            "src/queries/skipped.test.ts": "it.skip('x', () => {});",
            "src/queries/normal.test.ts": "it('x', () => {});",
            "src/queries/xdescribe.test.ts": "xdescribe('x', () => {});",
        });

        const results = await scanTests(root);
        const byPath = new Map(results.map((r) => [r.relativePath, r]));

        expect(byPath.get("src/queries/skipped.test.ts")?.hasSkip).toBe(true);
        expect(byPath.get("src/queries/xdescribe.test.ts")?.hasSkip).toBe(true);
        expect(byPath.get("src/queries/normal.test.ts")?.hasSkip).toBe(false);
    });

    it("テストケース (it / test) の数を testCount として返す（describe は除外）", async () => {
        root = makeFixture({
            "src/queries/count.test.ts": `
                describe('group', () => {
                    it('a', () => {});
                    it('b', () => {});
                    test('c', () => {});
                });
            `,
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(3);
    });

    it("存在しない root では空配列を返す", async () => {
        const result = await scanTests(join(tmpdir(), "definitely-not-exists-xyz"));
        expect(result).toEqual([]);
    });
});
