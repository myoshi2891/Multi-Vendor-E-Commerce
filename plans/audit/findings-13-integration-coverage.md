# Findings 13 — Integration テスト特化監査（Round 5 / vetted）

> **Round 5**（2026-07-11 / 監査対象ソース HEAD `1750ef2` / branch `dev`）。
> `tests` フォーカス・**Integration（testcontainers 実 PostgreSQL）限定**の監査。
> **方法**: `bun run test:integration` の実測（Docker 起動済み）→ 既存 17 テストの検証境界と
> 実アサーションの突合 → `$transaction` / raw SQL / webhook 全サイトの直接読解による gap 精査 →
> **全所見を本体が直接コードを開いて vet 済み**（サブエージェント不使用）。
> Round 1 raw（TESTS-01〜10）・Round 4（TESTS-11〜14）との reconcile を含む。

## ベースライン実測（2026-07-11 — Round 5 で初の実測）

| 指標 | 値 |
|---|---|
| Integration（testcontainers） | **17 passed / 17 total / 2 スイート — 全 pass**（exit 0） |
| 実行時間 | **4.779 s**（コンテナ起動 + TRUNCATE リセット込み。teardown 正常: `[integration-teardown] testcontainers stopped`） |
| 実行コマンド | `bun run test:integration`（`jest.integration.config.js`、`bun run test` の集計外） |
| 前回統計との差分 | なし（QA_HANDOFF 記載の 17 / 2 と一致。Round 4 の「Docker 停止により未実測」状態を解消） |

> 補足: 実行ログに `applyCoupon` の意図的な異常系テストによる `console.error` 出力あり
> （`coupon.ts:332` — 期待どおりの挙動でノイズのみ。失敗ではない）。

## スコープ定義

- **対象**: `tests/integration/`（testcontainers 実 PostgreSQL、ADR-004）のみ。
- **対象外**: `prisma/seed/__tests__/`（シードテスト — `docs/testing/TESTING_DESIGN.md` 上の
  別 tier。seeder ロジックの検証であり、アプリケーション server action の統合検証ではない）。
- **重複回避**: plan **027**（TESTS-05+08 = placeOrder オーバーセルロールバック + PLATFORM
  クーポン端数）は既存プランのため本ラウンドで再プラン化しない。本ラウンドの所見は
  027 と**シナリオ・対象分岐が重ならない**ことを個別に確認済み。

## 既存 17 テストの検証境界（現状マトリクス）

| スイート | テスト | 検証済みの境界 |
|---|---|---|
| `order-placement.test.ts`（6） | S1 single-store | Order/OrderGroup/OrderItem の FK 結線・Decimal 集計・ITEM 送料 |
| | S2 multi-store | 店舗別 OrderGroup 分割・店舗スコープ集計 |
| | S3 stock capping | `validQuantity = Math.min(quantity, stock)` の事前キャップ |
| | S4 STORE クーポン | 店舗限定割引の適用先・couponId 結線 |
| | S5 ownership guard | 他人カートの IDOR 拒否 + **副作用なし**（Order 0 件） |
| | S6 invalid combination | 不正 variant/size 組合せの拒否 + Order 非永続化 |
| `cart-checkout.test.ts`（11） | S1×2 Zustand persist | localStorage hydration / addToCart 永続化 |
| | S2×3 送料 3 方式 | ITEM/WEIGHT/FIXED の computeShippingTotal と DB 永続値の一致 |
| | S3×5 applyCoupon | 適用成功 / 不正コード / 期限切れ / 対象店舗なし / 二重適用 |
| | S4×1 未認証 redirect | CheckoutPage の `redirect('/cart')` |

**カバーされていない統合面（本監査の対象）**: 注文後のライフサイクル（ステータス遷移・
キャンセル/返金・在庫復元）、webhook による決済状態反映、raw SQL（tsvector 全文検索）、
レビュー集計、店舗承認遷移。いずれも `$transaction` / raw SQL / unique 制約という
**モック unit テストでは構造しか検証できない**実 DB セマンティクスを含む。

---

## 新規所見（Round 5・すべて直接 vet 済み）

### [TESTS-15] 注文キャンセル/返金の子連動 + 在庫復元（restock）が実 DB 未検証 — TESTS-06 の昇格・拡張

