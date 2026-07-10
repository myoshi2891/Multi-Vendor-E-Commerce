# プラン 007: `logError` ヘルパーの導入、デバッグ `console.log` の除去、タグなし coupon ログの修正

> 原本: [../007-logging-consolidation-and-debug-cleanup.md](../007-logging-consolidation-and-debug-cleanup.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/lib src/queries/coupon.ts src/components/store/forms/apply-coupon.tsx src/components/store/cart-page/container.tsx`
> 対象ファイルのいずれかがこのプラン作成後に変更されていれば、「Current state」の
> 抜粋を実コードと比較すること。不一致があれば STOP。

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

`src/queries/` のエラーログは互換性のない3系統の形式で存在する: 正準の構造化形式 `console.error("[Module:Function] msg", { error, stack })`、レガシーな手書きの `instanceof Error` 3引数形式、そして最悪なものとして — モジュールタグも stack も無い裸の `console.error(error)`（`coupon.ts`、churn 最上位のファイルに集中）。それに加え、2つの UI ファイルが「`src/` に `console.log` 禁止」というリポジトリ規約に違反するデバッグ `console.log` を出荷しており、そのうち1つは毎ロードでカート全体をブラウザコンソールにダンプしている。3つのログ形式はログ集約/アラートを無力化し、裸の coupon ログは coupon 経路のインシデントトリアージを盲目にする。本プランは共有 `logError` ヘルパーを1つ追加し、デバッグログを削除し、裸の coupon ログをタグ付き構造化形式に変換する — レビュー可能な、一貫性ある低リスクのスライスである。約90箇所の完全なレガシー移行は明示的に先送りする（Maintenance notes 参照）ことで、これをレビュー可能に保つ。

## Current state

`src/lib/` に既存のロギングヘルパーは**存在しない**（確認済み: `src/lib/log*.ts` なし）。

正準の目標形式（既に新しいモジュールで使用済み、例: `src/queries/inventory.ts:120-132`、`order.ts`）:

```ts
console.error("[Module:Function] message", { error: error.message, stack: error.stack });
// non-Error branch:
console.error("[Module:Function] Unknown error", { error });
```

`src/queries/coupon.ts` の裸のタグなしログ（6箇所: 54, 92, 130, 158, 195, 332行目）。54行目の例:

```ts
} catch (error: unknown) {
    console.error(error)                 // ← no [Module:Function] tag, no stack
    throw new Error('Error occurred while verifying coupon ownership.')
}
```

no-console.log 規約に違反するデバッグ `console.log`:

```ts
// src/components/store/forms/apply-coupon.tsx:53 — inside catch (error: any)
console.log(error)
toast.error(error.toString())

// src/components/store/cart-page/container.tsx:39 — dumps whole cart every load
const updatedCart = await updateCartWithLatest(cartItems)
console.log('updatedCart--->', updatedCart)
```

### リポジトリ規約

- 構造化ログが標準（`.claude/steering/tech.md`「構造化ログ」）: 第1引数は `"[Module:Function] message"`、第2引数は `{ error, stack }`。非 Error 分岐は `{ error }`（生の値）をログする。`.message`/`.stack` が存在しない可能性があるため。
- `any` は禁止 — `unknown` + `instanceof Error` narrowing を使う。
- `src/` では `console.log` は禁止（CLI seed は例外）。境界での `console.error`/`console.warn` は問題ない。
- ヘルパー/ユーティリティ関数には JSDoc が必要（`.claude/steering/tech.md`「Docstrings」）。

## 必要なコマンド

| 目的      | コマンド                                       | 期待結果          |
|--------------|-----------------------------------------------|-------------------|
| 型チェック    | `bunx tsc --noEmit`                           | exit 0            |
| ヘルパーテスト  | `bun run test -- src/lib/log.test.ts`         | 全件 pass          |
| Coupon テスト  | `bun run test -- src/queries/coupon.test.ts`  | 全件 pass          |
| Lint         | `bun run lint`                                | exit 0（警告は許容） |

## Scope

**対象内**:
- `src/lib/log.ts`（新規作成）— `logError` ヘルパー
- `src/lib/log.test.ts`（新規作成）— そのユニットテスト
- `src/queries/coupon.ts` — 裸の `console.error(error)` 6箇所を `logError` に変換
- `src/components/store/forms/apply-coupon.tsx` — `console.log(error)` を置換（+ `error: any` を修正）
- `src/components/store/cart-page/container.tsx` — デバッグ `console.log` を削除

**対象外**:
- 他の `src/queries/*` ファイル全体にわたる約90箇所のレガシー3引数 `console.error`（先送り；Maintenance notes 参照）。本プランで一括移行しないこと。
- throw されるエラーメッセージや制御フローの変更。
- 他所の `error: any` サイト（別の正確性クリーンアップ課題）— 既に編集している `apply-coupon.tsx` の1箇所のみ修正する。

## Git ワークフロー

- Branch: `advisor/007-logging-consolidation`
- コミットスタイル: `refactor(logging): add logError helper; drop debug console.log`
- 2コミットを検討: (1) ヘルパー + テスト、(2) 呼び出し箇所の変換 — ただし各ステップの検証が通っていれば単一コミットでも許容。
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: `logError` ヘルパーを作成

`src/lib/log.ts` を作成する:

```ts
/**
 * 構造化エラーログの共通ヘルパー。
 * `.claude/steering/tech.md` の規約に合わせ、第1引数を "[Module:Function] message"、
 * 第2引数を { error, stack }（Error 以外は { error }）で出力する。
 *
 * @param tag  "[Module:Function] message" 形式のタグ付きメッセージ
 * @param error catch した unknown なエラー値
 */
