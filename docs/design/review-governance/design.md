# レビュー・UGC 品質ガバナンス — 設計（design.md）

> plan [019](../../../plans/019-spike-review-ugc-governance.md)（design/spike）の成果物。
> **本ドキュメントは設計のみ。`src/` / `prisma/schema.prisma` は変更しない**
> （調査中に見つけた P1 は別プラン [091](../../../plans/091-fix-review-user-pii-exposure.md) で先に修正した — §0 の 0-9）。
> 実装手順は後続の実装プラン [092](../../../plans/092-implement-review-governance.md) に書く。
>
> - 調査日: 2026-10-18 / 対象 HEAD: `1f5d3927`（branch `dev`）
> - ドリフトチェック（`86c04a1..HEAD`）: `schema.prisma` / `review.ts` / `store.ts` は変更されている。
>   ただし **`Review` にモデレーション状態・購入検証のカラムは無い**ので、STOP 条件には当たらない。
>   plan 019 本文の前提のうち「集計が非アトミック」は**すでに解消済み**（0-2）、
>   「rating は 1〜5 の整数」は**UI の実装と食い違う**（0-5）。本書の file:line は上記 HEAD で取り直した値。
> - 相互参照: spike [016](../../../plans/016-spike-seller-onboarding-catalog-approval.md)（未実行）の Open question 2
>   「審査ポリシーの切り替え機構」は、**本書 §3.3 の `ModerationPolicy` を共有する案**として渡す。

---

## 0. 設計の前提（実コードで確認した事実）

| #   | 事実 | 出典 |
| --- | ---- | ---- |
| 0-1 | `Review` にモデレーション状態・購入検証・通報のカラムは無い。`@@unique([userId, productId])` はある | [`schema.prisma:541-565`](../../../prisma/schema.prisma) |
| 0-2 | `upsertReview` はすでに **1 つの `$transaction` の中で `SELECT … FOR UPDATE`（Product 行）→ findFirst → create/update → findMany → product.update** の順に処理している。並行投稿は統合テストで検証済み | [`review.ts:83-178`](../../../src/queries/review.ts) / [`tests/integration/review-aggregation.test.ts`](../../../tests/integration/review-aggregation.test.ts)（plan 034） |
| 0-3 | `review.ts:77-79` のコメントは「`Review` には (productId, userId) の unique 制約が無い」と書いているが、0-1 のとおり制約は**ある**（コメントの記述が古い） | [`review.ts:76-79`](../../../src/queries/review.ts) |
| 0-4 | `Store.averageRating` / `numReviews` に書き込む箇所は**無い**（seed にも無い）。読むのは `getStorePageDetails`・公開検索 API・店舗ページ | [`store.ts:766-767`](../../../src/queries/store.ts) / [`index-products/route.ts:215,334`](../../../src/app/api/index-products/route.ts) / [`store-details.tsx:31`](../../../src/components/store/store-page/store-details.tsx) |
| 0-5 | UI は **0.5 刻み**の星評価（`index + 0.5` / `index + 1`、キー操作も 0.5 刻みで `[1, count]` にクランプ）。評価フィルタは `in: [rating, rating + 0.5]`、統計は `Math.floor(rating)` で 1〜5 のバケットに分ける | [`review-details.tsx:25-31`](../../../src/components/store/forms/review-details.tsx) / [`product.ts:2027-2031`](../../../src/queries/product.ts) / [`product.ts:1845-1849`](../../../src/queries/product.ts) |
| 0-6 | `AddReviewSchema.rating` は `z.number().min(1)` だけ（上限なし・刻み指定なし）。しかも **`upsertReview` はサーバー側で Zod を通していない**（クライアントフォームの resolver だけ） | [`schemas.ts:457-470`](../../../src/lib/schemas.ts) / [`review.ts:15-61`](../../../src/queries/review.ts) |
| 0-7 | `likes` を読み書きする query・コンポーネントは無い | `grep -rn "likes" src/queries src/components/store`（テスト 1 件のみ） |
| 0-8 | `Review → Product` の FK は `ON DELETE RESTRICT`。レビューのある商品は削除できない（したがって商品削除が Store 集計を崩す経路は無い） | [`20260222101357_init_postgresql/migration.sql:694`](../../../prisma/migrations/20260222101357_init_postgresql/migration.sql) |
| 0-9 | **（P1・修正済み）** 公開経路 `getProductPageData` / `getProductFilteredReviews` が `include: { user: true }` で投稿者の `email` / `role` を返していた。plan 091 で `select: { name, picture }` に絞った | [plan 091](../../../plans/091-fix-review-user-pii-exposure.md) |
| 0-10 | 購入の照合材料: `OrderItem.productId`（FK なしの文字列）→ `OrderGroup` → `Order.userId` / `Order.paymentStatus`。明細の状態は `OrderItem.status: ProductStatus`（**配送状態の enum。名前が紛らわしい** — 016 の「命名衝突の罠」） | [`schema.prisma:687-831`](../../../prisma/schema.prisma) |
| 0-11 | 汎用の設定・ポリシーを置くテーブルは無い。`SupportTicket` はゲスト送信可・`status String`・レビュー ID への参照なし | [`schema.prisma:947-982`](../../../prisma/schema.prisma) |
| 0-12 | interactive `$transaction` + `FOR UPDATE`（`$queryRaw`）は Accelerate 経由の本番経路ですでに使われている（`upsertReview` / `updateStoreStatus`）。**Accelerate の制約とは衝突しない**（STOP 条件に当たらない） | [`review.ts:87-89`](../../../src/queries/review.ts) / [`store.ts:606`](../../../src/queries/store.ts) |

