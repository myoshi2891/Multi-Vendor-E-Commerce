# プラン 009: seller の store-orders クエリを有界化し、破棄された browse ページのクエリを除去する

> 原本: [../009-query-hygiene-bound-store-orders-and-drop-dead-query.md](../009-query-hygiene-bound-store-orders-and-drop-dead-query.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/queries/store.ts "src/app/(store)/browse/page.tsx" src/queries/store.test.ts`
> 対象ファイルのいずれかがこのプラン作成後に変更されていれば、「Current state」の
> 抜粋を実コードと比較すること。不一致があれば STOP。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

2つの独立したクエリ衛生上の改善:

1. **無制限クエリ**: `getStoreOrders` は `db.orderGroup.findMany({ where: { storeId }, include: { items, coupon, order{...} } })` を **`take` なし**で実行している — seller の注文ページが描画されるたびに、店舗の全注文履歴（ネストした items/address/payment を含む）をロードする。店舗が成熟するにつれ無制限に増大する。
2. **破棄されたクエリ**: `browse/page.tsx` は `await getFilteredSizes({})` を呼ぶが結果を一切使用していない — browse/search の描画毎に、実際の商品取得の前に直列化された無駄なブロッキング DB 往復である。

本プランは、store-orders クエリの戻り値形状を変えることなく（seller ページのクライアント側 `DataTable` の検索/ページネーションが引き続き動作するように）**防御的な上限**（`take`）を適用し、dead な browse ページの呼び出しを削除する。注文テーブルの完全なサーバー側ページネーションは意図的に**先送り**する — Maintenance notes 参照 — なぜならそれは `StoreOrderType` が消費する戻り値型を変え、DataTable のブラウザ内検索を退行させるため、この衛生的パスよりも大きくリスクの高い変更になるからである。

> **振る舞いの変更に関する注意（純粋な衛生ではない）**: *戻り値の形*は不変だが、
> *振る舞い*は不変ではない — `take` を超える注文を持つ店舗は、seller ビューから
> 最古の注文が**サイレントに脱落**し、UI 上の signal は何も出ない。これはユーザーに
> 見える切り捨てであり、プロダクト契約として扱うこと: seller ページは `take` と併せて
> 「最新 N 件を表示中」の告知（または同等の affordance）を**必ず**出さなければならない。
> また後続の PERF-04 が本物のページネーションを提供するまで、本番でこの上限に
> 到達しうる状態にしてはならない。**素の `take` を、あたかも不可視であるかのように
> 出荷しないこと。**

## Current state

### 無制限の `getStoreOrders`、`src/queries/store.ts:361-393`

```ts
export const getStoreOrders = async (storeUrl: string) => {
    try {
        const { store } = await requireStoreOwner(storeUrl);
        const orders = await db.orderGroup.findMany({
            where: { storeId: store.id },
            include: {
                items: true,
                coupon: true,
                order: {
                    select: {
                        paymentStatus: true,
                        shippingAddress: { include: { country: true, user: { select: { email: true } } } },
                        paymentDetails: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },   // ← no take
        });
        return orders;
    } catch (error: unknown) { /* logs + rethrow */ }
};
```

**戻り値の形状を制約している consumer**（配列のまま維持する理由）:
- `src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx:23,25` — `let orders: Awaited<ReturnType<typeof getStoreOrders>> = []; orders = await getStoreOrders(storeUrl);` の後に `<DataTable data={orders} ... />` に渡す（クライアント側の検索/ページネーション）。
- `src/lib/types.ts:421` — `export type StoreOrderType = Prisma.PromiseReturnType<typeof getStoreOrders>[0];`（要素 `[0]` をインデックス）。
- `StoreOrderType` は seller の `columns.tsx`、admin の `columns.tsx`、`columns.test.tsx` の全体にわたって使われている。戻り値を配列からページ化されたオブジェクトに変えると、これらすべてに波及する — そのためここでは配列形状を維持する。

### 破棄されたクエリ、`src/app/(store)/browse/page.tsx`

- 6行目: `import { getFilteredSizes } from "@/queries/size";`
- 32行目: `await getFilteredSizes({});`  ← 結果は一切代入も受け渡しもされない

`getFilteredSizes` は他所で**引き続き正当に使用されている**（`src/components/store/browse-page/filters/size/size-filter.tsx:27`、クライアント側）ため、`browse/page.tsx` 内の破棄された呼び出しとその今や未使用の import のみを削除する — 関数自体はそのまま残す。

### リポジトリ規約

- `getStoreOrders` は古い3引数の `console.error` を使用している — そのままにする（ログクリーンアップはプラン 007 の先送りバッチ）。
- 兄弟の `getStoreRecentOrders`（`src/queries/store-dashboard.ts:189`）は既に同じ include 形状で `take` パターンを実演している。

## 必要なコマンド

| 目的    | コマンド                                       | 期待結果          |
|------------|-----------------------------------------------|-------------------|
| 型チェック  | `bunx tsc --noEmit`                           | exit 0            |
| Store テスト | `bun run test -- src/queries/store.test.ts`   | 全件 pass          |
| Lint       | `bun run lint`                                | exit 0（警告は許容） |

## Scope

**対象内**:
- `src/queries/store.ts` — `getStoreOrders` に有界な `take` を追加
- `src/app/(store)/browse/page.tsx` — 破棄された呼び出し + 未使用 import を削除
- `src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx` — 上記の**振る舞いの変更に関する注意が要求する**「最新 N 件を表示中」の告知を出す。これが無いと、プランはユーザーに見える signal を義務付けながら、それを書き込む対象内ファイルを与えていないことになり、素の `take` の出荷は注意が禁じるサイレントな切り捨てそのものになる。
- `src/queries/store.test.ts` — `take` の上限を assert
- `plans/README.md` — 完了時に plan 009 のステータスを更新（別の docs コミット）

**対象外**:
- `getStoreOrders` の戻り値形状の変更やページパラメータの追加（先送り；`StoreOrderType` + DataTable の検索を壊す）。
- `src/lib/types.ts`、`columns.tsx`、`columns.test.tsx` — 変更しないこと（配列形状は正確に維持されているため変更不要）。
- `getFilteredSizes` 自体とそのクライアント側呼び出し元。

## Git ワークフロー

- Branch: `advisor/009-query-hygiene`
- コミットスタイル: 2コミットを推奨 — `perf(store): bound getStoreOrders result set` と `perf(browse): remove discarded getFilteredSizes call`
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: `getStoreOrders` に有界な `take` を追加

定数は `store.ts` にインライン定義せず、**共有モジュール** `src/lib/store-constants.ts` に置く。
こうすることでクエリと seller ページの切り捨て告知（Step 3b）が**同一の**定数を import し、
ドリフトしない:

```ts
// src/lib/store-constants.ts
// 無制限の findMany を防ぐ防御的上限。将来はサーバーサイドページネーションへ移行（PERF-04 follow-up）。
export const STORE_ORDERS_MAX = 200;
```

そのうえで `src/queries/store.ts` で import する（Step 3b の UI import と同一ソース）:

```ts
import { STORE_ORDERS_MAX } from "@/lib/store-constants";
```

`getStoreOrders` の `findMany` にて、`orderBy` の隣に `take: STORE_ORDERS_MAX` を追加する:

```ts
orderBy: { updatedAt: "desc" },
take: STORE_ORDERS_MAX,
```

戻り値は引き続き `orders`（配列）のままなので、consumer の変更は不要。

これは暫定的なプロダクト契約を明示するものである。呼び出し元が受け取るのは更新日時が新しい順で最大200件までであり、サーバーサイドページネーションを実装するまでは古い注文を取得できない。したがって UI と API ドキュメントは、この結果をストアの完全な注文履歴として表示・説明してはならない。

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 2: 破棄された browse ページのクエリを削除

`src/app/(store)/browse/page.tsx` にて:
1. 32行目を削除: `await getFilteredSizes({});`
2. 今や未使用になった6行目の import を削除: `import { getFilteredSizes } from "@/queries/size";`

ファイル内の他の何も `getFilteredSizes` を参照していないことを確認する:
`grep -n "getFilteredSizes" "src/app/(store)/browse/page.tsx"` → 編集後にマッチなし。

**検証**: `bunx tsc --noEmit` → exit 0（未使用 import やシンボル欠落エラーなし）；`bun run lint` → exit 0。

### Step 3: `take` の上限をテストする

`src/queries/store.test.ts` の `getStoreOrders` describe（~1243行目開始）にて、クエリが上限を伴うことを assert するよう成功テストを追加/調整する:
```ts
import { STORE_ORDERS_MAX } from "@/lib/store-constants";

expect(mockDb.orderGroup.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
        where: { storeId: /* the mocked store id */ },
        take: STORE_ORDERS_MAX,
        orderBy: { updatedAt: "desc" },
    })
);
```
大きな `include` ブロックを再現しなくて済むよう `expect.objectContaining` を使う。同 describe 内の既存の所有権/認可テストは変更しないこと。

**検証**: `bun run test -- src/queries/store.test.ts` → 全件 pass。

### Step 3b: seller 注文ページに切り捨て告知を表示する

> **事後documented（2026-07-18 追記）**。Scope は `orders/page.tsx` を
> in-scope に挙げ、告知を behavior-change caveat が*要求する*ものと明記して
> いるが、Step 1-4 は執筆を一度も指示せず、Done criteria も検証していなかった。
> 告知自体は実際に出荷されている。本ステップは実施済みの作業を記録し、
> プランの内部整合を回復して、再実行時に要件が黙って落ちないようにするもの。

`take` の上限と利用者向け告知は **2 つの変更ではなく 1 つ**である。
`take: STORE_ORDERS_MAX` だけを追加すると「全注文」が「最新 200 件、ただし
無告知」に変わり、200 件を超える order group を持つ販売者からは古い注文が
上限の存在を示すものなく消える。これは behavior-change caveat が禁じる
サイレント切り捨てそのものであり、上限を告知なしで出荷してはならない。

`src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx` にて、テーブルの
上に上限を表示する。数値は `200` をハードコードせず共有定数から導出すること
（文言がクエリ側とドリフトしないようにするため）:

```tsx
import { STORE_ORDERS_MAX } from "@/lib/store-constants";

<p className="mb-4 text-sm text-muted-foreground">
    Showing up to the latest {STORE_ORDERS_MAX} orders.
</p>
```

**検証**:

- 定数由来であることの確認（**下の 3 ゲートを全て満たすこと**。Done criteria と同一の構造検証）:

  ```bash
  PAGE='src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx'

  # 1) 共有定数を import していること（ローカル再宣言ではない）
  if grep -qE '^import .*STORE_ORDERS_MAX.*from' "$PAGE"; then
      echo "OK: 共有定数を import している"
  else
      echo "FAIL: STORE_ORDERS_MAX を import していない"; false
  fi

  # 2) ページ内でローカル再宣言していないこと
  if grep -qE '^[[:space:]]*(const|let|var)[[:space:]]+STORE_ORDERS_MAX([[:space:]]|=|:|$)' "$PAGE"; then
      echo "FAIL: STORE_ORDERS_MAX がページ内で再宣言されている"; false
  else
      echo "OK: ページ内での再宣言は無い"
  fi

  # 3) 告知文そのものが定数を JSX 式として埋め込んでいること
  #    （改行チェーンに耐えるよう tr で 1 行化してから照合する）
  #
  #    照合の**前にコメントを除去する**こと。1 行化すると `//` 行コメントの内容が
  #    後続コードと同じ行に潰れ、`/* … */` や JSX の `{/* … */}` も本文と地続きになる。
  #    その結果「告知文をコメントで下書きしただけ」「削除し忘れたデッドコードに
  #    同じ式が残っているだけ」でも合格する —— 守りたいのは**実際にレンダリングされる
  #    告知**が定数に追随することなので、コメントは検査対象から外す。
  #    `[^:]` は `https://…` を行コメントと誤認しないためのガード。
  strip_comments() {
      perl -0pe 's{/\*.*?\*/}{ }gs; s{(^|[^:])//[^\n]*}{$1}g' "$1"
  }
  if strip_comments "$PAGE" | tr '\n' ' ' \
       | grep -qE 'latest[^<>]*\{[[:space:]]*STORE_ORDERS_MAX[[:space:]]*\}[^<>]*orders'; then
      echo "OK: 告知文が定数を値として埋め込んでいる"
  else
      echo "FAIL: 告知文が STORE_ORDERS_MAX を値として埋め込んでいない"; false
  fi
  ```

  **トークンの出現数（`grep -c … -ge 2`）で代替しないこと。** それは「どこかに 2 回出る」
  しか言えず、ページ内でのローカル再宣言（import + `const STORE_ORDERS_MAX = 100`）でも
  合格してしまう。守りたいのは「`store.ts` の上限を引き上げたとき告知の数字も一緒に動く」
  ことなので、**import 由来であること・再宣言が無いこと・告知の固定文言と定数展開が同じ式に
  共在すること**の 3 点を直接検証する必要がある（詳細な根拠は Done criteria 節を参照）。

  **文言依存の literal-200 正規表現（`latest[[:space:]]+200` 等）で代替しないこと。**
  リテラル `200` の不在は「定数由来である」ことを含意しない —— 告知文が別のハードコード値
  （例: `latest 100 orders`）でも通ってしまう。またアンカー語を実装と別言語で書くと
  正しい実装に対して偽の FAIL を返す（同じ事故の記録は Done criteria 節の 2026-07-30 修正）。

  > **不在ゲートを `grep -qE … && { …; false; }` で書かないこと（2026-07-30 修正）。**
  > 以前の (b) はこの形だった。`grep` は不一致（= 合格）で **exit 1** を返し、`&&` は
  > 左辺が偽なら右辺を実行せず短絡するため、**リスト全体の終了ステータスが grep の 1**
  > になる。`false` に到達できるのは一致（= 失格）時だけなので、この形は決して 0 で
  > 終われない。`if … then echo FAIL; false; else echo OK; fi` は両分岐に終了ステータスを
  > 与えるので合格が exit 0 になる。逆向きの **存在**ゲート（(a) や下の 3）が
  > `|| { …; false; }` で正しいのは、合格側で grep が 0 を返し `||` がそれを短絡で
  > そのまま返すため。同じ論点は [`plans/023`](../023-bound-and-validate-public-search-pagination.md)
  > の Done criteria にも記録している。
- `bunx tsc --noEmit` → exit 0。

### Step 4: 完全な lint

**検証**: `bun run lint` → exit 0。

## Test plan

- `store.test.ts`: `getStoreOrders` が `take: STORE_ORDERS_MAX`（上限あり）を渡すことを assert；既存の認可/所有権テストは green のまま。リテラル `200` ではなく定数を参照すること（Step 1 の「クエリと UI が同一の定数を import する」という設計意図をテスト側でも維持するため）。
- browse の削除については型チェック/lint 以上のテストは不要（dead code の除去）；`browse/page.tsx` にテストがあれば引き続き pass することを確認する。
- 構造パターン: `store.test.ts` 内の既存 `getStoreOrders` describe。
- 検証: `bun run test -- src/queries/store.test.ts` → 全件 pass。

## Done criteria

以下すべてを満たすこと:

- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `grep -n "take: STORE_ORDERS_MAX" src/queries/store.ts` が上限適用を示す
- [ ] 切り捨て告知が**共有定数由来**であること（2026-07-18 追加 — 上限と告知は同時に出荷する。告知なしの上限は caveat が禁じるサイレント切り捨てになる）。
    トークンの出現を数えるだけの `grep -n "STORE_ORDERS_MAX" <page.tsx>` では**不十分**:
    ページ側で同名の定数をローカル再宣言していても一致してしまい、`store.ts` の上限を
    引き上げた際に告知の数字だけが取り残される（両者が独立に drift する）。**import 文で
    共有元から取り込んでいること**を検証する:

    ```bash
    PAGE="src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx"
    # 1) 共有定数を import していること（ローカル再宣言ではない）
    grep -nE '^import .*STORE_ORDERS_MAX.*from' "$PAGE"
    # 2) ページ内でローカル再宣言していないこと → ヒット 0 件
    if grep -nE '^[[:space:]]*(const|let|var)[[:space:]]+STORE_ORDERS_MAX([[:space:]]|=|:|$)' "$PAGE"; then
        echo "FAIL: STORE_ORDERS_MAX がページ内で再宣言されている"; false
    else
        echo "OK: ページ内での再宣言は無い"
    fi
    # 3) 告知文そのものが定数を JSX 式として埋め込んでいること。
    #    「告知文の中で使われている」ことを見るため、告知の固定文言と同じ式の中に
    #    {STORE_ORDERS_MAX} が現れることを 1 つのパターンで要求する
    #    （改行チェーンに耐えるよう tr で 1 行化してから照合する）。
    #    **1 行化の前にコメントを除去する** —— 潰すとコメントが本文と地続きになり、
    #    下書きコメントやデッドコードでも合格してしまう（Done criteria 側と同じ理由）。
    perl -0pe 's{/\*.*?\*/}{ }gs; s{(^|[^:])//[^\n]*}{$1}g' "$PAGE" \
      | tr '\n' ' ' \
      | grep -qE 'latest[^<>]*\{[[:space:]]*STORE_ORDERS_MAX[[:space:]]*\}[^<>]*orders' \
      || { echo "FAIL: 告知文が STORE_ORDERS_MAX を値として埋め込んでいない"; false; }
    ```

    1 がヒットし、2 がヒット 0 件、3 が成功したときのみ、告知が共有定数に追随することが保証される。

    実測（2026-07-31・合成フィクスチャ）: 実際に `{STORE_ORDERS_MAX}` をレンダリングする版 =
    **合格** / 告知文はリテラル `100` のままで `//` コメントに式を下書きした版 = **不合格** /
    JSX コメント `{/* latest {STORE_ORDERS_MAX} orders */}` に式が残っている版 = **不合格**。
    コメント除去を挟まない旧形では後者 2 つも合格していた。

    **3 を「token の出現数」で代替しないこと（2026-07-27 修正）。** 以前の形

    ```bash
    grep -n 'STORE_ORDERS_MAX' "$PAGE" | grep -vE '^[[:space:]]*[0-9]+:import'
    ```

    は「import 行**以外**のどこかに token がある」しか示さない。コメント内の言及・
    `take` へ渡すだけの利用・デッドコードでも通ってしまい、**告知文が
    ハードコードした数字（例: 「最新 100 件」）のままでも合格する**。
    このチェックが守りたいのは「上限を引き上げたとき告知の数字も一緒に動く」ことなので、
    告知の固定文言と定数展開が**同じ式に共在する**ことを直接検証する必要がある。
    告知の文言を変える場合は上のパターンのアンカー語（`latest` / `orders`）も併せて
    更新すること。**アンカー語は実装が出している文言と同じ言語にすること**（2026-07-30 修正）:
    以前は `最新` / `件` の日本語パターンだったが、実装（`page.tsx:38`）と本プランの
    スニペット（:198）はどちらも英語の
    `Showing up to the latest {STORE_ORDERS_MAX} orders.` を出している。実測すると
    日本語パターンは**正しい実装に対して exit 1**（偽の FAIL）を返していた。

    **`\s` / `\b` は使わない**（2026-07-26 修正）。どちらも POSIX ERE には無い
    GNU 拡張で、解釈は grep 実装依存になる。文字クラスは `[[:space:]]`、語境界は
    区切り文字の明示（`([[:space:]]|=|:|$)`）で置き換える。1 の `\b` は
    `STORE_ORDERS_MAX` を含む別識別子が存在しないため単純に落とした。
- [ ] `grep -n "getFilteredSizes" "src/app/(store)/browse/page.tsx"` がマッチしない
- [ ] `bun run test -- src/queries/store.test.ts` が exit 0；`take` アサーションが pass
- [ ] `bun run lint` が exit 0
- [ ] `src/lib/types.ts`、seller/admin の `columns.tsx`、`columns.test.tsx` が変更されていない（`git status`）
- [ ] **コードコミットの時点で**、対象外リストのファイルが一切変更されていない（`git status`）— `plans/README.md` のステータス行更新は別の docs コミットで行う
- [ ] `plans/README.md` の 009 のステータス行が更新されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- `getStoreOrders` または `browse/page.tsx` が「Current state」の抜粋と一致しない（ドリフト）。
- `getFilteredSizes` の import を削除するとビルドが壊れる（`browse/page.tsx` の他所で実際に使われている）— 報告する（抜粋が古いことを意味する）。
- `take` の追加が `StoreOrderType` に影響する形で戻り値型を変えてしまう（そうならないはず — 配列要素型は不変）— 報告する。
- 妥当な修正を試みても store のテストが2回失敗する。

## Maintenance notes

- **先送りのフォローアップ（別プラン）**: seller 注文テーブルの真のサーバー側ページネーション — `{ orders, total, page, pageSize }` を返すよう変更し、`StoreOrderType` を `Prisma.PromiseReturnType<typeof getStoreOrders>["orders"][number]` に更新し、クライアント側 `DataTable` 検索をサーバー駆動のページングに置き換える。これは seller/admin の columns とテストに触れる UX + 型変更である；単独でプラン化・レビューすること。それまでの暫定ガードが `STORE_ORDERS_MAX = 200` の上限である。
- レビュアーは戻り値が引き続き配列であること（consumer が壊れていないこと）、`take` が存在することを確認すること。
- ある店舗が正当に200件の order group を超え、seller が「古い注文が見えない」と報告する場合、それは先送りされたページネーションのフォローアップを優先すべきシグナルであり — 上限を無制限に引き上げるべきではない。