export function logError(tag: string, error: unknown): void {
    if (error instanceof Error) {
        console.error(tag, { error: error.message, stack: error.stack });
    } else {
        console.error(tag, { error });
    }
}
```

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 2: ヘルパーのユニットテスト

リポジトリの AAA パターンに従い `src/lib/log.test.ts` を作成する:
- `console.error` を spy する（`jest.spyOn(console, 'error').mockImplementation(() => {})`）、後で restore する。
- **Error 分岐**: `logError("[X:y] boom", new Error("bad"))` → `console.error` が `"[X:y] boom"` と `error === "bad"` かつ `stack` が文字列であるオブジェクトで呼ばれる。
- **非 Error 分岐**: `logError("[X:y] boom", "raw-string")` → 第2引数が `{ error: "raw-string" }`。

**検証**: `bun run test -- src/lib/log.test.ts` → 全件 pass。

### Step 3: 裸の coupon ログ6箇所を変換

`src/queries/coupon.ts` の6箇所の `console.error(error)`（~54, 92, 130, 158, 195, 332行目）それぞれで、関数名を冠したタグとともに `logError` を import して使用する。冒頭に追加: `import { logError } from "@/lib/log";`。例:

```ts
} catch (error: unknown) {
    logError("[Coupon:verifyOwnership] failed to verify coupon ownership", error)
    throw new Error('Error occurred while verifying coupon ownership.')
}
```

各 `[Coupon:<fn>]` タグには実際の囲み関数名を使う（各 catch の関数を読むこと）。`throw new Error(...)` のメッセージは変更しないこと。

**検証**: `grep -n "console.error(error)" src/queries/coupon.ts` → マッチなし；`bunx tsc --noEmit` → exit 0；`bun run test -- src/queries/coupon.test.ts` → 全件 pass。coupon のテストが古い裸の `console.error(error)` 呼び出し形状を assert していた場合、そのアサーションを新しいタグ付き呼び出しに更新する。

### Step 4: UI のデバッグログを削除

1. `src/components/store/cart-page/container.tsx`（~39行目）: `console.log('updatedCart--->', updatedCart)` の行を完全に削除する。同ブロック内の他の何もこれに依存していない。
2. `src/components/store/forms/apply-coupon.tsx`（~52-55行目）: catch は `catch (error: any)`。これを `catch (error: unknown)` に変更し、`console.log(error)` を `logError("[ApplyCoupon:handleSubmit] failed to apply coupon", error)`（`logError` を import）に置換し、toast を `unknown` に対して安全にする:
   ```ts
   } catch (error: unknown) {
       logError("[ApplyCoupon:handleSubmit] failed to apply coupon", error)
       toast.error(error instanceof Error ? error.message : "Failed to apply coupon.")
   }
   ```

**検証**: `grep -rn "console.log" src/components/store/forms/apply-coupon.tsx src/components/store/cart-page/container.tsx` → マッチなし；`bunx tsc --noEmit` → exit 0。

### Step 5: 完全な lint

`src/` の `console.log` は ESLint エラーになり得る；2つの削除によって関連する lint 結果が解消されることを確認する。

**検証**: `bun run lint` → exit 0（新規エラーなし）。

## Test plan

- 新規: `src/lib/log.test.ts`（Error + 非 Error 分岐）。
- 調整: 古い裸のログ呼び出し形状に紐づく `coupon.test.ts` のアサーション。
- 構造パターン: `src/queries/*.test.ts` と `src/lib/*` テスト内の AAA ユニットテスト。
- 検証: ヘルパーテスト + coupon テストが pass；2つの UI ファイルに `console.log` が残っていない。

## Done criteria

以下すべてを満たすこと:

- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `src/lib/log.ts` が JSDoc 付きで `logError` を export；`src/lib/log.test.ts` が pass
- [ ] `grep -n "console.error(error)" src/queries/coupon.ts` がマッチしない
- [ ] `grep -rn "console.log" src/components/store/forms/apply-coupon.tsx src/components/store/cart-page/container.tsx` がマッチしない
- [ ] `grep -n "catch (error: any)" src/components/store/forms/apply-coupon.tsx` がマッチしない
- [ ] `bun run test -- src/lib/log.test.ts src/queries/coupon.test.ts` が exit 0
- [ ] `bun run lint` が exit 0
- [ ] 対象外リストのファイルが一切変更されていない（`git status`）
- [ ] `plans/README.md` の 007 のステータス行が更新されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- 「Current state」の抜粋のいずれかが実コードと一致しない（ドリフト）— 例えば coupon の裸ログ行が既に移行済みである。
- coupon の catch を変換する際、囲み関数名が曖昧（ネストしたクロージャ）であることが判明する — 最も外側の export されたアクション名を使い、その旨を記録する。
- テスト失敗が、呼び出し箇所が非自明な形で古いログ形状に依存していることを示唆する。
- 妥当な修正を試みてもテストが2回失敗する。

## Maintenance notes

- **先送りのフォローアップ（別プラン）**: `src/queries/*`（category、store、product、user、subCategory、offer-tag、…）全体にわたる約90箇所のレガシー3引数 `console.error("Error in X:", error.message, error.stack)` + 重複した `instanceof Error` ブロックを `logError` へ移行すること。これは機械的だが多くのファイルと多くのテストアサーションに触れる — ここではなく、それ自体のレビュー可能なバッチとして行うこと。
- 新規の `src/queries/` catch ブロックは最初から `logError` を呼ぶこと。
- レビュアーは非 Error 分岐が文書化された規約に一致する `{ error }`（生の値）をログしていること、throw されるメッセージテキストが変更されていないことを確認すること。
- 将来の可観測性プランなどで構造化ログのバックエンドが追加される場合、`logError` がそこへ経由させる唯一の受け口となる。
