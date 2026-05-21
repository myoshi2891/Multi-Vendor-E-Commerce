import { buildMatrix } from "./build-matrix";
import { renderHtml } from "./render-html";
import type { ScannedTest } from "./scan-tests";

function jest_(p: string, opts: Partial<Omit<ScannedTest, "relativePath" | "kind">> = {}): ScannedTest {
    return { relativePath: p, kind: "jest", hasSkip: false, testCount: 1, ...opts };
}

describe("renderHtml", () => {
    const matrix = buildMatrix(
        [
            jest_("src/queries/store.test.ts", { testCount: 8 }),
            jest_("src/queries/coupon.test.ts", { testCount: 5, hasSkip: true }),
            jest_("src/middleware.test.ts", { testCount: 3 }),
            { relativePath: "tests/e2e/purchase-flow.spec.ts", kind: "playwright", hasSkip: false, testCount: 4 },
        ],
        new Map()
    );
    const html = renderHtml(matrix, { generatedAt: new Date("2026-05-21T10:00:00Z") });

    it("単一ファイル HTML 文書として始まる", () => {
        expect(html).toMatch(/^<!DOCTYPE html>/i);
        expect(html).toContain("<html");
        expect(html).toContain("</html>");
    });

    it("ブランド見出し FIELD REPORT を含む", () => {
        expect(html).toContain("FIELD REPORT");
    });

    it("生成日時を含む", () => {
        expect(html).toContain("2026");
    });

    it("カバレッジ% (summary.coveragePct) を含む", () => {
        expect(html).toContain(`${matrix.summary.coveragePct}%`);
    });

    it("マトリクスデータを JSON として埋め込む", () => {
        expect(html).toContain('id="matrix-data"');
        expect(html).toContain('type="application/json"');
        // 主要なテストパスがどこかに出現する (JSON 内 or DOM 内)
        expect(html).toContain("src/queries/store.test.ts");
    });

    it("カテゴリ・ドメインのラベルを表示する", () => {
        expect(html).toContain("Server Actions");
        expect(html).toContain("Visual / Snapshot");
        expect(html).toContain("Security");
    });

    it("Editorial Laboratory フォントを CDN 経由でロードする", () => {
        expect(html).toContain("fonts.googleapis.com");
        expect(html).toContain("Fraunces");
        expect(html).toContain("JetBrains+Mono");
    });

    it("印刷用 CSS (@media print) を含む", () => {
        expect(html).toMatch(/@media\s+print/);
    });

    it("ダークモード対応 (prefers-color-scheme) を含む", () => {
        expect(html).toContain("prefers-color-scheme");
    });

    it("フィルタトグル / 詳細ツールチップの DOM を含む", () => {
        expect(html).toContain("data-filter");
        expect(html).toContain("data-tooltip");
    });

    it("HTML エスケープが行われ <script> 注入が無効化される", () => {
        const malicious = buildMatrix(
            [jest_("src/queries/<script>alert(1)</script>.test.ts")],
            new Map()
        );
        const escapedHtml = renderHtml(malicious, { generatedAt: new Date() });
        expect(escapedHtml).not.toContain("<script>alert(1)</script>.test.ts");
        expect(escapedHtml).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    });
});
