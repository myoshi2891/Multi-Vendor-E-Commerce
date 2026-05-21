import { parseLcov } from "./parse-lcov";

describe("parseLcov", () => {
    it("単一ファイルの LF/LH からラインカバレッジ率を計算する", () => {
        const input = [
            "TN:",
            "SF:src/queries/store.ts",
            "DA:1,1",
            "DA:2,0",
            "LF:10",
            "LH:7",
            "end_of_record",
        ].join("\n");

        const map = parseLcov(input);

        expect(map.size).toBe(1);
        expect(map.get("src/queries/store.ts")?.linePct).toBe(70);
        expect(map.get("src/queries/store.ts")?.linesFound).toBe(10);
        expect(map.get("src/queries/store.ts")?.linesHit).toBe(7);
    });

    it("複数レコードを正しく分割する", () => {
        const input = [
            "SF:src/a.ts",
            "LF:4",
            "LH:2",
            "end_of_record",
            "SF:src/b.ts",
            "LF:5",
            "LH:5",
            "end_of_record",
        ].join("\n");

        const map = parseLcov(input);

        expect(map.size).toBe(2);
        expect(map.get("src/a.ts")?.linePct).toBe(50);
        expect(map.get("src/b.ts")?.linePct).toBe(100);
    });

    it("Windows 形式 CRLF も解釈する", () => {
        const input = "SF:src/a.ts\r\nLF:2\r\nLH:1\r\nend_of_record\r\n";
        const map = parseLcov(input);
        expect(map.get("src/a.ts")?.linePct).toBe(50);
    });

    it("LF=0 のときは linePct=0 (ゼロ除算を避ける)", () => {
        const input = "SF:src/empty.ts\nLF:0\nLH:0\nend_of_record\n";
        const map = parseLcov(input);
        expect(map.get("src/empty.ts")?.linePct).toBe(0);
    });

    it("空入力なら空 Map を返す", () => {
        expect(parseLcov("").size).toBe(0);
    });

    it("破損入力 (SF だけで end_of_record なし) は無視する", () => {
        const input = "SF:src/a.ts\n"; // 不完全
        expect(parseLcov(input).size).toBe(0);
    });

    it("絶対パスは可能ならリポジトリ相対に正規化する", () => {
        const input = [
            "SF:/Users/x/repo/src/queries/store.ts",
            "LF:2",
            "LH:1",
            "end_of_record",
        ].join("\n");
        const map = parseLcov(input, { repoRoot: "/Users/x/repo" });
        expect(map.has("src/queries/store.ts")).toBe(true);
    });
});
