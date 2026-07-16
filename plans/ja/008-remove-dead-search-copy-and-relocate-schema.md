# プラン 008: dead な `search copy.tsx` の削除とインライン `AdminOrderFilterSchema` の `schemas.ts` への移動

> 原本: [../008-remove-dead-search-copy-and-relocate-schema.md](../008-remove-dead-search-copy-and-relocate-schema.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/queries/order.ts src/lib/schemas.ts "src/components/store/layout/header/search/"`
> 対象ファイルのいずれかがこのプラン作成後に変更されていれば、「Current state」の
> 抜粋を実コードと比較すること。不一致があれば STOP。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

2つの小さな規約/衛生上の修正:

1. **Dead file** `src/components/store/layout/header/search/search copy.tsx` は、実体である `search.tsx` の未参照の複製である（確認済み: `src/` のどこにも import されていない）。ファイル名にスペースを含み古いエラーハンドリングを保持しており、保守されているコンポーネントに影を落とし誤編集を誘発する罠になっている。
2. **規約違反**: `AdminOrderFilterSchema` が `src/queries/order.ts:294` にインラインで定義されている。非テストソースで `src/lib/schemas.ts` 外に定義された唯一の `z.object(...)` であり、「Zod スキーマは `src/lib/schemas.ts` に置く」というリポジトリ規約に違反している。co-locate することで admin 注文フィルタの契約が他のスキーマと同様に発見可能・テスト可能になる。

いずれも安全で機械的、独立して検証可能である。

## Current state

### Dead file

`src/components/store/layout/header/search/` には以下が含まれる:
- `search.tsx`（実体のコンポーネント、保守されている）
- `search copy.tsx`（dead な複製 — 削除対象）
- `suggestions.tsx`

`grep -rn "search copy" src/` は何もヒットしない（importer なし）。

### インラインスキーマ、`src/queries/order.ts:294-304`

```ts
const AdminOrderFilterSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    orderStatus: z.nativeEnum(OrderStatus).optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    // limit は throw ではなく clamp（≤100）でキャップし、極端値を 100 に丸める（AC-F2-3）
    limit: z
        .number()
        .default(20)
        .transform((n) => Math.min(Math.max(Math.floor(n), 1), 100)),
});
```

同ファイル内の使用箇所:
- 315行目: `filters?: Partial<z.infer<typeof AdminOrderFilterSchema>>`
- 318行目: `const f = AdminOrderFilterSchema.parse(filters ?? {});`

`order.ts` の enum import（5行目）: `import { OrderStatus, PaymentStatus, ProductStatus } from "@/lib/types";`

`schemas.ts` は既に Prisma から enum を import している（1行目: `import { ShippingFeeMethod } from "@prisma/client";`）、`import * as z from "zod";`（2行目）。スキーマ + 推論型を export している、例: `TrackOrderSchema` / `TrackOrderInput`（15-20行目）。`order.ts` は既に schemas から import している: `import { TrackOrderSchema, type TrackOrderInput } from "@/lib/schemas";`（6行目）。

### リポジトリ規約

- Zod スキーマは `src/lib/schemas.ts` に属する（`.claude/steering/structure.md`「入力バリデーション」；`.claude/steering/tech.md` 規約4）。
- スキーマの形状を正確に維持すること — `limit` クランプの `transform` とそのコメントを含め — バリデーション挙動をバイト単位で同一に保つ。

## 必要なコマンド

| 目的    | コマンド                                       | 期待結果          |
|------------|-----------------------------------------------|-------------------|
| 型チェック  | `bunx tsc --noEmit`                           | exit 0            |
| Order テスト | `bun run test -- src/queries/order.test.ts`   | 全件 pass          |
| Lint       | `bun run lint`                                | exit 0（警告は許容） |

## Scope

**対象内**:
- `src/components/store/layout/header/search/search copy.tsx` を削除
- `src/lib/schemas.ts` — `AdminOrderFilterSchema`（+ 推論型）を追加
- `src/queries/order.ts` — 定義する代わりにスキーマを import する

**対象外**:
- `search.tsx` / `suggestions.tsx` — 現行コンポーネント；触らない。
- スキーマのバリデーション挙動への変更。
- 他所のインラインバリデーション（見つからなかった；見つけた場合は記録するがここでは修正しない）。

## Git ワークフロー

- Branch: `advisor/008-deadcode-and-schema-relocation`
- コミットスタイル: 2コミットを推奨 — `chore(search): remove dead search copy.tsx` と `refactor(order): move AdminOrderFilterSchema to schemas.ts`
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: dead file に importer が無いことを確認してから削除

```
grep -rn "search copy" src/            # expect: no matches
grep -rn "search%20copy\|search_copy\|searchCopy" src/   # expect: no matches
```

両方とも空であれば、ファイルを削除する:
```
git rm "src/components/store/layout/header/search/search copy.tsx"
```

**検証**: `bunx tsc --noEmit` → exit 0（何もそれを参照していない）；ファイルはもう存在しない。

### Step 2: `AdminOrderFilterSchema` を `schemas.ts` に追加

`src/lib/schemas.ts`（他のスキーマの近く）に、形状を**正確に**コピーして追記する:

```ts
export const AdminOrderFilterSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    orderStatus: z.nativeEnum(OrderStatus).optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    // limit は throw ではなく clamp（≤100）でキャップし、極端値を 100 に丸める（AC-F2-3）
    limit: z
        .number()
        .default(20)
        .transform((n) => Math.min(Math.max(Math.floor(n), 1), 100)),
});

