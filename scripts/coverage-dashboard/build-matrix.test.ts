import { buildMatrix } from "./build-matrix";
import type { ScannedTest } from "./scan-tests";

function jest_(p: string, opts: Partial<Omit<ScannedTest, "relativePath" | "kind">> = {}): ScannedTest {
    return { relativePath: p, kind: "jest", hasSkip: false, testCount: 1, ...opts };
}

function pw(p: string): ScannedTest {
    return { relativePath: p, kind: "playwright", hasSkip: false, testCount: 1 };
}

describe("buildMatrix", () => {
    it("テスト 0 件のセルは status=missing になる", () => {
        const m = buildMatrix([], new Map());
        const cell = m.cell("unit", "queries");
        expect(cell.status).toBe("missing");
        expect(cell.testCount).toBe(0);
        expect(cell.files).toEqual([]);
    });

    it("テスト存在 & skip なし & lcov 60% 以上のセルは status=full", () => {
        const tests = [jest_("src/queries/store.test.ts", { testCount: 5 })];
        const lcov = new Map([["src/queries/store.ts", { linesFound: 100, linesHit: 80, linePct: 80 }]]);
        const m = buildMatrix(tests, lcov);

        const cell = m.cell("unit", "queries");
        expect(cell.status).toBe("full");
        expect(cell.testCount).toBe(5);
        expect(cell.files).toHaveLength(1);
        expect(cell.avgLinePct).toBe(80);
    });

    it(".skip を含むテストファイルがあれば status=partial", () => {
        const tests = [jest_("src/queries/store.test.ts", { hasSkip: true })];
        const m = buildMatrix(tests, new Map());
        expect(m.cell("unit", "queries").status).toBe("partial");
    });

    it("lcov line% < 60 のセルは status=partial", () => {
        const tests = [jest_("src/queries/store.test.ts")];
        const lcov = new Map([["src/queries/store.ts", { linesFound: 100, linesHit: 30, linePct: 30 }]]);
        const m = buildMatrix(tests, lcov);
        expect(m.cell("unit", "queries").status).toBe("partial");
    });

    it("Playwright spec は (e2e, pages) セルに集計される", () => {
        const tests = [pw("tests/e2e/purchase-flow.spec.ts"), pw("tests/e2e/search.spec.ts")];
        const m = buildMatrix(tests, new Map());
        const cell = m.cell("e2e", "pages");
        expect(cell.status).toBe("full");
        expect(cell.testCount).toBe(2);
    });

    it("summary.totalCells / coveredCells / coveragePct を集計する", () => {
        // 8 カテゴリ × 10 ドメイン = 80 セル
        const tests = [jest_("src/queries/store.test.ts"), jest_("src/lib/utils.test.ts")];
        const m = buildMatrix(tests, new Map());

        expect(m.summary.totalCells).toBe(80);
        expect(m.summary.coveredCells).toBe(2); // queries/unit + lib-utils/unit
        expect(m.summary.coveragePct).toBe(Math.round((2 / 80) * 100));
    });

    it("summary.totalTestFiles と byCategory / byDomain の合計が一致する", () => {
        const tests = [
            jest_("src/queries/a.test.ts"),
            jest_("src/queries/b.test.ts"),
            jest_("src/components/store/c.test.tsx"),
            pw("tests/e2e/d.spec.ts"),
        ];
        const m = buildMatrix(tests, new Map());

        expect(m.summary.totalTestFiles).toBe(4);
        // queries x2 + components/store x1 = 3 (src/components/ は tests/component/ 外なので unit)
        expect(m.summary.byCategory.unit).toBe(3);
        expect(m.summary.byCategory.e2e).toBe(1);
        expect(m.summary.byCategory.integration).toBe(0);
        expect(m.summary.byDomain.queries).toBe(2);
        expect(m.summary.byDomain.pages).toBe(1);
        expect(m.summary.byDomain["store-ui"]).toBe(1);
    });
});
