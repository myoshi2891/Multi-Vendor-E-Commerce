# プラン 002: seller が編集可能な Store フィールドを allowlist 化する（クライアントによる `status` / `featured` / rating の制御を止める）

> 原本: [../002-allowlist-mutable-store-fields.md](../002-allowlist-mutable-store-fields.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/queries/store.ts src/queries/store.test.ts prisma/schema.prisma`
> 対象ファイルのいずれかがこのプラン作成後に変更されていれば、「Current state」の
> 抜粋を実コードと比較すること。不一致があれば STOP。

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

`upsertStore` と `applySeller` は、クライアントから渡された `store` オブジェクト全体を `db.store.update` / `db.store.create` に spread している。これには seller が自分で設定してはならない特権カラムが含まれる: `status`（PENDING/ACTIVE/BANNED/DISABLED — モデレーション状態）、`featured`（ホームページ露出）、`averageRating` / `numReviews`（算出された評判）。したがって seller は、admin が BANNED にした店舗を通常の店舗編集リクエスト経由で再度 ACTIVE 化（モデレーションバイパス）したり、自店舗を `featured: true` に昇格させたり、rating を偽装したりできてしまう。本プランは両方の書き込み経路を、seller が編集可能なフィールドの明示的な allowlist に制限し、特権カラムは既存の admin 専用アクションからのみ変更できるようにする。

## Current state

- `src/queries/store.ts` — seller の店舗 CRUD。脆弱な書き込み経路は2つ:
  - `upsertStore(store: Partial<Store>)`（20行目開始）
  - `applySeller(store: StoreType)`（416行目開始）
- admin 専用の status 制御は既に別所（モデレーション経路）に存在する；seller はそれを重複させてはならない。

脆弱な update 経路、`src/queries/store.ts:89-95`:

```ts
// id と userId を除外して更新
const { id, userId, ...storeDataToUpdate } = store;

storeDetails = await db.store.update({
    where: { id: String(id) },
    data: storeDataToUpdate,   // ← status/featured/averageRating/numReviews all pass through
});
```

脆弱な create 経路、`src/queries/store.ts:125-143`:

```ts
const { userId, ...storeWithoutUserId } = store;
const createData = {
    ...storeWithoutUserId,
    name: store.name!,
    email: store.email!,
    url: store.url!,
    description: store.description || "",
    phone: store.phone || "",
    logo: store.logo || "",
    cover: store.cover || "",
    featured: store.featured ?? false,     // ← honors client value
    status: store.status ?? "PENDING",     // ← honors client value
    defaultShippingService: store.defaultShippingService || "International Delivery",
    returnPolicy: store.returnPolicy || "Return in 30 days.",
    userId: user.id,
};
storeDetails = await db.store.create({ data: createData });
```

脆弱な applicant 経路、`src/queries/store.ts:458-467`:

```ts
const storeDetails = await db.store.create({
    data: {
        ...store,                          // ← spreads client status/featured
        defaultShippingService: store.defaultShippingService || "International Delivery",
        returnPolicy: store.returnPolicy || "Return in 30 days.",
        userId: user.id,
    },
});
```

### 特権フィールド（`prisma/schema.prisma` の `model Store` 由来）

これらはサーバー制御の既定値を持ち、seller が設定できてはならない:

```
status        StoreStatus @default(PENDING)
averageRating Float       @default(0)
numReviews    Int         @default(0)
featured      Boolean     @default(false)
```

### seller が編集可能なフィールド（クライアントから受け取ってよい）

`name, description, email, phone, url, logo, cover, returnPolicy, defaultShippingService, defaultShippingFeePerItem, defaultShippingFeeForAdditionalItem, defaultShippingFeePerKg, defaultShippingFeeFixed, defaultDeliveryTimeMin, defaultDeliveryTimeMax, lowStockThreshold`。（ドリフトチェック時に実際の `model Store` と突合すること；スキーマを source of truth とする。）

### リポジトリ規約

- `upsertStore` は古いインライン `currentUser()` + role チェックを使用している（既存）。ここで auth-guards への移行は**しない** — 対象外。
- **update** では、既にオーナーチェックが前段で走っている（`id` + `userId` による `existingStore` lookup、~38行目）。これは維持する。
- この修正は純粋に「allowlist から書き込みペイロードを組み立てる」ことであり、バリデーション・重複チェック・エラーメッセージは変更しない。

## 必要なコマンド

| 目的   | コマンド                                     | 期待結果            |
|-----------|---------------------------------------------|---------------------|
| 型チェック | `bunx tsc --noEmit`                         | exit 0              |
| ユニットテスト | `bun run test -- src/queries/store.test.ts` | 全件 pass            |
| Lint      | `bun run lint`                              | exit 0（警告は許容）   |

## Scope

**対象内**:
- `src/queries/store.ts` — `upsertStore`（update + create 両分岐）と `applySeller`
- `src/queries/store.test.ts` — mass-assignment 回帰テストを追加

**対象外**:
- admin の店舗ステータス変更アクション（正規の `status`/`featured` 書き手）— 触らない。
- `src/lib/schemas.ts` の `StoreFormSchema` — この Zod フォームスキーマは既にフォーム用に `status`/`featured` を除外している；変更は不要でありフォーム破損のリスクがある。
- `upsertStore` 内のインライン認可ブロック。

## Git ワークフロー

- Branch: `advisor/002-allowlist-store-fields`
- コミットスタイル: `fix(store): allowlist seller-editable fields (mass assignment)`
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: `store.ts` 冒頭に単一の allowlist ヘルパーを追加

seller が編集可能なキーを列挙するモジュールレベル定数と、両書き込み経路が共有できる小さな picker を定義する:

```ts
// Seller が編集可能な Store フィールドのみを許可する allowlist。
// status / featured / averageRating / numReviews は特権フィールドのため
// クライアント入力から読まない（モデレーション/featured/評価の改ざん防止）。
const SELLER_EDITABLE_STORE_FIELDS = [
    "name", "description", "email", "phone", "url", "logo", "cover",
    "returnPolicy", "defaultShippingService",
    "defaultShippingFeePerItem", "defaultShippingFeeForAdditionalItem",
    "defaultShippingFeePerKg", "defaultShippingFeeFixed",
    "defaultDeliveryTimeMin", "defaultDeliveryTimeMax", "lowStockThreshold",
] as const;

type SellerEditableStoreFields = Pick<
    Store,
    (typeof SELLER_EDITABLE_STORE_FIELDS)[number]
>;

function pickSellerEditableStoreFields<T extends object>(
    store: T
): Partial<SellerEditableStoreFields> {
    const out: Partial<SellerEditableStoreFields> = {};
    for (const key of SELLER_EDITABLE_STORE_FIELDS) {
        const value = Reflect.get(store, key) as
            | SellerEditableStoreFields[typeof key]
            | undefined;
        if (value !== undefined) {
            Object.assign(out, { [key]: value });
        }
    }
    return out;
}
```

（戻り値は `Record<string, unknown>` では**なく** `Partial<Pick<Store, ...>>` にすること — strict TypeScript
のもとで Prisma の `StoreUpdateInput`/`StoreCreateInput` へ代入可能な状態を保つため。`key in store` ではなく
型付きキーリストと `Reflect.get` を使う；リポジトリは `any` を禁止している。これが実際に
`src/queries/store.ts` へ出荷されている形である。）

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 2: `upsertStore` の update 分岐を allowlist 経由に書き換える

`const { id, userId, ...storeDataToUpdate } = store;` + `db.store.update({ data: storeDataToUpdate })`（~89-95行目）を以下に置換する:

```ts
storeDetails = await db.store.update({
    where: { id: String(store.id) },
    data: pickSellerEditableStoreFields(store),
});
```

これで `status`/`featured`/`averageRating`/`numReviews` が update ペイロードに含まれることは二度とない。

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 3: `upsertStore` の create 分岐を書き換えて安全な既定値を強制する

`createData` オブジェクト（~127-142行目）を、特権フィールドがクライアント設定ではなくサーバー設定になるよう書き換える:

```ts
const createData = {
    ...pickSellerEditableStoreFields(store),
    name: store.name!,
    email: store.email!,
    url: store.url!,
    description: store.description || "",
    phone: store.phone || "",
    logo: store.logo || "",
    cover: store.cover || "",
    featured: false,                 // 特権: 常にサーバー既定
    status: StoreStatus.PENDING,     // 特権: 常にサーバー既定（admin のみ変更可）
    defaultShippingService: store.defaultShippingService || "International Delivery",
    returnPolicy: store.returnPolicy || "Return in 30 days.",
    userId: user.id,
};
```

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 4: `applySeller` の create からクライアントの特権フィールドを除去する

`data: { ...store, ... }` の spread（~459-465行目）を以下に置換する:

```ts
data: {
    ...pickSellerEditableStoreFields(store),
    name: store.name!,
    email: store.email!,
    url: store.url!,
    featured: false,
    status: StoreStatus.PENDING,   // 申請は必ず PENDING（admin レビュー必須）
    defaultShippingService: store.defaultShippingService || "International Delivery",
    returnPolicy: store.returnPolicy || "Return in 30 days.",
    userId: user.id,
},
```

`applySeller` の `StoreType` の都合で一部の必須カラムが non-optional になっており TypeScript が欠落フィールドについて文句を言う場合は、同じパターンで `store.<field>!` から追加する — ただし `status`/`featured` をクライアントから追加することは絶対にしない。既定値のない**必須**カラムが allowlist に無い場合は、STOP して報告すること（プロダクト判断が必要）。

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 5: mass-assignment 回帰テストを追加

`src/queries/store.test.ts` に、既存の `upsertStore` テストとこのファイル内の IDOR 系アサーションを手本にテストを追加する:

「Current state」で挙げた特権カラムを**すべて**カバーすること — `status`、`featured`、
**および計算値である評価フィールド `averageRating` / `numReviews`**。評価の偽装は本プランが
塞ぐべき 3 つの攻撃の 1 つであり、ここを assert しないと回帰網なしで allowlist を出荷することになる。

1. `upsertStore` **update**: `status: "ACTIVE"`、`featured: true`、`averageRating: 4.9`、`numReviews: 999` を含む `store` オブジェクトで呼び出し、`db.store.update` の呼び出しに渡された `data` がそのいずれも**含まない**ことを assert する:
   ```ts
   const call = mockDb.store.update.mock.calls[0][0];
   expect(call.data).not.toHaveProperty("status");
   expect(call.data).not.toHaveProperty("featured");
   expect(call.data).not.toHaveProperty("averageRating");
   expect(call.data).not.toHaveProperty("numReviews");
   ```
2. `upsertStore` **create**: `status: "ACTIVE"`、`featured: true`、`averageRating: 4.9`、`numReviews: 999` で呼び出し、`db.store.create` の `data.status === "PENDING"` かつ `data.featured === false` であること、および `data` が `averageRating` も `numReviews` も持たない（`prisma/schema.prisma:85-86` のスキーマ既定値が効く）ことを assert する。
3. `applySeller`: 同様のアサーション — 入力に関わらず applicant create は `status: "PENDING"`、`featured: false` を強制し、`averageRating` / `numReviews` を落とす。

> **注**: `applySeller` の create ケースについては `src/queries/store.test.ts:507-527` が
> 既に `averageRating` / `numReviews` を assert 済み（コミット `3247e42`）。それは残したまま、
> 未 assert の `upsertStore` 2 経路へ同じカバレッジを広げること。

**検証**: `bun run test -- src/queries/store.test.ts` → 新規テストを含め全件 pass。

### Step 6: 完全な型チェック + lint

**検証**: `bunx tsc --noEmit` → exit 0；`bun run lint` → exit 0。

## Test plan

- `src/queries/store.test.ts` に新規テストを追加: update が `status`/`featured` を除去すること；create が `PENDING`/`false` を強制すること；`applySeller` が `PENDING`/`false` を強制すること。正規フィールド（`name`、`returnPolicy` 等）が引き続き永続化される happy-path アサーションも1件含める。
- 構造パターン: 同テストファイル内の既存 `upsertStore` describe ブロック。
- 検証: `bun run test -- src/queries/store.test.ts` → 全件 pass。

## Done criteria

以下すべてを満たすこと:

- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `bun run test -- src/queries/store.test.ts` が exit 0；新規 mass-assignment テストが pass
- [ ] `grep -n "status: store.status" src/queries/store.ts` がマッチしない
- [ ] `grep -n "featured: store.featured" src/queries/store.ts` がマッチしない
- [ ] `grep -n "\.\.\.store\b" src/queries/store.ts` が `db.store.create`/`update` の data ペイロードへの生クライアント spread を残していない
- [ ] **コードコミットの時点で**、対象外リストのファイルが一切変更されていない（`git status`）— `plans/README.md` のステータス行更新は別の docs コミットで行う
- [ ] `plans/README.md` の 002 のステータス行が更新されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- `store.ts` の書き込み経路が「Current state」の抜粋と一致しない（ドリフト）。
- allowlist にも安全にサーバー設定されるものにも含まれない、既定値のない必須 Store カラムが存在する（その値の出所についてプロダクト判断が必要）。
- 妥当な修正を試みてもテストが2回失敗する。
- （`store.ts` 以外の）他のサーバーアクションでも同様にクライアントの store データを create/update に spread している箇所を見つけた場合 — 記録はするがここでは修正せず、フォローアッププランとして報告する。

## Maintenance notes

### 訂正（2026-07-19）: Step 3 / Step 4 の `status` を `StoreStatus.PENDING` に修正

本プランは DONE だが、**執筆時点から誤っていた技術的事実**のため本文を訂正した（履歴は本節に残す）。

- **訂正前**: Step 3 / Step 4 の code snippet が `status: "PENDING"`（文字列リテラル）だった。
- **訂正後**: 両方とも `status: StoreStatus.PENDING`（`@/lib/types` の enum）。

**なぜ誤りだったか（2 箇所で理由が異なる）**:

1. **Step 3 は型エラーになる**。Step 3 は `const createData = { ... }` という**独立した
   オブジェクトリテラル**を作り、後から `db.store.create({ data: createData })` に渡す形。
   独立リテラルには contextual type が無いため `"PENDING"` は `string` に**幅拡大（widening）**
   され、`StoreStatus` に代入不可となる。つまりこの snippet のままでは Step 3 自身の検証ゲート
   `bunx tsc --noEmit` → exit 0 を通らない。
2. **Step 4 は型エラーにはならない**。Step 4 は `data: { ... }` と**インラインで**書くため
   contextual typing が効き、`"PENDING"` はリテラル型のまま通る。こちらは型の誤りではなく
   **Step 3 との記法の不統一**であり、揃えるために併せて訂正した。

**実装の実態**: 実際にマージされたコードは両箇所とも enum を使っている
（[`src/queries/store.ts`](../../src/queries/store.ts) の `upsertStore` create 分岐 /
`applySeller` create 分岐、いずれも `status: StoreStatus.PENDING`）。
`StoreStatus` は `import { ..., StoreStatus, ... } from "@/lib/types"` で取り込む。
本訂正は**プラン本文を実装に合わせた**ものであり、実装側の変更は伴わない。

**実測根拠**（2026-07-31 再確認。「enum を代入して大丈夫なのか」を読者が再検証せずに済ませるため）:

| 実測項目 | 結果 |
|---|---|
| アプリ側の型 | `src/lib/types.ts:509` の **TS `enum`**（文字列 enum。`PENDING = "PENDING"` 他 4 メンバー） |
| Prisma 側の型 | `node_modules/.prisma/client/index.d.ts:182-189` — `export type StoreStatus = (typeof StoreStatus)[keyof typeof StoreStatus]` すなわち **リテラル union** `'PENDING' \| 'ACTIVE' \| 'BANNED' \| 'DISABLED'` |
| 代入可否 | 文字列 enum メンバーの型は基底となる文字列リテラル型の subtype なので、**union へ代入可能**（逆向き＝ union から enum への代入は不可） |
| コンパイル検証 | `bunx tsc --noEmit` → **exit 0**（`src/queries/store.ts:180` `upsertStore` / `:514` `applySeller` の 2 箇所が `status: StoreStatus.PENDING` を含んだ状態で） |

したがって Step 4 の主張（インライン `data: { … }` は contextual typing が効くので `"PENDING"`
でも通る／enum でも通る）は、**型定義の形とコンパイル結果の両方で裏付けられている**。
一方 Step 3 のような独立リテラルは widening が起きるため enum 表記が必須である点も変わらない。

### 通常の保守メモ

- `prisma/schema.prisma` に新しい seller 編集可能な Store カラムが追加された場合、`SELLER_EDITABLE_STORE_FIELDS` に追加すること — さもないと seller によるそのフィールドの編集がサイレントに no-op になる。
- 新しい**特権**カラムが追加された場合、それが allowlist に**含まれない**こと、create 時にサーバー設定されることを確認する。
- レビュアーは `...store` の spread がもはや `db.store.create`/`update` の `data` に到達しないこと、admin の status/featured アクションが引き続きそれらのフィールドの唯一の書き手であることを確認すること。
- 先送り事項: `upsertStore` のインライン認可を `requireStoreOwner` へ移行すること（別プラン；この修正を最小限に保つため）。
