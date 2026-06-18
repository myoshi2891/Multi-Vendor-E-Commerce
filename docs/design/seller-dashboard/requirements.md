# 販売者ダッシュボード 2 機能 — 要件定義（requirements.md）

> 記法は **EARS 風**（Easy Approach to Requirements Syntax）。
> 「**WHEN** 〈契機〉、システムは〈応答〉**する**」「**IF** 〈条件〉、**THEN** システムは〜**する**」「**WHILE** 〈状態〉、〜」「**WHERE** 〈機能フラグ〉、〜」を用いる。
> 各要件に一意 ID（`F1-1`…）を付与し、[design.md](./design.md) / [tasks.md](./tasks.md) からトレース可能にする。

---

## 1. 目的

マルチベンダー E コマースの **販売者（SELLER）** が、自店舗の売上・注文・閲覧状況を一目で把握し、在庫を効率的に管理できるようにする。現状 `/dashboard/seller/stores/[storeUrl]` はプレースホルダー（`<div>SellerStorePage</div>`）、`/dashboard/seller/stores/[storeUrl]/inventory` は未作成で、[sidebar](../../../src/constants/data.ts#L57) にリンクのみ存在する。

## 2. ペルソナ

| ロール | 識別子 | 本機能での関心事 |
| --- | --- | --- |
| 販売者 | `SELLER` | 自店舗の売上推移・注文数・閲覧数(PV)の把握、在庫数の確認とクイック編集、在庫切れ/過小在庫の早期検知 |

> 顧客（USER）・管理者（ADMIN）は本機能の直接の利用者ではない。ただし F3（注文確定時の在庫減算）は **顧客のチェックアウトフロー** に影響するため、回帰の観点で USER の購入フローを受け入れ基準に含める。

## 3. スコープ

### 3.1 スコープ内

- **F1**: 店舗ダッシュボード統計（KPI カード + 売上推移チャート + 最近の注文 + トップ商品。`/dashboard/seller/stores/[storeUrl]`）
- **F2**: 在庫管理（バリアント×サイズの在庫一覧・在庫数クイック編集・在庫切れ/過小在庫の視覚アラート・店舗ごとのしきい値設定。`/dashboard/seller/stores/[storeUrl]/inventory`）
- **F3**: 注文確定時の在庫自動減算（`placeOrder` での `Size.quantity` アトミック減算 + 在庫不足ガード）
- **スキーマ拡張**: `Store.lowStockThreshold Int @default(5)`（additive・後方互換）

### 3.2 スコープ外

[README.md §スコープ境界](./README.md#スコープ境界最重要最初に確認) を参照。要約: **メール/アプリ内通知**、**サイズ別しきい値 override**、**キャンセル/返品時の在庫復元**（レビュー対象）、多通貨、税計算、高度分析、PV 収集ロジックの新設。

---

## 4. 機能要件

### F1: 店舗ダッシュボード統計（`/dashboard/seller/stores/[storeUrl]`）

| ID | 要件（EARS 風） |
| --- | --- |
| **F1-1** | WHEN SELLER が `/dashboard/seller/stores/[storeUrl]` を開いたとき、システムは KPI カード群（総売上・総注文数・総閲覧数(PV)・販売数・総商品数・在庫アラート件数）を表示する。 |
| **F1-2** | 総売上の集計において、システムは当該店舗の `OrderGroup.total` のうち **親 `Order.paymentStatus = Paid`** のものだけを合算する（`OrderGroup` 自体は paymentStatus を持たないため親 Order と join、[判断5](./design.md#判断5-店舗売上集計の-ordergrouporder-join)）。 |
| **F1-3** | 総閲覧数(PV)の集計において、システムは当該店舗の全 `Product.views` を合算する（既存フィールドの集計のみ。収集経路は改修しない）。 |
| **F1-4** | 販売数の集計において、システムは当該店舗の全 `Product.sales`（または `ProductVariant.sales`）を合算する。 |
| **F1-5** | WHEN SELLER がダッシュボードを開いたとき、システムは売上推移チャート（日次=直近 30 日 / 月次=直近 12 ヶ月）を当該店舗の `Paid` 売上で表示する。 |
| **F1-6** | WHEN SELLER がダッシュボードを開いたとき、システムは当該店舗の最近の注文（直近 N 件）と販売上位の商品（トップ N 件）を一覧表示する。 |
| **F1-7** | 統計集計関数は、リアルタイム性を要さないため、**15〜30 分のデータキャッシュ**を介して結果を返す（[判断1](./design.md#13-再利用元マトリクス)・admin と同方式）。ただしキャッシュキーには `storeId` を含め、**店舗間でキャッシュが混線しない**ことを保証する。 |
| **F1-8** | 金額の表示・集計後の整形において、システムは `Prisma.Decimal` を return 境界でのみ `.toNumber()` 化してからクライアントへ渡す（集計途中の `number` 加算は禁止）。 |
| **F1-9** | WHILE 当該店舗に注文が 0 件の状態の間、システムは KPI を `0`・チャートを空状態で破綻なく描画する（ゼロ件のエッジケース）。 |

### F2: 在庫管理（`/dashboard/seller/stores/[storeUrl]/inventory`）

| ID | 要件（EARS 風） |
| --- | --- |
| **F2-1** | WHEN SELLER が `/dashboard/seller/stores/[storeUrl]/inventory` を開いたとき、システムは当該店舗の **バリアント×サイズ単位** の在庫一覧（商品名・バリアント名・サイズ・現在庫数・価格・在庫ステータス）を表示する。 |
| **F2-2** | WHEN SELLER がある行の在庫数をインライン編集して確定したとき、システムは `updateSizeStock(sizeId, quantity, storeUrl)` を呼び、当該 `Size.quantity` を更新する。 |
| **F2-3** | IF 編集後の在庫数が負数・非整数・`NaN`、THEN システムは Zod バリデーション（`quantity: int ≥ 0`）で弾き、更新しない。 |
| **F2-4** | 在庫数の更新において、システムは `requireStoreOwner(storeUrl)` で店舗所有権を検証し、さらに **対象 Size が当該店舗の商品階層（size→variant→product→store）に属すること**を検証する（IDOR 防止、[判断4](./design.md#判断4-在庫クイック編集-updatesizestock)）。 |
| **F2-5** | 在庫ステータスの判定において、システムは `quantity === 0` を **在庫切れ（赤バッジ）**、`0 < quantity <= store.lowStockThreshold` を **過小在庫（橙バッジ）**、それ以外を **十分（通常表示）** とする。 |
| **F2-6** | WHEN SELLER が店舗のしきい値設定を変更したとき、システムは `updateStoreLowStockThreshold(storeUrl, threshold)` を呼び、`Store.lowStockThreshold` を更新する（threshold: int ≥ 0）。 |
| **F2-7** | 在庫一覧の上部に、システムは **アラート件数サマリー**（在庫切れ N 件 / 過小在庫 M 件）を表示する。 |
| **F2-8** | 一覧取得において、システムは検索（商品名）で絞り込めるようにする（既存 [DataTable](../../../src/components/ui/data-table.tsx) の filter 機能を流用）。 |

### F3: 注文確定時の在庫自動減算（`placeOrder`）

| ID | 要件（EARS 風） |
| --- | --- |
| **F3-1** | WHEN 顧客が注文を確定したとき、システムは [placeOrder](../../../src/queries/user.ts#L609) の **既存 `$transaction` 内**で、各注文アイテムの `Size.quantity` を注文数分だけアトミックに減算する。 |
| **F3-2** | IF 注文確定時に いずれかの `Size.quantity` が注文数に満たない、THEN システムは **当該注文全体をロールバック**し、「在庫が不足しています」を返す（部分確定はしない）。 |
| **F3-3** | 在庫の検証と減算は、**同一の DB 更新（`updateMany` の `where: { quantity: { gte: qty } }` 条件付き更新）でアトミックに**行い、`count === 0`（=条件を満たす行が無い）を在庫不足として検知する（TOCTOU レース回避、[判断6](./design.md#判断6-placeorder-在庫減算アトミック-check-and-decrement)）。 |
| **F3-4** | WHILE 在庫減算を行う間、システムは `placeOrder` 既存の数量クランプ（[user.ts:494](../../../src/queries/user.ts#L494) の `Math.min(quantity, size.quantity)`）と矛盾しないよう、**減算対象を確定済みの `validQuantity` に揃える**（[design §5.2](./design.md#52-placeorder-在庫減算の影響箇所マトリクス)）。 |
| **F3-5（任意・レビュー対象）** | WHEN 注文が `Canceled` または `Refunded` に変更されたとき、システムは減算済みの `Size.quantity` を **復元する**（在庫整合性の対。Phase 4 サブステップ 4-D・recommended、[design §5.3](./design.md#53-キャンセル返品時の在庫復元レビュー対象)）。 |

---

## 5. 非機能要件（NFR）

| ID | 要件 | 根拠 |
| --- | --- | --- |
| **NFR-1（認可・多層防御）** | 全 seller Server Action は冒頭で `requireStoreOwner(storeUrl)` を呼ぶ。layout の `redirect("/")` と二重化する。 | [tech.md 認可ガード](../../../.claude/steering/tech.md)、[判断2](./design.md#判断2-認可は-requirestoreownerstoreurl) |
| **NFR-2（IDOR 防止）** | 在庫編集（`updateSizeStock`）は、店舗所有権に加え **対象 Size の所有権チェーン**（size→variant→product→store.id）を検証し、他店舗の在庫を改変できないことを保証する。 | [SECURITY_GAP_REPORT.md §5.2](../../testing/SECURITY_GAP_REPORT.md)、[判断4](./design.md#判断4-在庫クイック編集-updatesizestock) |
| **NFR-3（金額精度）** | 金額フィールドは `Decimal(12,2)`。演算は `Prisma.Decimal` メソッド（`.add/.sub/.mul/.div`）で行い、`.toNumber()` はシリアライズ/表示直前のみ。集計ループ内で number 加算しない。 | [tech.md 金額・数値精度](../../../.claude/steering/tech.md) |
| **NFR-4（動的レンダリング）** | DB 依存の各 `page.tsx` は `export const dynamic = 'force-dynamic';` を宣言する。統計取得関数だけをデータキャッシュ層で包む（動的ページ × キャッシュ済みデータの分離）。 | [tech.md 動的レンダリング規約](../../../.claude/steering/tech.md) |
| **NFR-5（アトミック性）** | 複数テーブル/行を更新する操作（注文確定時の在庫減算）は `db.$transaction` でアトミック化する。在庫検証と減算は条件付き `updateMany` で 1 操作にまとめ、レースを防ぐ。 | [tech.md アトミック操作](../../../.claude/steering/tech.md)、[判断6](./design.md#判断6-placeorder-在庫減算アトミック-check-and-decrement) |
| **NFR-6（エラーハンドリング）** | 外部呼び出し（Prisma 等）は `try/catch` でラップし、`instanceof Error` で型ガードする。認可ガード（`requireStoreOwner`）は `try/catch` の**外**に置く。新規 query では `any` を使わず `unknown` + 型ガード。 | [tech.md エラーハンドリング](../../../.claude/steering/tech.md) |
| **NFR-7（構造化ログ）** | `src/queries/` の `console.error` は第1引数 `"[Module:Function] message"`・第2引数 `{ error, stack }` の 2 引数形式。`console.log` 禁止。 | [tech.md 構造化ログ](../../../.claude/steering/tech.md) |
| **NFR-8（キャッシュ分離）** | 統計のデータキャッシュ（`unstable_cache`）は `storeId` をキーに含め、店舗間でキャッシュが混線しないことを保証する。`requireStoreOwner` はキャッシュの外で呼ぶ。 | [判断1](./design.md#13-再利用元マトリクス)・[design §3.1](./design.md#31-新規-querysrcqueriesstore-dashboardts) |
| **NFR-9（後方互換・スキーマ）** | `Store.lowStockThreshold` は `@default(5)` を付与し、既存レコード・既存呼び出しを壊さない additive 変更とする。`safe-migration` 経由で `migrate dev` し、ER 図を再生成する。 | [判断3](./design.md#判断3-在庫しきい値は-store-単位で永続化)、[rule 03](../../../.claude/rules/03-data-model-diagram-sync.md) |

---

## 6. 制限事項（仕様境界）

| ID | 制限 | 詳細 |
| --- | --- | --- |
| **C-a** | 在庫アラートは **視覚バッジのみ** | メール/アプリ内通知は送らない。「通知設定」は店舗単位の `lowStockThreshold` 設定 UI として実装する。 |
| **C-b** | しきい値は **店舗単位の単一値** | `Size` 単位の個別 override は不可。`Store.lowStockThreshold` のみ。 |
| **C-c** | PV(閲覧数)は **既存フィールドの集計のみ** | `Product.views` の収集経路（インクリメントのトリガー）は改修しない。既存値の店舗内合算を表示するのみ。 |
| **C-d** | 在庫減算は **注文確定時のみ** | カート追加時の在庫予約は行わない。キャンセル/返品時の復元（F3-5）は**レビュー対象の任意サブステップ**。 |
| **C-e** | 在庫数は **バリアント×サイズ単位**（`Size.quantity`） | 商品レベル・バリアントレベルの集約在庫フィールドは持たない（[structure.md データモデル](../../../.claude/steering/structure.md)）。 |

---

## 7. 受け入れ基準（Acceptance Criteria）

> Given–When–Then 風のチェックリスト。各機能の「完了の定義」。実装時にテストへ落とし込む（[tasks.md](./tasks.md)）。

### F1 ダッシュボード

- [ ] **AC-F1-1**: Given 非 SELLER ユーザー、When `/dashboard/seller/stores/[storeUrl]` にアクセス、Then `/` にリダイレクトされる。
- [ ] **AC-F1-2**: Given 他店舗の SELLER、When `getStoreDashboardStats("他人のstoreUrl")` を直接呼ぶ、Then 「Forbidden: store not owned by current user.」で拒否される。
- [ ] **AC-F1-3**: Given 当該店舗に `Paid` の OrderGroup 3 件（合計 $X）と非 `Paid` 1 件、When 総売上を表示、Then 表示額は `$X`（非 Paid は除外）。
- [ ] **AC-F1-4**: Given 当該店舗の商品 `views` 合計が V、When 総閲覧数を表示、Then `V`。
- [ ] **AC-F1-5**: Given 注文 0 件の店舗、When ダッシュボードを開く、Then KPI は全て `0`・チャートは空状態で例外を出さず描画される。
- [ ] **AC-F1-6**: Given 同一店舗の同一集計を 15 分以内に 2 回要求、When 統計を取得、Then 2 回目はキャッシュから返る（DB 再集計が走らない）。
- [ ] **AC-F1-7**: Given 店舗 A と店舗 B、When それぞれの統計を取得、Then キャッシュキーに `storeId` が含まれ **A の値が B に混入しない**。

### F2 在庫管理

- [ ] **AC-F2-1**: Given 当該店舗にバリアント×サイズが複数、When `/inventory` を開く、Then 全 Size 行が 商品名・バリアント・サイズ・在庫数・価格・ステータス列付きで一覧表示される。
- [ ] **AC-F2-2**: Given ある Size、When 在庫数を `12` に編集して確定、Then `Size.quantity` が `12` に更新され、一覧に反映される。
- [ ] **AC-F2-3**: Given 在庫数に `-1` を入力、When 確定、Then Zod バリデーションで弾かれ、`Size.quantity` は変化しない。
- [ ] **AC-F2-4（IDOR）**: Given 他店舗に属する `sizeId`、When `updateSizeStock(他店舗sizeId, 99, 自店舗storeUrl)` を呼ぶ、Then 所有権チェーン検証で拒否され、`db.size.update` が **呼ばれない**（3 階層: スロー検証 / where 構造検証 / 副作用なし検証）。
- [ ] **AC-F2-5**: Given `lowStockThreshold = 5`・`quantity = 0` の Size と `quantity = 3` の Size、When 一覧を表示、Then 前者に**在庫切れ(赤)**、後者に**過小(橙)**バッジが付く。
- [ ] **AC-F2-6**: Given `lowStockThreshold` を `10` に変更、When 在庫一覧を再描画、Then `quantity = 8` の Size が新たに過小バッジ対象になる。
- [ ] **AC-F2-7**: Given 在庫切れ 2 件・過小 3 件、When 一覧上部のサマリーを見る、Then「在庫切れ 2 / 過小在庫 3」が表示される。

### F3 在庫減算

- [ ] **AC-F3-1**: Given `Size.quantity = 10` の商品を 3 個注文、When 注文確定、Then 確定後の `Size.quantity` が `7` になる（同一 `$transaction` 内で減算）。
- [ ] **AC-F3-2**: Given `Size.quantity = 2` の商品を 5 個注文しようとする、When 注文確定、Then 「在庫が不足しています」で弾かれ、`Order`/`OrderGroup`/`OrderItem` は **1 件も作成されない**（ロールバック）。
- [ ] **AC-F3-3（レース）**: Given 在庫検証後・減算前に在庫が枯渇するシナリオ、When 条件付き `updateMany`（`quantity: { gte: qty }`）が `count === 0` を返す、Then 在庫不足として throw されロールバックする。
- [ ] **AC-F3-4（E2E）**: Given 在庫のある商品、When 購入フロー全体（カート→チェックアウト→注文確定）を実行、Then 注文が作成され、対象 Size の在庫が注文数分減る（Chromium/Firefox/WebKit）。
- [ ] **AC-F3-5（任意）**: Given 減算済みの注文を `Canceled` に変更、When ステータス更新、Then 減算分が `Size.quantity` に復元される（4-D 採用時）。

### 横断（規約適合）

- [ ] **AC-X-1**: 新規 seller query はすべて `requireStoreOwner()`（または `requireSeller()`）を使用し、インライン認可展開の新規追加が無い。
- [ ] **AC-X-2**: `Store.lowStockThreshold` 追加は `safe-migration` 経由で実施され、ER 図（`bun run erd:generate`）が同一コミットで再生成されている。
- [ ] **AC-X-3**: テスト統計（Tests 数 / スイート数 / スナップショット数）が変動した場合、`spec-sync-after-test` で関連ドキュメント（QA_HANDOFF.md SSOT 他）が同期されている。

---

## 8. トレーサビリティ

| 要件 ID 群 | design.md 対応セクション | tasks.md 対応フェーズ |
| --- | --- | --- |
| F1-* | [§3 F1 ダッシュボード設計](./design.md#3-f1-店舗ダッシュボードdashboardsellerstoresstoreurl) | Phase 3 |
| F2-* | [§2 F2 在庫管理設計](./design.md#2-f2-在庫管理dashboardsellerstoresstoreurlinventory) | Phase 2 |
| F3-* | [§5.2 placeOrder 在庫減算 影響箇所マトリクス](./design.md#52-placeorder-在庫減算の影響箇所マトリクス) | Phase 4 |
| スキーマ拡張 | [§5.1 スキーマ変更 lowStockThreshold](./design.md#51-スキーマ変更-storelowstockthreshold) | Phase 1 |
| NFR-*, C-* | [§4 判断 / §5 スキーマ・影響箇所](./design.md#4-設計の核心判断詳細) | 全フェーズ横断 |