---

## 1. 生成・表示・消費の経路（Step 1）

「公開集合」は §2.2 で定義する `PUBLIC_REVIEW_STATUSES`（`PUBLISHED` と `FLAGGED`）。

| 種別 | 経路 | ファイル | モデレーション対応 |
| ---- | ---- | -------- | ------------------ |
| 生成 | レビュー投稿フォーム → `upsertReview` | [`review-details.tsx:211`](../../../src/components/store/forms/review-details.tsx) → [`review.ts:15`](../../../src/queries/review.ts) | **要**: 購入判定・初期状態・サーバー側 Zod・集計の除外 |
| 表示 | 商品ページの先頭 4 件 | [`product.ts:1628-1635`](../../../src/queries/product.ts) | **要**: `status in 公開集合` |
| 表示 | レビュー一覧（フィルタ・ソート・ページ送り） | [`product.ts:2011-2066`](../../../src/queries/product.ts) `getProductFilteredReviews` | **要**: 同上 |
| 表示 | 評価分布 | [`product.ts:1829-1866`](../../../src/queries/product.ts) `getRatingStatistics`（`groupBy` と画像付き件数の `count`） | **要**: 同上（分布と平均がずれないよう集計と同じ条件にする） |
| 表示 | 公開検索 API の最新 5 件 | [`index-products/route.ts:250-262`](../../../src/app/api/index-products/route.ts)（2 か所） | **要**: 同上 |
| 表示 | 自分のレビュー一覧（プロフィール） | [`profile.ts:451-465`](../../../src/queries/profile.ts) `getUserReviews` | **不要**（本人には全状態を見せ、状態バッジを出す） |
| 消費 | 商品の並び順（評価順） | [`product.ts:1207`](../../../src/queries/product.ts)（`ORDER BY p.rating`） | 不要（`Product.rating` 自体が公開集合だけの集計になる） |
| 消費 | 商品カード・商品詳細の平均 | [`product.ts:1521-1523`](../../../src/queries/product.ts) / [`product.ts:1776`](../../../src/queries/product.ts) / [`product.ts:2295-2297`](../../../src/queries/product.ts) | 不要（同上） |
| 消費 | 店舗ページ・検索 API の店舗平均 | 0-4 の読み取り経路 | 不要（§4 で書き込み経路を作れば正しい値になる） |

> 「公開集合」の条件は**表示 4 経路**にだけ効かせる。ここに漏れがあると非公開レビューが見えてしまうため、
> 実装プランでは `src/lib/review-visibility.ts` に `publicReviewWhere()` を置き、
> `grep -n "db.review.\(findMany\|count\|groupBy\)" src/queries/product.ts src/app/api/index-products/route.ts`
> の全ヒットがこのヘルパーを合成していることを機械的に確認する（spike 016 Q3 と同じ考え方）。

---

## 2. Q1 — 購入検証