> **⚠️ `Cancelled` と `Canceled` の綴り違いはタイポではない — 別 enum の正しい綴りである**。
> `prisma/schema.prisma` は 2 つの enum で綴りを違えている:
>
> | enum | 綴り | 定義 | 本節での登場箇所 |
> |---|---|---|---|
> | `PaymentStatus` | **`Cancelled`**（L 二重） | `schema.prisma:488` | `updateOrderPaymentStatus` の `paymentStatus` 遷移 |
> | `OrderStatus` | **`Canceled`**（L 単一） | `schema.prisma:475` | `updateOrderGroupStatusAsAdmin` の `orderStatus` 遷移 |
>
> **どちらかに寄せて「統一」してはならない** — 台帳の綴りを揃えると実装の enum 値と
> 乖離し、テスト実装時に存在しない値を書いて型エラーになる。スキーマ側の綴り統一は
> 破壊的マイグレーション（既存行の値書き換え）を伴う別課題であり、本ラウンドの対象外。

- **Evidence**: `src/queries/order.ts:562-651` — `updateOrderPaymentStatus`。
  「非終端 → Cancelled/Refunded」遷移を条件付き `updateMany`（`paymentStatus: { notIn: [...] }`）
  で単一原子 UPDATE に畳み込み、`transition.count === 1` のときのみ子 OrderGroup/OrderItem 連動
  （`:616-625`）と在庫復元 `restockOrderItems`（`:632-638`）を実行する TOCTOU ガード。
- **Evidence**: `src/queries/order.ts:459-510` — `updateOrderGroupStatusAsAdmin`。
  `isRestockTerminalOrderStatus`（`:15-16`）による「非終端 → Canceled/Refunded」遷移ガード
  （`:490-497`）+ `reconcileParentOrderStatus`（`:415-448`）の親 Order 集約導出
  （全 Delivered→Delivered / 混在→PartiallyShipped 等 6 規則）。
- **Evidence**: `src/queries/order.test.ts` — 両関数の unit テストは存在するが**全モック**。
  条件付き `updateMany` が実際に 2 回目の呼び出しで `count=0` を返すこと・
  `Size.quantity` が increment で実際に復元されること・`$transaction` ロールバックは
  モックでは構造しか検証できない。`tests/integration/` に Order ライフサイクルのテストは
  **ゼロ**（既存 6 シナリオは placeOrder = 注文確定時点まで）。
- **Impact**: 在庫復元の二重実行（= 幽霊在庫でオーバーセル誘発）と部分連動
  （paymentStatus だけ Refunded で子が Pending のまま）は、plan 027 のオーバーセルと並ぶ
  **在庫・金銭クリティカル**な障害クラス。placeOrder の decrement（027 でテスト予定）と
  restock の increment は対になっており、片側だけの検証では在庫整合の保証が閉じない。
- **Effort**: M（seed ヘルパーに Order/OrderGroup/OrderItem 生成の追加が必要） /
  **Risk**: LOW（テスト + seed 拡張のみ） / **Confidence**: HIGH
- **Fix sketch**: `tests/integration/order-lifecycle.test.ts` を新設。
  ①キャンセル遷移で子連動 + `Size.quantity` 復元、②同一注文への 2 回目キャンセルで
  復元がスキップ（冪等）、③ `updateOrderGroupStatusAsAdmin` の遷移ガード + 親集約規則、
  を「throw/遷移 + 副作用検証」3 点セット（S5 パターン）で固定する。→ **plan 031**

### [TESTS-16] webhook ハンドラーの実 DB 冪等性（upsert + unique 制約 + 原子性）が未検証 — TESTS-04 の昇格

- **Evidence**: `src/app/api/webhooks/stripe/route.ts:153-180` — `payment_intent.succeeded` /
  `payment_intent.payment_failed` / `charge.refunded` を `PaymentDetails.upsert`
  （`where: { orderId }` — orderId unique）+ `Order.update` の `$transaction` で反映。
- **Evidence**: `src/app/api/webhooks/paypal/route.ts:241-268` — 同型の upsert + tx
  （capture id を `paymentIntentId` カラムに格納）。
- **Evidence**: `src/app/api/webhooks/stripe/route.test.ts` / `paypal/route.test.ts` —
  unit テストは署名検証・イベント振り分け・レスポンスコードを検証するが `@/lib/db` を
  モックしており、**「同一イベント再送で PaymentDetails が 1 行のまま更新される」という
  冪等性の本体（unique 制約 + upsert の実挙動）はどのテストでも実行されていない**。
- **Impact**: webhook は Stripe/PayPal が**再送を前提**とする経路（コード内コメントも
  再送ループへの配慮を明記）。冪等性が破れると PaymentDetails 重複 or upsert 失敗 500 →
  再送ループで決済状態が不定になる。money-critical。