export type AdminOrderFilter = z.infer<typeof AdminOrderFilterSchema>;
```

`schemas.ts` の冒頭に enum の import を追加する。`order.ts` がどう import しているかに合わせる — そこでは `PaymentStatus`/`OrderStatus` は `@/lib/types` から来ている。一貫性のため同じソースを優先する:
```ts
import { OrderStatus, PaymentStatus } from "@/lib/types";
```
（`@/lib/types` がこれらの enum を `z.nativeEnum` で使える値として re-export していない場合、`import { OrderStatus, PaymentStatus } from "@prisma/client";` にフォールバックする — `schemas.ts` は既に Prisma の enum を import している。コンパイルが通る方を選ぶこと；`z.nativeEnum` はランタイムの enum オブジェクトを必要とし、型だけでは不可。）

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 3: `order.ts` でスキーマを import しインライン定義を削除

`src/queries/order.ts` にて:
1. 既存の schemas import（6行目）を拡張し、移動したスキーマを含める:
   ```ts
   import { TrackOrderSchema, type TrackOrderInput, AdminOrderFilterSchema } from "@/lib/schemas";
   ```
2. インラインの `const AdminOrderFilterSchema = z.object({ ... });` ブロック（~294-304行目）を削除する。
3. 2つの使用箇所（~315行目の `z.infer<typeof AdminOrderFilterSchema>` と ~318行目の `AdminOrderFilterSchema.parse(...)`）は今や import されたスキーマに解決される — 変更は不要だが、引き続きコンパイルされることを確認する。移動後 `order.ts` で `PaymentStatus`/`OrderStatus`/`z` が未使用になった場合、今や未使用になった import のみを削除する（lint が指摘する）。

**検証**: `bunx tsc --noEmit` → exit 0；`bun run test -- src/queries/order.test.ts` → 全件 pass（`getAllOrders` のフィルタパーステストがこのスキーマを演習する）。

### Step 4: Lint

**検証**: `bun run lint` → exit 0（移動によって生じた未使用 import 警告があれば修正する）。

## Test plan

- 新規テストは厳密には不要 — `src/queries/order.test.ts` の既存 `getAllOrders` テストが既に `AdminOrderFilterSchema.parse`（limit クランプ、enum バリデーション）を演習している。これらが green のまま維持されることで、移動したスキーマが同一に振る舞うことが証明される。
- `src/lib/schemas.test.ts` が存在する場合、任意で `AdminOrderFilterSchema` の直接ユニットテストを追加してもよい；存在しなければスキップする（このために新規インフラを組み立てない）。
- 検証: `bun run test -- src/queries/order.test.ts` → 全件 pass。

## Done criteria

以下すべてを満たすこと:

- [ ] `src/components/store/layout/header/search/search copy.tsx` がもう存在しない
- [ ] `grep -rn "search copy" src/` がマッチしない
- [ ] `grep -n "AdminOrderFilterSchema" src/lib/schemas.ts` が export されたスキーマを示す
- [ ] `grep -n "const AdminOrderFilterSchema = z.object" src/queries/order.ts` がマッチしない（インライン定義が消えている）
- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `bun run test -- src/queries/order.test.ts` が exit 0
- [ ] `bun run lint` が exit 0
- [ ] 対象外リストのファイルが一切変更されていない（`git status`）
- [ ] `plans/README.md` の 008 のステータス行が更新されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- `grep -rn "search copy" src/` が importer を見つける（そのファイルは dead では**ない**）— 削除せず報告する。
- `order.ts` 内のスキーマ抜粋が「Current state」と一致しない（ドリフト）。
- `z.nativeEnum(PaymentStatus)` が `@/lib/types` と `@prisma/client` の両方からコンパイルに失敗する — 型エラーを報告する。
- 妥当な修正を試みても order のテストが2回失敗する。

## Maintenance notes

- 新規のサーバーアクション入力スキーマは最初から `src/lib/schemas.ts` に置くこと。
- レビュアーは `limit` クランプの `transform` とそのコメントが移動後も逐語的に維持されていること（バリデーション挙動が同一であること）を確認すること。
- 後に `src/lib/schemas.test.ts` が追加される場合、そこで `AdminOrderFilterSchema`（limit クランプ境界、enum 拒否）をカバーする。