### 2.1 決定: 「支払い済み・取り消されていない明細を持つこと」を購入者とし、書き込み時にスナップショットする

**判定条件**（`OrderItem` を起点にする）:

```ts
db.orderItem.count({
  where: {
    productId,
    status: { notIn: ["Canceled", "Refunded"] },   // ProductStatus（配送状態）
    orderGroup: { order: { userId, paymentStatus: "Paid" } },
  },
}) > 0
```

- **`Delivered` 到達までは要求しない**。根拠: 明細の状態は seller が手動で更新する
  （`updateOrderItemStatus`）ため、実運用では `Pending` のまま止まる明細が多い。
  `Delivered` を条件にすると、受け取った購入者の大半がバッジを得られない。
  支払い済みであることは webhook で決まる（seller の操作に依存しない）ので、信頼の根拠として安定している。
- **`Canceled` / `Refunded` は除外する**。返品・返金を済ませた後に「購入者」バッジを残さないため。
- **スナップショット**: `Review.isVerifiedPurchase Boolean @default(false)` に、`upsertReview` の
  トランザクション内で判定した値を書く（作成時と更新時の両方）。
  - 表示時に毎回照合しない理由: 一覧の 1 行ごとに注文テーブルの join が必要になり、公開ページの
    クエリが重くなる。またバッジの意味は「投稿した時点で購入者だった」で十分である。
  - 書き込み後の返金でバッジは**自動では外れない**。これは既知の限界として受け入れ、
    必要になったら RMA の解決（`Refunded` への遷移）から再判定を呼ぶ（§8 の将来項目）。

### 2.2 決定: 未購入者の投稿可否はポリシー（データ）で切り替える。初期値は「投稿可・バッジ無し」

`ModerationPolicy.requireVerifiedPurchase`（§3.3）が `true` のときだけ、未購入者の投稿を
`"Only verified purchasers can review this product."` で拒否する。初期値は `false`。
ブランドが決まっていないため、どちらに倒すかを**コード変更なしで**切り替えられるようにしておく。

---

## 3. Q2 — モデレーション状態機械

### 3.1 状態

```prisma
enum ReviewStatus {
  PENDING_REVIEW  // 事前審査モードの初期値。非公開
  PUBLISHED       // 公開
  FLAGGED         // 通報が閾値を超えた。公開のまま審査待ち
  REJECTED        // 事前審査で却下。非公開。投稿者は編集して再提出できる
  REMOVED         // 公開後に運営が削除。非公開。終端
}
```

**公開集合 `PUBLIC_REVIEW_STATUSES = [PUBLISHED, FLAGGED]`**。

`FLAGGED` を公開のままにする理由: 通報だけで非公開にすると、競合する販売者や荒らしが
「通報 3 回」でレビューを消せてしまう（通報の武器化）。非公開にするのは運営の判断（`REMOVED`）に限る。

### 3.2 遷移表

| 現在 | アクション | 実行ロール | 次の状態 | 備考 |
| ---- | ---------- | ---------- | -------- | ---- |
| （なし） | 投稿 | USER | mode=`PRE` → `PENDING_REVIEW` / それ以外 → `PUBLISHED` | §3.3 |
| `PENDING_REVIEW` | 承認 | ADMIN | `PUBLISHED` | |
| `PENDING_REVIEW` | 却下（理由必須） | ADMIN | `REJECTED` | |
| `PENDING_REVIEW` | 編集 | 投稿者 | `PENDING_REVIEW` | |
| `REJECTED` | 編集（再提出） | 投稿者 | 投稿時と同じ初期状態 | 戻り先を必ず持たせる（016 Q1 と同じ要件） |
| `PUBLISHED` | 編集 | 投稿者 | mode=`PRE` → `PENDING_REVIEW` / それ以外 → `PUBLISHED` | 事前審査の抜け道にしない |
| `PUBLISHED` | 通報（異なる通報者数が閾値に達した） | USER（自動遷移） | `FLAGGED` | mode=`POST` のときだけ。`NONE` では通報を記録するが遷移しない |
| `PUBLISHED` / `FLAGGED` | 削除（理由必須） | ADMIN | `REMOVED` | |
| `FLAGGED` | 問題なし | ADMIN | `PUBLISHED` | 未処理の通報をまとめて `resolvedAt` で閉じ、同じ通報者が再通報しても再び FLAGGED にしない |
| `FLAGGED` | 編集 | 投稿者 | `FLAGGED` | 審査中の状態を編集で解除させない |
| `REMOVED` | 編集 | 投稿者 | **拒否**（`"This review has been removed."`） | `@@unique([userId, productId])` のため新規投稿もできない＝終端 |