- **Effort**: M（署名検証のモック + Order の seed が必要。route の `POST(req)` 直接呼び出しは
  `cart-checkout.test.ts` S4 の page 直接呼び出しと同型で前例あり） /
  **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `tests/integration/webhook-payment.test.ts` を新設。`stripe` SDK の
  `constructEvent` と PayPal 署名検証 fetch をモックし、実 DB で①初回イベント → 行作成、
  ②同一イベント再送 → 1 行のまま・200、③状態遷移イベント（Paid→Refunded）→ upsert 更新、
  ④存在しない orderId → 404・副作用なし、を検証。→ **plan 032**

### [TESTS-17] tsvector 全文検索の raw SQL がどのテストでも実行されていない

- **Evidence**: `src/app/api/search-products/route.ts:33-44` — `db.$queryRaw` +
  `to_tsvector('simple', ...) @@ plainto_tsquery('simple', ${q})` + `ts_rank` の
  PostgreSQL 固有 SQL。ストアフロント検索バーの供給経路。
- **Evidence**: `src/app/api/search-products/route.test.ts:5` — `jest.mock("@/lib/db")` で
  全モック。**SQL 文字列そのものはユニット/統合いずれのテストでも一度も実行されない**。
  SQL の構文・`'simple'` トークナイザーの挙動・COALESCE の NULL 対応・関連度順ソートは
  すべて無検証。
- **Evidence**: `src/queries/subCategory.ts:188-190` — `ORDER BY RANDOM()` の raw SQL も
  同様にモックのみ（こちらは低リスクのため TESTS-17 の従属検証に含める）。
- **Impact**: Elasticsearch → tsvector 移行（`docs/migration/` 記録済みの決定）の**中核 SQL が
  回帰無検出**。Prisma メジャーアップグレード（DEPS-04 で spike 予定）や schema 変更で
  raw SQL が壊れてもテストが検知できない。検索は browse と並ぶ商品発見の主経路。
- **Effort**: S–M（seed 済み Product に対する GET 直接呼び出し。既存 seed ヘルパーで完結） /
  **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `tests/integration/search-products.test.ts` を新設。実 DB に名前/説明の
  異なる Product 群を seed し、①名前ヒット、②description ヒット（COALESCE 経路は
  description 必須スキーマなら名前のみで代替）、③ヒットなし空配列、④関連度順、
  ⑤空クエリ早期 return、⑥SQL インジェクション文字列が安全にパラメータ化される、を検証。→ **plan 033**

### [TESTS-18] `upsertReview` の評価集計（rating / numReviews）が実 DB 未検証

- **Evidence**: `src/queries/review.ts:106-131` — レビュー作成/更新後に `findMany` で全件取得 →
  JS で平均計算 → `product.update({ rating, numReviews })` の**非トランザクション**
  read-modify-write。upsert 分岐（既存レビューは update / 新規は create）も同関数。
- **Evidence**: `src/queries/review.test.ts`（16 テスト）— 全モック。平均値の再計算が
  「実際に DB の全レビューから導出される」ことは未検証。
- **Impact**: rating / numReviews はストアフロントの商品カード・詳細・ストアページに
  広く表示される信頼シグナル（`home.ts` / `product.ts` / `profile.ts` の表示経路多数）。
  集計ドリフトは静かに蓄積し、表示上の平均と実レビューの乖離として顧客に露出する。
- **Effort**: S（既存 seed ヘルパー + Review 作成のみ。resetDb は Review/ReviewImage 対応済み） /
  **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `tests/integration/review-aggregation.test.ts` を新設。①複数ユーザーの
  レビュー投稿で平均 / 件数が正しく再計算、②同一ユーザーの再投稿は update（件数不変・
  平均のみ変動）、③非所有レビューへの影響なし、を実 DB で固定。→ **plan 034**

### [TESTS-19] `updateStoreStatus` の PENDING→ACTIVE ロール昇格遷移が実 DB 未検証

- **Evidence**: `src/queries/store.ts:559-582` — `$transaction` 内で Store.status 更新 +
  「PENDING → ACTIVE 遷移時のみ」`User.role = SELLER` 昇格。tx 外で Clerk メタデータ同期。
- **Evidence**: `src/queries/store.test.ts:1464-` — unit テストは認可エラー中心。
  「ACTIVE→ACTIVE の再実行でロール昇格が走らない」「非 PENDING 起点では昇格しない」という
  遷移条件の実 DB 検証はなし。
