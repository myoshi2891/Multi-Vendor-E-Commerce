# プラン 010: `computeShippingTotal`（配送料計算 SSOT）の直接ユニットテストを追加する

> 原本: [../010-unit-test-compute-shipping-total.md](../010-unit-test-compute-shipping-total.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/lib/shipping-utils.ts`
> このファイルがこのプラン作成後に変更されていれば、「Current state」の抜粋を
> 実コードと比較すること。不一致があれば STOP。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

`computeShippingTotal` は全ての配送料計算の唯一のソースであるリポジトリの SSOT である（`.claude/steering/tech.md` は全ての配送料計算がこれを経由することを義務付けている）。しかし**直接のユニットテストが無い** — 統合テストの中で間接的にのみ演習されており、そこでは自分自身をオラクルとして使っている（統合テストは、テスト対象と同じ関数で期待値を計算しているため、自己整合的なバグは不可視である）。本プランは、3つの方式すべてとエッジケース（ゼロ/負の数量、単数 vs 複数アイテム、丸め境界）にわたって、明示的で手計算した期待値でその挙動を固定する。純粋な追加テストカバレッジであり — プロダクション変更はなく、LOW risk で、あらゆる注文で金額に触れる関数にとって高い価値がある。

## Current state

`src/lib/shipping-utils.ts`（関数全体、`f9752c0` 時点）:

```ts
import { ShippingFeeMethod } from "@prisma/client";

export function computeShippingTotal(
	shippingFeeMethod: ShippingFeeMethod,   // "ITEM" | "WEIGHT" | "FIXED"
	shippingFee: number,
	extraShippingFee: number,
	weight: number,
	quantity: number
): number {
	if (quantity <= 0) return 0;                 // early guard

	let result: number;
	switch (shippingFeeMethod) {
		case "ITEM": {
			const qty = quantity > 1 ? quantity - 1 : 0;
			result = shippingFee + qty * extraShippingFee;   // base + extra per additional item
			break;
		}
		case "WEIGHT":
			result = shippingFee * weight * quantity;
			break;
		case "FIXED":
			result = shippingFee;
			break;
	}
	// 2-decimal normalization with EPSILON correction
	return Math.round((result + Number.EPSILON) * 100) / 100;
}
```

固定すべき挙動（コードを読んで導出 — それぞれ手で検証すること）:
- **quantity ≤ 0** → `0` を返す（`0` と負の両方）。
- **ITEM**: `quantity > 1` のとき `shippingFee + (quantity - 1) * extraShippingFee`；`quantity === 1` のとき extra 項は 0 → `shippingFee` のみ。
- **WEIGHT**: `shippingFee * weight * quantity`。
- **FIXED**: weight/quantity に関わらず `shippingFee`（quantity > 0 である限り）。
- **丸め**: `Math.round((result + Number.EPSILON) * 100) / 100` で結果を小数2桁に正規化 — 生の積が小数点以下2桁を超える入力を選んで丸めを証明する（例: WEIGHT で `weight = 0.1`、`shippingFee = 0.1`、`quantity = 3` → `0.1*0.1*3 = 0.03...` の float ノイズ → `0.03` を期待）。

### リポジトリ規約

- **テスト配置**: `src/lib/*.test.ts` に co-located — リポジトリには既に `src/lib/utils.test.ts`、`src/lib/auth-guards.test.ts`、`src/lib/schemas.test.ts` がある。Jest はこれらを拾う（設定は `node_modules`、`tests/e2e`、`tests/integration` のみ除外）。新規ファイル: `src/lib/shipping-utils.test.ts`。
- **AAA パターン**（Arrange-Act-Assert）、正常系と異常系の両方（`.claude/rules/01-engineering-standards.md`、テストの節）。
- `ShippingFeeMethod` は Prisma enum；`@prisma/client` から import し、文字列リテラル `"ITEM"`/`"WEIGHT"`/`"FIXED"` を渡す。

## 必要なコマンド

| 目的  | コマンド                                          | 期待結果   |
|----------|--------------------------------------------------|------------|
| テスト     | `bun run test -- src/lib/shipping-utils.test.ts` | 全件 pass   |
| 型チェック| `bunx tsc --noEmit`                              | exit 0     |
| Lint     | `bun run lint`                                   | exit 0     |

## Scope

**対象内**:
- `src/lib/shipping-utils.test.ts`（新規作成）

**対象外**:
- `src/lib/shipping-utils.ts` — 実装は**変更しない**こと。テストが本物のバグ（例えば予期しない method 値で `result` が未到達/未初期化になる等）を明らかにした場合、STOP してそれを finding として報告する — このテスト専用プランで「修正」しない。
- この関数をオラクルとして使う統合テスト — そのままにする。

## Git ワークフロー

- Branch: `advisor/010-shipping-utils-tests`
- コミットスタイル: `test(shipping): add unit tests for computeShippingTotal`
- `.claude/rules/02-tdd-step-commit.md` の TDD/コミット規律に従うこと: これは既存コードの追加的な characterization テストなので、1テストファイル = 1コミットで問題ない（既存挙動の固定には Red-first 要件なし）。
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: `src/lib/shipping-utils.test.ts` を書く

AAA 構造のケースでファイルを作成する。すべての期待値を手で計算しハードコードすること（期待値を導出するために `computeShippingTotal` を呼び出さないこと — それはオラクル問題を再導入してしまう）:

```ts
import { computeShippingTotal } from "@/lib/shipping-utils";
import { ShippingFeeMethod } from "@prisma/client";

describe("computeShippingTotal", () => {
    describe("quantity ガード", () => {
        it("quantity が 0 のとき 0 を返す", () => {
            expect(computeShippingTotal("ITEM", 10, 2, 1, 0)).toBe(0);
        });
        it("quantity が負のとき 0 を返す", () => {
            expect(computeShippingTotal("FIXED", 10, 2, 1, -3)).toBe(0);
        });
    });

    describe("ITEM 方式", () => {
        it("単数 (quantity=1) は base のみ", () => {
            expect(computeShippingTotal("ITEM", 10, 2, 1, 1)).toBe(10);
        });
        it("複数は base + (qty-1)*extra", () => {
            // 10 + (3-1)*2 = 14
            expect(computeShippingTotal("ITEM", 10, 2, 1, 3)).toBe(14);
        });
    });

    describe("WEIGHT 方式", () => {
        it("fee*weight*quantity", () => {
            // 5 * 2 * 3 = 30
            expect(computeShippingTotal("WEIGHT", 5, 0, 2, 3)).toBe(30);
        });
        it("float 誤差の 2 桁正規化", () => {
            // 0.1 * 0.1 * 3 = 0.030000...4（float 誤差）→ 0.03 に正規化
            expect(computeShippingTotal("WEIGHT", 0.1, 0, 0.1, 3)).toBe(0.03);
        });
        it("丸め境界（.xx5 は half-up で切り上げ）", () => {
            // 0.125 は 2 桁目の直後がちょうど 5。computeShippingTotal は
            // Math.round((x + EPSILON) * 100) / 100 で half-up するため 0.13 になる。
            // ↑の float 正規化テストとは別に「実際の丸め境界」を検証する入力。
            expect(computeShippingTotal("WEIGHT", 0.25, 0, 0.5, 1)).toBe(0.13);
        });
    });

    describe("FIXED 方式", () => {
        it("weight/quantity に依存せず fee を返す", () => {
            expect(computeShippingTotal("FIXED", 25, 99, 99, 4)).toBe(25);
        });
    });
});
```

`ShippingFeeMethod` の enum リテラル型付けが必要な場合は調整する（例: コンパイラが文句を言う場合のみ `"ITEM" as ShippingFeeMethod` のようにキャストする — 通常は文字列リテラルユニオンで直接満たされる）。

**検証**: `bun run test -- src/lib/shipping-utils.test.ts` → 全件 pass；`bunx tsc --noEmit` → exit 0。

### Step 2: テストスイートの記録を確認する

これは新規テストファイル（と新規テスト）を追加するため、リポジトリのプロセス（`.claude/rules/02-tdd-step-commit.md`）は `spec-sync-after-test` フロー経由でテスト数ドキュメントを更新することを求めている。この executor 環境では:
- `spec-sync-after-test` スキル/ツールが利用可能であれば、それを実行して統計を更新しカバレッジダッシュボードを再生成し、それらの doc 変更をテストファイルとは**別コミット**に含める。
- 環境にそのツールが**利用できない**場合、テストのコミット後に STOP し、doc/統計の同期（`QA_HANDOFF.md`、カバレッジダッシュボード）がメンテナ向けに保留中であることを報告する — `docs/coverage-dashboard.html` を手編集しないこと（生成物である）。

**検証**: `bun run lint` → exit 0。

## Test plan

- 新規ファイル `src/lib/shipping-utils.test.ts` がカバー: quantity 0、quantity 負、ITEM 単数、ITEM 複数、WEIGHT 整数、WEIGHT 丸め、FIXED の独立性。
- 構造パターン: `src/lib/utils.test.ts`（同ディレクトリ内の最も近い純粋関数のユニットテスト）。
- 検証: `bun run test -- src/lib/shipping-utils.test.ts` → 新規ケースを含め全件 pass。

## Done criteria

以下すべてを満たすこと:

- [ ] `src/lib/shipping-utils.test.ts` が上記7ケース（またはそれ以上）とともに存在する
- [ ] `bun run test -- src/lib/shipping-utils.test.ts` が exit 0
- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `bun run lint` が exit 0
- [ ] `src/lib/shipping-utils.ts` が変更されていない（`git diff --stat` が変更なしを示す）
- [ ] テスト数ドキュメントが `spec-sync-after-test` 経由で同期済み（別コミット）、または保留同期のメモがレポートに記録されている
- [ ] `plans/README.md` の 010 のステータス行が更新されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- `computeShippingTotal` のシグネチャ/挙動が「Current state」と一致しない（ドリフト）— 書く前に実コードに対して期待値を再計算すること。
- 手計算した期待値が関数の出力と一致せず、それが本物のバグを示唆する（例えば enum 範囲外の method で `result` が未代入のまま使われる等）— finding として報告する；実装を変更しない。
- 妥当な修正を試みてもテストが2回失敗する。

## Maintenance notes

- 新しい `ShippingFeeMethod` enum 値が追加された場合、ここと実装の両方に同時にケースを追加すること — 未処理の method は現在 `result` を未代入のまま残す。
- レビュアーは期待値が手計算された定数であり、テスト対象の関数を呼び出して導出されたものでないことを確認すること。
- このテストは、将来の `shipping-utils.ts` のリファクタ（例えば TODO 化されている decimal ライブラリへの移行）が固定された期待値に対して検証できるようにするガードである。