**集計を再計算するのは、公開集合への出入りがある遷移だけ**（投稿、承認、削除、公開中の編集）。
`PUBLISHED ↔ FLAGGED` の遷移では集計は変わらない。

### 3.3 決定: ポリシーは 1 テーブル・対象ごとに 1 行で表し、spike 016 と共有する

```prisma
enum ModerationSubject { REVIEW  LISTING }   // LISTING は spike 016 が使う
enum ModerationMode    { NONE  POST  PRE }   // NONE=無審査 / POST=事後審査 / PRE=事前審査

model ModerationPolicy {
  subject                 ModerationSubject @id
  mode                    ModerationMode    @default(POST)
  requireVerifiedPurchase Boolean           @default(false)  // REVIEW のみ意味を持つ
  flagThreshold           Int               @default(3)      // 異なる通報者の数
  updatedAt               DateTime          @updatedAt
}
```

- **行が無いときはコード上の既定値**（`POST` / `false` / `3`）にフォールバックする。
  したがってマイグレーションで行を作らなくても今と同じ挙動（即公開）になり、厳しくするときは
  行を 1 本 `UPDATE` するだけで済む ＝ **コード変更なしで差し替えられる**。
- 店舗ごとの `trustLevel`（016 Q2 の別案）は、REVIEW には不要（レビューの書き手は店舗ではない）。
  016 が LISTING で店舗単位の分岐を必要とした場合は、このテーブルに `subject` を増やさず
  `Store` 側の列で表すこと（REVIEW のポリシーと混ぜない）。
- 管理画面での編集 UI は初期スコープに含めない（SQL / Prisma Studio で運用者が更新する）。

---

## 4. Q3 — 通報の受け皿

### 4.1 決定: 専用の `ReviewReport` を新設する（`SupportTicket` は拡張しない）

```prisma
enum ReviewReportReason { SPAM  OFFENSIVE  OFF_TOPIC  FAKE  OTHER }

model ReviewReport {
  id         String             @id @default(uuid())
  reviewId   String
  review     Review             @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  reporterId String
  reporter   User               @relation(fields: [reporterId], references: [id], onDelete: Cascade)
  reason     ReviewReportReason
  note       String?            @db.VarChar(500)
  resolvedAt DateTime?          // FLAGGED → PUBLISHED / REMOVED の判断時に埋める
  createdAt  DateTime           @default(now())

  @@unique([reviewId, reporterId])
  @@index([reviewId, resolvedAt])
}
```

`SupportTicket` を使わない理由（0-11）:

1. 閾値は「**異なる**通報者の数」で数える必要があり、`@@unique([reviewId, reporterId])` が要る。
   ゲスト送信を許す `SupportTicket` では同じ人の連投を区別できない。
2. `SupportTicket.status` は自由な文字列で、運営の対応状況を表すもの。レビューの状態機械とは別物である。
3. 通報は 1 クリックの操作で、`name` / `email` / `subject` を求めるフォームとは UX が違う。

**通報の規則**:

- `requireUser`。自分のレビューは通報できない。公開集合にあるレビューだけが対象。
- 通報の insert と閾値判定・`FLAGGED` への遷移は**同じ `$transaction`** で行う
  （Review 行を `FOR UPDATE` で取り、未解決の通報を数える）。
- 二重通報（P2002）は成功として扱う（冪等）。

---

## 5. Q4 — 集計の原子化

### 5.1 現行方式が壊れない理由（0-2 の追認）

PostgreSQL の既定の分離レベルは READ COMMITTED で、**文ごとに**その時点で commit 済みのデータを読む。
現行の `upsertReview` は、レビューを書く**前に** Product 行を `FOR UPDATE` でロックする。

- 2 本の投稿 A / B が同じ商品に来ると、B は A の commit までロック待ちになる。
- B の `findMany`（集計の読み取り）は**ロックを取った後に**実行される別の文なので、A の行が見える。
- よって後勝ちで 1 件分が消えるロストアップデートは起きない。`$transaction` で囲んだこと自体ではなく、
  **「同じ行ロックを、読む前に取る」こと**が根拠である。