- **Impact**: ロール昇格は**権限境界の変更**（USER → SELLER）。誤発火はダッシュボード
  アクセス権の不正付与に直結する Trust & Safety 境界。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `tests/integration/store-status.test.ts` を新設。Clerk（`currentUser` +
  `clerkClient`）をモックし、①PENDING→ACTIVE で DB の User.role が SELLER に、
  ②ACTIVE→BANNED 等の遷移では role 不変、③DISABLED→ACTIVE（非 PENDING 起点）では
  昇格しない、を検証。→ **plan 035**

---

## Round 1/4 所見（Integration 関連）との reconcile

| # | 所見 | Round 5 時点の現状（直接確認） | 裁定 |
|---|---|---|---|
| TESTS-02 | capture 経路の非原子 2 書き込みが統合テスト不能 | 未解消。`src/queries/stripe.ts` / `paypal.ts` の capture 側はテスト以前に `$transaction` 化（plan 003 隣接）が先 | **deferred 維持**（コード修正が先行依存。032 の webhook 側とは対象コードが別）<br>**⚠️ 2026-07-19 追記**: 先行依存としていた **plan 003 は DONE**（[`../README.md`](../README.md) の Status 表が正）。さらに Round 14 で capture 経路が 2 つの**別事象**で変化したため、本行の「未解消」は **Round 5 時点の記述**。<br>2 コミットを併記すると「両方が CAS 対応」と読めるので分けて記す: `4261be0c` = **PayPal の settled-state ガードを CAS update 条件で原子化**（`fix(paypal): make the settled-state guard atomic with a CAS update condition`）/ `e63474b6` = **Stripe の金額単位修正**（`fix(stripe): store payment amount in dollars to match the Decimal(12,2) column` — CAS ではなく `Decimal(12,2)` 列に合わせたドル建て保存。CORRECTNESS-05 のコード側、残件は [plan 063](../063-backfill-stripe-payment-amount.md)）。再評価は [`VETTED_FINDINGS.md`](VETTED_FINDINGS.md) の「Round 14 追記」節を参照 |
| TESTS-04 | webhook ハンドラーの実 DB 冪等性なし | 未解消を再確認（両 route の unit テストは db 全モック） | **TESTS-16 に昇格 → plan 032** |
| TESTS-05+08 | placeOrder オーバーセルロールバック + PLATFORM 端数 | plan 027（TODO）が既存。本ラウンドの 031 は**注文後のライフサイクル（restock 側）**でシナリオ非重複 | plan 027 維持（重複プラン作成せず） |
| TESTS-06 | restock 二重実行ガードの実 DB テストなし | 未解消を再確認（`order.ts:562-651` / `:459-510`） | **TESTS-15 に昇格 → plan 031** |
| TESTS-14 | 2026-06 追加機能のゲスト E2E 導線 | E2E 領域のため本ラウンド対象外 | deferred 維持（Round 4 裁定を変更しない） |

## Considered and rejected（Round 5・再監査防止）

- **`saveUserCart` の統合テスト**（`src/queries/user.ts:104-`）: findFirst → 検証 → 書き込みが
  非原子である問題は **plan 005（cart-integrity）のコード修正スコープ**。修正前に現挙動の
  characterization を statically 固定すると 005 実行時に書き直しになるため、統合テストは
  **005 完了後の追加候補**として繰延（005 のテスト計画に統合検証の観点を委ねる）。
- **`sendMessage` の配列 `$transaction`**（`src/queries/message.ts:246`）: Message 作成 +
  Conversation.updatedAt 更新の 2 文のみで分岐なし。unit テスト（`message.test.ts`）で
  構造検証済みであり、実 DB で追加検証できる不変条件が薄い。低レバレッジ。
- **`updateProduct` の specs/questions 削除+再作成 tx**（`src/queries/product.ts:327-`）:
  実 DB 価値はあるが、対象はダッシュボード編集経路で money-path ではなく、
  `generateUniqueSlug` 含め振る舞いが安定。031〜035 より低レバレッジのため次点候補として
  README の Deferred に記録。
- **`subCategory.ts` の `ORDER BY RANDOM()` 単独プラン化**: 出力が非決定的で assert 対象が
  「件数と型」のみ。TESTS-17（plan 033）の従属シナリオとして 1 テストで足りる。
- **cart-checkout スイートの拡張（クーポン removeCoupon 等）**: `removeCoupon` は
  `coupon.test.ts` の unit で分岐網羅済み・DB 側は単純 update。増分価値小。

## 監査しなかったもの

- E2E（Playwright）と unit/component の網羅性（Round 4 で監査済み。本ラウンドは Integration 限定）。
- 外部サービス実環境（Stripe/PayPal/Clerk）との疎通 — webhook 所見も署名検証はモック前提。
- `prisma/seed/__tests__/`（スコープ定義のとおり対象外）。
