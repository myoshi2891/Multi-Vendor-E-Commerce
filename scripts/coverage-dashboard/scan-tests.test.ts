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

    // skip / only 等の修飾子付きテストも実行時には「テストケース」として計上される
    // （Jest は skipped、Playwright は skipped として reporter に出る）。
    // 静的走査で 0 件扱いにすると、tests/e2e の 37 ケースが 23 と報告され、
    // SSOT（QA_HANDOFF「3 ブラウザ 111 テスト」= 37 × 3）と乖離する。
    it("skip / only 等の修飾子付きテストも testCount に数える", async () => {
        root = makeFixture({
            "src/queries/modifier.test.ts": `
                describe('group', () => {
                    it('plain', () => {});
                    it.skip('skipped', () => {});
                    test.skip('skipped too', () => {});
                    it.only('focused', () => {});
                    test.failing('known bug', () => {});
                    test.concurrent('parallel', () => {});
                });
            `,
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(6);
    });

    // Playwright の `test.skip(condition, reason)` は **テスト本体の中に置く注釈**
    // （conditional modifier）であって、テスト宣言ではない。囲みの `test('title')`
    // が既に 1 件として計上されているため、注釈も数えると二重計上になる。
    // 実測: tests/e2e の修飾子 22 件のうち 16 件がこの注釈形で、
    // 静的走査 52 に対し `bunx playwright test --list` の実測は 39。
    it("本体内の test.skip(condition) 注釈は testCount に数えない", async () => {
        root = makeFixture({
            "tests/e2e/annotation.spec.ts": `
                test.describe('a11y', () => {
                    test('checkout が違反ゼロ', async ({ page }, testInfo) => {
                        test.skip(testInfo.project.name !== 'chromium', 'chromium 限定');
                        test.slow();
                        await page.goto('/checkout');
                    });
                    test('profile が違反ゼロ', async () => {
                        test.skip(
                            !process.env.CLERK_SECRET_KEY,
                            'Clerk 未設定'
                        );
                    });
                });
            `,
        });

        const results = await scanTests(root);

        // 宣言は 2 件のみ（注釈 test.skip x2 / test.slow x1 は数えない）
        expect(results[0]?.testCount).toBe(2);
    });

    // 一方で `test.skip('title', fn)` は**宣言**であり、実行時に skipped な
    // テストケースとして reporter に出る。注釈と区別して計上を維持する。
    it("宣言形の test.skip('title', fn) は引き続き testCount に数える", async () => {
        root = makeFixture({
            "tests/e2e/declaration.spec.ts": `
                test.describe('group', () => {
                    test('running', () => {});
                    test.skip('pending rewrite', () => {});
                    test.fixme('broken', async () => {});
                });
            `,
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(3);
    });

    // Playwright の test.describe / test.describe.skip は wrapper であり、
    // 修飾子を許容した結果これらを数え始めると testCount が過大になる。
    it("test.describe / test.describe.skip は wrapper として testCount から除外する", async () => {
        root = makeFixture({
            "tests/e2e/wrapper.spec.ts": `
                test.describe('group', () => {
                    test('a', () => {});
                    test.skip('b', () => {});
                });
                test.describe.skip('skipped group', () => {
                    test('c', () => {});
                });
            `,
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(3);
    });

    // it.each は EACH_PATTERN 側でテーブル行数へ展開される。修飾子を許容した
    // ブロックパターンが .each も拾うと、each 1 件につき 1 件ぶん二重計上される。
    it("it.each を修飾子付きブロックとして二重計上しない", async () => {
        root = makeFixture({
            "src/queries/each-dup.test.ts": `
                it.each([
                    { a: 1 },
                    { a: 2 },
                ])('case $a', ({ a }) => {});
            `,
        });

        const results = await scanTests(root);

        // 2 (テーブル行) のみ。ブロックパターン側で +1 されないこと
        expect(results[0]?.testCount).toBe(2);
    });

    // it.each は実行時にテーブル行数ぶんのテストへ展開される。静的走査で 0 件として
    // 扱うと、ダッシュボードの testCount が実測（bun run test）と食い違う。
    it("it.each のテーブル行数を展開して testCount に数える", async () => {
        root = makeFixture({
            "src/queries/each.test.ts": `
                it.each([
                    { a: 1 },
                    { a: 2 },
                    { a: 3 },
                ])('case $a', ({ a }) => {});
                it('regular', () => {});
            `,
        });

        const results = await scanTests(root);

        // 3 (it.each の行) + 1 (通常の it) = 4
        expect(results[0]?.testCount).toBe(4);
    });

    // 修飾子は .each の「手前」に付く（it.skip.each / test.only.each）。
    // BLOCK_PATTERN は `.skip` の直後が `(` でないため一致せず、EACH_PATTERN も
    // `it.each` という部分列を持たないため一致しない。両方すり抜けてテーブル行数が
    // 丸ごと欠測する。scan-tests.ts は同型の欠陥で 2 度壊れている（c1be6d7 / ff9f5c28）。
    it("修飾子付きの it.skip.each / test.only.each も展開して testCount に数える", async () => {
        root = makeFixture({
            "src/queries/modifier-each.test.ts": `
                it.skip.each([
                    { a: 1 },
                    { a: 2 },
                ])('skipped case $a', ({ a }) => {});
                test.only.each\`
                    a    | b
                    \${1} | \${2}
                    \${3} | \${4}
                \`('only case $a', ({ a, b }) => {});
                it('regular', () => {});
            `,
        });

        const results = await scanTests(root);

        // 2 (it.skip.each の行) + 2 (test.only.each の行) + 1 (通常の it) = 5
        expect(results[0]?.testCount).toBe(5);
    });

    // 空テーブルは実行時に 0 件へ展開される（Jest では空 each 自体がエラー扱い）。
    // 配列の開き括弧自身を「内容あり」と見なすと 1 件に化け、testCount が過大になる。
    it("空の it.each([]) は 0 件として数える", async () => {
        root = makeFixture({
            "src/queries/empty-each.test.ts": `
                it.each([])('never runs', () => {});
                it('regular', () => {});
            `,
        });

        const results = await scanTests(root);

        // 0 (空の it.each) + 1 (通常の it) = 1
        expect(results[0]?.testCount).toBe(1);
    });

    it("空要素を含む入れ子 it.each([[]]) は 1 件として数える", async () => {
        root = makeFixture({
            "src/queries/nested-empty-each.test.ts": `
                it.each([[]])('one empty row', () => {});
            `,
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(1);
    });

    it("ジェネリクス付き it.each<T>([...]) も展開して数える", async () => {
        // tests/integration/cart-checkout.test.ts が使う形式。
        // 型引数の中に { } や , を含むため、素朴な括弧数えでは誤る。
        root = makeFixture({
            "src/queries/generic-each.test.ts": `
                it.each<{
                    method: string;
                    quantity: number;
                }>([
                    { method: 'ITEM', quantity: 3 },
                    { method: 'WEIGHT', quantity: 2 },
                    { method: 'FIXED', quantity: 4 },
                ])('method=$method', async ({ method }) => {});
            `,
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(3);
    });

    it("test.each のテンプレートリテラル表も行数で数える", async () => {
        root = makeFixture({
            "src/queries/table-each.test.ts": [
                "test.each`",
                "  a    | b",
                "  ${1} | ${2}",
                "  ${3} | ${4}",
                "`('adds $a', ({ a, b }) => {});",
            ].join("\n"),
        });

        const results = await scanTests(root);

        // ヘッダ行を除いたデータ行 2 件
        expect(results[0]?.testCount).toBe(2);
    });

    it("同一ファイル内の const を参照する it.each(IDENT) を展開して数える", async () => {
        // src/lib/order-settlement.test.ts が使う形式。テーブルを名前付き定数に
        // 括り出すと、配列リテラルしか見ない走査では 0 件と数えられ、
        // ファイルのケース数が丸ごと過小計上される。
        root = makeFixture({
            "src/lib/local-each.test.ts": `
                const STATUSES = ["Pending", "Failed", "Declined"];

                it('regular', () => {});
                it.each(STATUSES)('status=%s', (status) => {});
            `,
        });

        const results = await scanTests(root);

        // 素の it 1 + 展開 3
        expect(results[0]?.testCount).toBe(4);
    });

    it("import した const を参照する it.each(IDENT) を展開して数える", async () => {
        // `@/` エイリアス（→ src/）と相対パスの単一ホップだけを辿る。
        root = makeFixture({
            "src/lib/payment-status.ts": `
                export const SETTLED: readonly string[] = [
                    "Paid",
                    "Refunded",
                    "ChargeBack",
                ];
            `,
            "src/lib/alias-each.test.ts": `
                import { SETTLED } from "@/lib/payment-status";

                it('regular', () => {});
                it.each(SETTLED)('status=%s', (status) => {});
            `,
        });

        const results = await scanTests(root);

        const target = results.find(
            (r) => r.relativePath === "src/lib/alias-each.test.ts"
        );
        // 素の it 1 + 展開 3（型注釈 `: readonly string[]` をまたげること）
        expect(target?.testCount).toBe(4);
    });

    it("解決できない識別子の it.each は 0 件のままにする（過大計上しない）", async () => {
        // 多段 re-export・動的生成などは追わない。推測で数を盛るより
        // 過小計上のまま残すほうが安全（静的走査の原理的限界）。
        root = makeFixture({
            "src/lib/unresolved-each.test.ts": `
                import { TABLE } from "some-external-package";

                it('regular', () => {});
                it.each(TABLE)('row=%s', (row) => {});
            `,
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(1);
    });

    it("識別子解決を足しても空の it.each([]) は 0 件のまま", async () => {
        // 既存契約の回帰網。識別子分岐の追加で配列リテラル経路を壊さない。
        root = makeFixture({
            "src/lib/empty-still-zero.test.ts": `
                const EMPTY = [];

                it('regular', () => {});
                it.each([])('never', () => {});
                it.each(EMPTY)('never either', () => {});
            `,
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(1);
    });

    it("文字列リテラル内の it( / test.skip( / it.each( は宣言として数えない", async () => {
        // 走査器のテストのように、**走査対象コードを文字列フィクスチャとして持つ**
        // ファイルが存在する。文字列の中身をコードと取り違えると件数が跳ね上がる ——
        // 本ファイル自身がまさにその形で、実行時 21 件がダッシュボード上 81 件に
        // 膨らんでいた（`grep -cE "it\(|it\.each"` = 48 件が実テストでない）。
        //
        // 三種のリテラル（単一引用符 / 二重引用符 / テンプレート）をすべて張る。
        // テンプレート内には配列リテラル付きの `it.each` を置き、BLOCK_PATTERN と
        // EACH_PATTERN の**両方**が文字列内を読まないことを 1 本で固定する。
        root = makeFixture({
            "src/lib/fixture-holder.test.ts": [
                "const singleQuoted = 'it(\\'inner\\', () => {})';",
                'const doubleQuoted = "test.skip(\'inner\', () => {})";',
                "const templated = `it.each([[1], [2], [3]])('row=%s', () => {})`;",
                "",
                "it('the only real test', () => {});",
            ].join("\n"),
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(1);
    });

    it("正規表現リテラル内の引用符を文字列の開始と誤読しない", async () => {
        // `findMaskedSpans` は `"` / `'` / `` ` `` を見た時点で文字列の開始と
        // みなす。正規表現リテラルを走査対象に含めていないため、`/["']/` の
        // ような**正規表現の中の引用符**が文字列の開始として読まれ、そこから
        // 次の同種引用符（＝はるか下のコード）までが丸ごと非コード範囲として
        // マスクされる。その範囲に落ちたテスト宣言は丸ごと欠測する。
        //
        // `it.each` 欠測 (c1be6d7) / `test.skip(` 欠測 (ff9f5c28) /
        // `it.skip.each` 欠測 (73d68b57) に続く同型 4 度目。
        root = makeFixture({
            "src/lib/regex-holder.test.ts": [
                "const quoteClass = /[\"']/;",
                "const apostrophe = /don't/;",
                "",
                "it('first real test', () => {});",
                "it('second real test', () => {});",
            ].join("\n"),
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(2);
    });

    it("正規表現リテラル内の it( / .skip は宣言・skip として数えない", async () => {
        // 逆向きの取り違え。正規表現をマスクしないと、その中のトークンが
        // 実コードとして計上される。走査器自身のパターン定義
        // （`/\b(it|test)\s*\(/g` 等）がまさにこの形。
        root = makeFixture({
            "src/lib/regex-tokens.test.ts": [
                "const blockPattern = /\\b(it|test)\\s*\\(/g;",
                "const skipPattern = /\\b(it|test)\\.skip\\b/g;",
                "",
                "it('the only real test', () => {});",
            ].join("\n"),
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(1);
        expect(results[0]?.hasSkip).toBe(false);
    });

    it("除算のスラッシュを正規表現の開始と誤読しない", async () => {
        // 正規表現対応を入れる際の反対側の失敗。`a / b` の `/` を正規表現の
        // 開始として読むと、次の `/` までが非コード範囲になり、その間にある
        // 宣言が欠測する。判定は「直前の非空白トークン」で行う必要がある。
        root = makeFixture({
            "src/lib/division.test.ts": [
                "const ratio = total / count;",
                "",
                "it('first real test', () => {});",
                "const other = a / b;",
                "it('second real test', () => {});",
            ].join("\n"),
        });

        const results = await scanTests(root);

        expect(results[0]?.testCount).toBe(2);
    });

    it("文字列リテラル内の .skip / xdescribe は hasSkip に数えない", async () => {
        // testCount と同じ取り違えが hasSkip 側にもある。hasSkip はヒートマップの
        // `◐`（partial）判定に効くため、フィクスチャ文字列を根拠に partial 扱い
        // されると「skip があるので不完全」という誤った読みが台帳へ伝播する。
        root = makeFixture({
            "src/lib/skip-in-fixture.test.ts": [
                "const fixture = \"it.skip('inner', () => {})\";",
                "const another = 'xdescribe(\\'inner\\', () => {})';",
                "",
                "it('the only real test', () => {});",
            ].join("\n"),
        });

        const results = await scanTests(root);

        expect(results[0]?.hasSkip).toBe(false);
        expect(results[0]?.testCount).toBe(1);
    });

    it("実コード上の .skip は引き続き hasSkip=true にする", async () => {
        // 上のテストが「常に false を返す」実装で緑にならないことを固定する。
        root = makeFixture({
            "src/lib/skip-in-code.test.ts": [
                "const fixture = \"harmless string\";",
                "",
                "it.skip('really skipped', () => {});",
            ].join("\n"),
        });

        const results = await scanTests(root);

        expect(results[0]?.hasSkip).toBe(true);
    });

    it("存在しない root では空配列を返す", async () => {
        const result = await scanTests(join(tmpdir(), "definitely-not-exists-xyz"));
        expect(result).toEqual([]);
    });
});