### 5.2 決定: 同じロック方式を Store に広げる。ロックの順序は常に Product → Store

```text
tx {
  SELECT id FROM "Product" WHERE id = $productId FOR UPDATE          -- 既存
  SELECT id FROM "Store"   WHERE id = $storeId   FOR UPDATE          -- 追加
  （レビューの create / update、状態の決定）
  Product: aggregate(_avg rating, _count) where productId, status in 公開集合 → product.update
  Store:   aggregate(_avg rating, _count) where product.storeId, status in 公開集合 → store.update
}
```

- **Store の平均はレビュー単位の平均**（店舗の全公開レビューの rating 平均）とする。商品平均の平均にはしない
  （レビュー 1 件の商品と 100 件の商品が同じ重みになるのを避ける）。
- **ロックの順序を全経路で固定する**: 投稿・モデレーション操作・backfill のどれも Product → Store の順で取る。
  同じ店舗の別商品への並行投稿は、互いに異なる Product ロックを取ってから同じ Store ロックを待つので、
  待ちの輪ができずデッドロックしない。
- 集計は JS の `reduce` ではなく `tx.review.aggregate` で DB に計算させる（行を転送しない）。
- **トレードオフ**: 同じ店舗へのレビュー投稿は Store ロックで直列になる。現状の規模では問題にならないが、
  ホットな店舗でロック待ちが目立つようになったら、Store 集計だけを通知基盤の sweeper
  （[notification-foundation §4](../notification-foundation/design.md)）と同じ方式の非同期再計算に移す。
- `storeId` は Product のロックを取った後に `tx.product.findUnique({ select: { storeId } })` で読む
  （クライアントから受け取らない）。

### 5.3 公開集合の外のレビューは集計から除外する

集計の `where` には常に `status: { in: PUBLIC_REVIEW_STATUSES }` を付ける。モデレーション操作
（承認・削除）も §5.2 と同じトランザクション手順で集計を再計算する。

### 5.4 backfill（Store の初回値と、状態列を追加した直後の整合）

`status` 列は `@default(PUBLISHED)` で追加する（既存レビューはすべて公開のまま）。そのうえで
同じマイグレーションに**冪等な再計算 SQL** を置く（何度実行しても同じ結果になる純粋な再計算）。

```sql
UPDATE "Store" s
SET "averageRating" = COALESCE(agg.avg, 0),
    "numReviews"    = COALESCE(agg.cnt, 0)
FROM (
  SELECT st.id AS store_id, AVG(r.rating) AS avg, COUNT(r.id)::int AS cnt
  FROM "Store" st
  LEFT JOIN "Product" p ON p."storeId" = st.id
  LEFT JOIN "Review"  r ON r."productId" = p.id AND r.status IN ('PUBLISHED', 'FLAGGED')
  GROUP BY st.id
) agg
WHERE s.id = agg.store_id;
```

Product 側も同じ形で再計算する（現行値と一致するはずだが、検算を兼ねる）。本番適用は
`safe-migration` スキルと `migrate deploy` で行い、適用前後の `SUM("numReviews")` を記録する。

---

## 6. Q5 — rating の型と許容範囲

### 6.1 決定: 型は `Float` のまま（ADR は作らない）

- tech.md の Decimal 規約の対象は**金額**で、評価は対象外。
- 許容値（§6.2）は 0.5 の倍数で、2 進の浮動小数点で**正確に表せる**。合計も正確で、誤差が出るのは
  平均の割り算 1 回だけ。表示は `toFixed(1)` なので実害がない。
- `Decimal(2,1)` にすると、`Product.rating` / `Store.averageRating` と、それを読む全経路の型
  （`toNumberSafe` の追加）に波及する。得られるものに対してコストが大きい。
- 代替案の比較が「変えない」で決着するため、ADR の作成基準（documentation-guide）を満たさない。本節を記録とする。

### 6.2 決定: 許容範囲は「1〜5 の 0.5 刻み」。3 層で強制する

plan 019 の初期仮説「1〜5 の整数」は採らない。UI が 0.5 刻みで、フィルタ・統計もそれを前提にしているため（0-5）。

