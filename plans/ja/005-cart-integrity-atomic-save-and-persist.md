# プラン 005: カート整合性の修正 — 原子的な `saveUserCart` とカートストアの永続化を単一ソース化

> 原本: [../005-cart-integrity-atomic-save-and-persist.md](../005-cart-integrity-atomic-save-and-persist.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/queries/user.ts src/cart-store/useCartStore.ts src/cart-store/useCartStore.test.ts src/queries/user.test.ts`
> 対象ファイルのいずれかがこのプラン作成後に変更されていれば、「Current state」の
> 抜粋を実コードと比較すること。不一致があれば STOP。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

2つの独立したカート永続化バグが、それぞれサイレントなデータ損失を引き起こす:

1. **サーバー（`saveUserCart`）** は既存カートを削除してから新規カートを作成する処理を、**トランザクションなし**の2つの別々の await で行っている。`delete` がコミットされた後に `create` が失敗すると、ユーザーのサーバー側カートは消える。これは「複数テーブル更新は `db.$transaction` を使う」というリポジトリ規約にも違反している。
2. **クライアント（`useCartStore`）** は削除時に手動で `localStorage.setItem('cart', JSON.stringify(updatedCart))` を、空にする際に `localStorage.removeItem('cart')` を呼んでいる。しかしストアは同じ `'cart'` キーに対して Zustand の `persist` middleware を使用しており、これは `{"state":{...},"version":0}` というラップされた形式を書き込む。手動書き込みはこのラッパーを裸配列で上書きしてしまうため、アイテムを削除してリロードすると `persist` の rehydrate が失敗し、カートがリセット/破損する。セッション中はメモリ上の状態が正しく見えるため、このバグは不可視である。

いずれも小規模で外科的な修正であり、明確な回帰テストを伴う。

## Current state

### サーバー: `src/queries/user.ts`（`saveUserCart`）

非原子的な delete-then-create、`src/queries/user.ts:251-285`（`f9752c0` 時点）:

```ts
// 検証成功後に既存カートを削除（検証前に削除するとエラー時にカート消失）
if (userCart) {
    await db.cart.delete({ where: { userId } });
}

// Save the validated items to the cart in the database
const cart = await db.cart.create({
    data: {
        cartItems: { create: validatedCartItems.map((item) => ({ /* ... */ })) },
        shippingFees: shippingFee,
        subTotal,
        total,
        userId,
    },
});

if (cart) return true
```

コメント自体が順序の重要性を認識していることを示している — が、delete と create は依然として別々のトランザクションである。その間の失敗でカートが失われる。

### クライアント: `src/cart-store/useCartStore.ts`

このストアは `zustand/middleware`（3行目で import）の `persist(..., { name: 'cart' })`（256行目）で作られている。3箇所の手動 localStorage 呼び出しがこれと衝突する:

```ts
// removeFromCart — line 206
localStorage.setItem('cart', JSON.stringify(updatedCart))

// removeMultipleFromCart — line 231
localStorage.setItem('cart', JSON.stringify(updatedCart))

// emptyCart — line 240
localStorage.removeItem('cart')
```

`persist` は `set(...)` が走るたびに既に `'cart'` キーを書き込んでいるため、これらの行は冗長であると同時に破壊的である。3つのアクションはいずれも、手動 localStorage の行の直前に `set(() => ({ cart: updatedCart, totalItems, totalPrice }))` を既に呼んでいる — つまり手動行を削除しても何も失われない；`persist` がそれを処理する。

### リポジトリ規約

- 複数テーブルの書き込みには **`db.$transaction` が必須**（`.claude/steering/tech.md`）。`cart.delete` + `cart.create`（ネストした `cartItems.create` を伴う）はこれに該当する。
- カートストアのテストは `src/cart-store/useCartStore.test.ts`（テストルールに従い co-located）にある。`saveUserCart` のテストは `src/queries/user.test.ts`（describe は217行目開始）にある。
- `saveUserCart` のバリデーション・価格計算・配送料ロジックは変更しないこと — delete+create を原子的に包むことだけを行う。

## 必要なコマンド

| 目的        | コマンド                                          | 期待結果          |
|----------------|--------------------------------------------------|-------------------|
| 型チェック      | `bunx tsc --noEmit`                              | exit 0            |
| ストアテスト     | `bun run test -- src/cart-store/useCartStore.test.ts` | 全件 pass    |
| サーバーテスト    | `bun run test -- src/queries/user.test.ts`      | 全件 pass          |
| Lint           | `bun run lint`                                   | exit 0（警告は許容） |

## Scope

**対象内**:
- `src/queries/user.ts` — `saveUserCart` のトランザクションラップ
- `src/cart-store/useCartStore.ts` — 手動 localStorage 呼び出し3箇所を削除
- `src/queries/user.test.ts` — 原子性テスト
- `src/cart-store/useCartStore.test.ts` — persist 整合性アサーション

**対象外**:
- `placeOrder` の二重送信/冪等性（プラン 006）。
- ストア内の `totalPrice` の float 合計（`sum + item.price * item.quantity`）— 別の金額精度の課題；ここでは変更しない。
- その他の `db.cart.*` 呼び出し箇所。

## Git ワークフロー

- Branch: `advisor/005-cart-integrity`
- コミットスタイル: `fix(cart): make saveUserCart atomic and stop clobbering persist storage`
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: `saveUserCart` の delete+create をトランザクションで包む

`src/queries/user.ts` にて、別々の `db.cart.delete(...)` と `db.cart.create(...)`（~251-285行目）を単一の `db.$transaction` に置換する:

```ts
const cart = await db.$transaction(async (tx) => {
    if (userCart) {
        await tx.cart.delete({ where: { userId } });
    }
    return tx.cart.create({
        data: {
            cartItems: { create: validatedCartItems.map((item) => ({ /* unchanged */ })) },
            shippingFees: shippingFee,
            subTotal,
            total,
            userId,
        },
    });
});

if (cart) return true;
```

`cartItems.create` のマッピングとすべてのフィールド値はそのまま維持する — トランザクションラッパーのみが新規追加。これで `create` が失敗した場合、`delete` はロールバックされ古いカートが残る。

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 2: カートストア内の手動 localStorage 呼び出しを削除

`src/cart-store/useCartStore.ts` にて、以下の3行（とその前にある `// ...localStorage...` コメント）を削除する:
- ~206行目: `removeFromCart` 内の `localStorage.setItem('cart', JSON.stringify(updatedCart))`
- ~231行目: `removeMultipleFromCart` 内の `localStorage.setItem('cart', JSON.stringify(updatedCart))`
- ~240行目: `emptyCart` 内の `localStorage.removeItem('cart')`

それらの前にある `set(() => ({ ... }))` の呼び出しは**削除しない** — それが `persist` を駆動している。`emptyCart` アクションは引き続き cart を `[]` に `set` しなければならない（234-238行目で既にそうなっている）；`persist` がその後 空の状態をラッパー付きで書き込む。

**検証**: `bunx tsc --noEmit` → exit 0、かつ `grep -n "localStorage" src/cart-store/useCartStore.ts` がマッチしない。

### Step 3: テスト — サーバーの原子性

> **このユニットテストのスコープ**: モックした `db.$transaction` は、実 DB の原子性やロールバックを
> 証明するものでは**ない** — 証明できるのは、コードが delete+create を `$transaction` *経由で*
> 配線していることと、callback 内部からの reject が伝播することだけである。エラー時の実際の
> ロールバックは、実 DB に対する統合テストで検証しなければならない（これは統合テストシリーズ、
> 例えばプラン 027/031 の担当領域である。`docs/testing/SECURITY_GAP_REPORT.md` §5.2 の
> mock vs integration の切り分けに従う）。テストの description もそれに合わせて書くこと —
> 「原子性を証明する」と主張しないこと。

`src/queries/user.test.ts` の `saveUserCart` describe（~217行目）に、delete+create が**単一の `$transaction` を経由して配線されている**ことと、callback の reject が表面化することを証明するテストを追加する:
- `db.$transaction` をモックし、その callback を `tx.cart.create` が **reject** する `tx` で呼び出す；`saveUserCart(...)` が reject し、操作が成功を報告しないことを assert する（delete+create はトップレベルの独立した呼び出しではなく、トランザクションの callback 経由で発行される）。
- 既存の happy-path テストを調整する: 現在おそらく `db.cart.delete` / `db.cart.create` を直接モックしている。コードが今や `db.$transaction(cb)` を呼ぶため、`db.$transaction.mockImplementation(async (cb) => cb(mockTx))` として `mockTx.cart.delete`/`create` を jest fn にする — このリポジトリの他のトランザクション使用テストがどうモックしているかを踏襲する（ファイル内の既存 `$transaction` モック利用箇所を検索；`order.test.ts` は `callback(mockDb)` の passthrough パターンを使用）。

**検証**: `bun run test -- src/queries/user.test.ts` → 全件 pass。

### Step 4: テスト — クライアントの persist 整合性

`src/cart-store/useCartStore.test.ts` に、`removeFromCart` 後、永続化された `'cart'` localStorage エントリが裸配列ではなく**ラップされた** persist 形式であることを検証するテストを追加する:
```ts
// after adding then removing an item via the store actions
const raw = localStorage.getItem('cart');
expect(raw).toBeTruthy();
const parsed = JSON.parse(raw as string);
expect(parsed).toHaveProperty('state');       // persist wrapper, not a bare array
expect(Array.isArray(parsed)).toBe(false);
```
ストア + localStorage の初期化方法については、このファイルの既存テストセットアップに従うこと（jsdom が `localStorage` を提供する）。既存テストが `beforeEach` でストレージをリセットしていれば、それを維持する。

**検証**: `bun run test -- src/cart-store/useCartStore.test.ts` → 全件 pass。

### Step 5: 完全な型チェック + lint

**検証**: `bunx tsc --noEmit` → exit 0；`bun run lint` → exit 0。

## Test plan

- サーバー: トランザクションロールバックテスト（create 失敗 → 成功なし）+ `$transaction` モックを使った調整済み happy path。
- クライアント: 削除後の persist ラッパー整合性テスト（ラップされた形式を assert）+ 空カートが有効な永続化空状態を残すことの確認。
- 構造パターン: `user.test.ts` の `saveUserCart` describe；`useCartStore.test.ts` の既存カートアクションテスト。
- 検証: 両テストコマンドが新規テストとともに pass する。

## Done criteria

以下すべてを満たすこと:

- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `grep -n "localStorage" src/cart-store/useCartStore.ts` がマッチしない
- [ ] `grep -n "db.\$transaction" src/queries/user.ts` が `saveUserCart` が delete+create を包んでいることを示す
- [ ] `bun run test -- src/queries/user.test.ts` が exit 0；原子性テストが存在する
- [ ] `bun run test -- src/cart-store/useCartStore.test.ts` が exit 0；persist 整合性テストが存在する
- [ ] `bun run lint` が exit 0
- [ ] 対象外リストのファイルが一切変更されていない（`git status`）
- [ ] `plans/README.md` の 005 のステータス行が更新されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- `saveUserCart` またはカートストアのコードが「Current state」の抜粋と一致しない（ドリフト）。
- 手動 localStorage 呼び出しの削除により、裸配列形式を assert しているテストが壊れる — そのテストはバグをコード化している；ラップ形式に更新すること、ただし不明瞭な場合は報告する。
- カートストアが init 時のどこかで裸配列の `'cart'` キーを読んでいる（`persist` 外での手動 rehydrate）ことが判明した場合 — 書き込みを削除する前に報告する。
- 妥当な修正を試みてもテストが2回失敗する。

## Maintenance notes

- 将来の機能でサーバーからカートを hydrate する必要が生じた場合、それは `setCart`/`persist` を経由して行うこと。決して `'cart'` localStorage キーを直接書き込まないこと — それはこの破損を再発させる。
- レビュアーはこの変更後、`persist` が `'cart'` キーの*唯一の*書き手であることを確認すること。
- ストアの `totalPrice` は引き続き float 合計を使用している；金額精度が課題になれば、それは別の Decimal 移行である（本プランの対象外）。