| 層 | 強制方法 |
| -- | -------- |
| (i) 入口 | `AddReviewSchema.rating` を `z.number().min(1).max(5).multipleOf(0.5)` にし、**`upsertReview` の先頭（認可の後）で `safeParse` する**。現在はサーバー側の検証が無い（0-6）ので、ここが最重要 |
| (ii) DB | `CHECK ("rating" >= 1 AND "rating" <= 5 AND "rating" * 2 = trunc("rating" * 2))`。追加前に違反行の件数を数え、0 件でなければ STOP する |
| (iii) 集計 | (i)(ii) で保証された値だけを `aggregate` で平均する。`NaN` は Zod の `z.number()` が拒否する |

---

## 7. Q6 — helpful 投票

### 7.1 決定: 初期スコープから外す。`likes` 列は残し、削除は先送りする

- `likes` は誰も読み書きしていない（0-7）。per-user の `ReviewVote` を作らないかぎり二重投票を防げないが、
  「参考になった順」のソートを求める要件はまだ無い。
- 列を消すのは破壊的マイグレーションなので、本件の実装には混ぜない。スキーマに
  `/// 未使用（helpful 投票は未実装・design review-governance §7）` の doc コメントだけを付け、
  削除と `ReviewVote` の導入は [`plans/DEFERRED.md`](../../../plans/DEFERRED.md) に記録する。

### 7.2 顧客 Q&A

`Question` は販売者が入力する静的 FAQ で、顧客の投稿フローではない。**初期スコープに含めない**
（UGC として扱うなら本書の状態機械と `ModerationPolicy` に `subject` を足す形で拡張できる）。

---

## 8. 範囲外と将来の項目

- 文面の自動モデレーション（ML / 外部 API）。`PRE` モードの審査キューの前段に置ける
- 返金後のバッジ再判定（§2.1）。RMA の `Refunded` 遷移から呼ぶ
- 却下・削除の通知。通知基盤（plan 086）の `dedupeKey` 規則に従い、`review.rejected:<reviewId>` のような種別を追加する
- 検索・レコメンド（spike 015 / 017）への評価シグナルの供給。`Product.rating` が公開集合だけの集計になるので、追加の条件は不要
- セラー品質指標（plan 022）。**022 は §5.2 の Store 集計の更新経路を入力として使うこと**

## 8.5 実装で確定した差分（plan 092・2026-10-18）

- **理由の保存先を追加した**: §3.2 は却下・削除に理由を必須としたが、保存する列が無かった。
  `Review.moderationReason`（VARCHAR(500)）と `moderatedAt` を追加した（追加マイグレーション
  `review_moderation_reason`）。理由は本人のプロフィール履歴にだけ表示する。
- **状態機械は `src/lib/review-moderation.ts` の純粋関数にした**（`statusAfterAuthorWrite` /
  `moderationTransition` / `shouldFlag` / `availableModerationActions`）。UI はここから操作を導き、
  遷移表を複製しない。公開集合は `src/lib/review-visibility.ts` の `publicReviewWhere()`。
- **ロックの順序**: 投稿は Product → Store、モデレーションは Product → Store → Review、通報は Review のみ。
  どの経路もこの順序の部分列なので、待ちの輪はできない。同じ店舗の別商品への並行投稿は統合テストで確認した。
- **通報の冪等性は `createMany` + `skipDuplicates`**: P2002 を投げると PostgreSQL のトランザクションが
  中断して以降の文が失敗するため、catch で吸収する案は採らなかった。
- **審査キューは DataTable ではなくカード一覧**: 行の remount で成功表示と focus を失う問題を避けるため、
  seller 返品キュー（plan 088）と同じ形にした。
- **既存データのずれ**: ローカルの seed データは `Product.numReviews` が実際の件数と合っていなかった
  （seeder が集計を更新しない）。§5.4 の backfill はこれも直す。seed 側の修正は DEFERRED（REVIEW-SEED-AGGREGATES）。

## 9. 後続

- 実装プラン: [092](../../../plans/092-implement-review-governance.md)（2026-10-18 実装。UI 計画は [review-governance-ui-plan](../../../plans/layout-design/review-governance-ui-plan.md)）
- spike 016 の実行者は §3.3 を読み、`ModerationPolicy(subject = LISTING)` を使うか、使わない理由を書くこと
