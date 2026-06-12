# 管理者ダッシュボード 3 機能 — 要件定義（requirements.md）

> 記法は **EARS 風**（Easy Approach to Requirements Syntax）。
> 「**WHEN** 〈契機〉、システムは〈応答〉**する**」「**IF** 〈条件〉、**THEN** システムは〜**する**」「**WHILE** 〈状態〉、〜」「**WHERE** 〈機能フラグ〉、〜」を用いる。
> 各要件に一意 ID（`F1-1`…）を付与し、[design.md](./design.md) / [tasks.md](./tasks.md) からトレース可能にする。

---

## 1. 目的

マルチベンダー E コマースの **運営者（ADMIN）** が、プラットフォーム全体の健全性を把握し、全店舗横断で注文とクーポンを統制できるようにする。現状 `/dashboard/admin` はプレースホルダー、`/dashboard/admin/orders` と `/dashboard/admin/coupons` は未作成で、sidebar にリンクのみ存在する。

## 2. ペルソナ

| ロール | 識別子 | 本機能での関心事 |
| --- | --- | --- |
| 管理者 | `ADMIN` | 全店舗の売上・注文状況の把握、注文ステータスの是正、クーポンの横断統制とプラットフォーム発行 |

> 顧客（USER）・販売者（SELLER）は本機能の直接の利用者ではない。ただし F3-第2段（platform-wide クーポン）は **顧客の決済フロー** に影響するため、回帰の観点で USER のチェックアウトを受け入れ基準に含める。

## 3. スコープ

### 3.1 スコープ内

- **F1**: ダッシュボード統計（KPI カード + 売上推移チャート + 最近の注文/新規ストア）
- **F2**: 注文管理（全店舗横断の一覧・検索/フィルタ・ページネーション・詳細閲覧・OrderGroup/OrderItem ステータス変更・Order paymentStatus 変更）
- **F3-第1段**: クーポン横断管理（全店舗一覧・編集・削除・有効/無効切替）
- **F3-第2段**: platform-wide クーポン発行（スキーマ拡張を伴う）

### 3.2 スコープ外

[README.md §スコープ境界](./README.md#スコープ境界最重要最初に確認) を参照。要約: **在庫管理全般**、**決済 API 自動連携**、多通貨、税計算、高度分析、seller 既存 query のリファクタ。

---

## 4. 機能要件

### F1: 管理者ダッシュボード統計（`/dashboard/admin`）

| ID | 要件（EARS 風） |
| --- | --- |
| **F1-1** | WHEN ADMIN が `/dashboard/admin` を開いたとき、システムは KPI カード群（総売上・総注文数・アクティブ店舗数・保留中店舗数・総ユーザー数・総商品数・カテゴリ数）を表示する。 |
| **F1-2** | 総売上の集計において、システムは `paymentStatus = Paid` の注文のみを合算し、`Refunded` / `Cancelled` / `Failed` / `Declined` / `ChargeBack` を除外する。 |
| **F1-3** | IF 注文の `paymentStatus = PartiallyRefunded`、THEN システムは（部分返金額フィールドが存在しないため）当該注文を **総売上から全額除外** する（[制限事項 C-e](#6-制限事項仕様境界) 参照）。 |
| **F1-4** | アクティブ/保留中店舗数の集計において、システムは `isDeleted = false` のストアのみをカウントする（論理削除ストアを除外、[判断6-3](./design.md#6-3-論理削除ストアの統計スコープ)）。 |
| **F1-5** | WHILE 売上集計を行う間、システムは論理削除済みストア（`isDeleted = true`）に紐づく `Paid` 注文も **売上には算入** する（過去の会計実績の保全）。 |
| **F1-6** | WHEN ADMIN がダッシュボードを開いたとき、システムは売上推移チャート（日次または月次）を表示する。 |
| **F1-7** | WHEN ADMIN がダッシュボードを開いたとき、システムは最近の注文（直近 N 件）と新規ストア（直近 N 件）を一覧表示する。 |
| **F1-8** | 統計集計関数は、リアルタイム性を要さないため、**15〜30 分のデータキャッシュ**を介して結果を返す（[判断5-1](./design.md#5-1-ダッシュボード集計のキャッシュ戦略)）。 |
| **F1-9** | 金額の表示・集計後の整形において、システムは `Prisma.Decimal` を `toNumberSafe()` で number 化してからクライアントへ渡す。 |

### F2: 注文管理（`/dashboard/admin/orders`）

| ID | 要件（EARS 風） |
| --- | --- |
| **F2-1** | WHEN ADMIN が `/dashboard/admin/orders` を開いたとき、システムは **全店舗の注文** を一覧表示する（seller 版が自店舗限定なのに対し、横断）。 |
| **F2-2** | 一覧の各行において、システムは注文 ID・含まれるストア・商品画像・paymentStatus・orderStatus・合計金額・詳細を開くアクションを表示する。 |
| **F2-3** | WHEN ADMIN が検索語・`paymentStatus` フィルタ・`orderStatus` フィルタを指定したとき、システムは該当注文のみに絞り込む。 |
| **F2-4** | 一覧取得において、システムはページネーション（`page` / `limit`）を適用し、`limit` は **最大 100 件にキャップ**、デフォルト 20 件とする（[判断6-5](./design.md#6-5-ページネーション上限キャップ)）。 |
| **F2-5** | IF `limit` に範囲外（`< 1` / 非整数 / `Infinity` / `NaN` / 100 超）が渡された、THEN システムはこれを正規化・キャップし、過大値による OOM/DoS を防ぐ。 |
| **F2-6** | WHEN ADMIN が注文の詳細を開いたとき、システムは（自分の注文か否かに関わらず）OrderGroup・OrderItem・ストア・配送先・決済詳細を表示する。 |
| **F2-7** | WHEN ADMIN が OrderGroup のステータスを変更したとき、システムは **店舗所有権チェック無し**（`requireAdmin()` のみ）で当該 OrderGroup の `status` を更新する。 |
| **F2-8** | WHEN ADMIN が OrderItem のステータスを変更したとき、システムは `requireAdmin()` の下で当該 OrderItem の `status`（`ProductStatus`）を更新する。 |
| **F2-9** | WHEN ADMIN が Order の `paymentStatus` を変更したとき、システムは **DB のステータスのみ** を更新する（Stripe/PayPal の返金/キャプチャ API は呼ばない、[制限事項 C-a](#6-制限事項仕様境界)）。 |
| **F2-10** | WHEN 親 Order が `Canceled` または `Refunded` に変更されたとき、システムは同一トランザクション内で配下の全 OrderGroup / OrderItem を連動更新する（[判断6-2](./design.md#6-2-order-と-ordergroup-のステータス伝播)）。 |
| **F2-11** | WHEN 全 OrderGroup が `Shipped` になったとき、システムは親 Order を `Shipped` に、一部のみのときは `PartiallyShipped` に集約更新する。 |
| **F2-12** | 注文ステータス変更時、システムは在庫の減算/復元を **行わない**（在庫管理はスコープ外）。admin action には将来の在庫連動フック位置を TODO コメントで残す（[判断5-2](./design.md#5-2-ステータス変更時の売上整合性在庫連動は今回スコープ外)）。 |

### F3: クーポン管理（`/dashboard/admin/coupons`）

#### F3-第1段（横断管理 + isActive）

| ID | 要件（EARS 風） |
| --- | --- |
| **F3-1** | WHEN ADMIN が `/dashboard/admin/coupons` を開いたとき、システムは **全店舗のクーポン** を一覧表示する（Store 列・有効/無効バッジを含む）。 |
| **F3-2** | WHEN ADMIN がクーポンを新規作成または編集したとき、システムは `requireAdmin()` の下で対象店舗を指定して upsert する。 |
| **F3-3** | WHEN ADMIN がクーポンを削除したとき、システムは **店舗所有権チェック無し**（`requireAdmin()` のみ）で削除する。 |
| **F3-4** | WHEN ADMIN がクーポンの有効/無効を切り替えたとき、システムは当該クーポンの `isActive` を更新する。 |
| **F3-5** | IF 作成/編集するクーポンの `code` が既存クーポンと重複する（`Coupon.code` は `@unique`）、THEN システムは Prisma の一意制約違反（P2002）を捕捉し「このクーポンコードは既に使用されています」を返す（[判断4](./design.md#判断4の影響箇所マトリクス3箇所)）。 |
| **F3-6** | WHILE クーポンが `isActive = false` の状態の間、IF 顧客がそのクーポンで注文を確定しようとした、THEN システムは「このクーポンは現在無効です」で弾き、トランザクションをロールバックする（[判断6-1](./design.md#6-1-クーポン無効化のすり抜け再検証)）。 |

#### F3-第2段（platform-wide 発行 / 破壊的拡張）

| ID | 要件（EARS 風） |
| --- | --- |
| **F3-7** | WHERE platform-wide クーポン機能が有効なとき、システムは `scope`（`STORE` / `PLATFORM`）を持つクーポンの発行を許可する。 |
| **F3-8** | WHEN `scope = PLATFORM` のクーポンがカートに適用されたとき、システムは **カート内の全アイテム** を割引対象とする（特定 store に限定しない）。 |
| **F3-9** | WHEN `scope = PLATFORM` のクーポンで注文が確定されたとき、システムは **全 OrderGroup** に割引（同率 %）を適用し、各 OrderGroup に `couponId` を紐付ける。最終的な `Order.total` はカート total と一致する（[判断4 #2](./design.md#判断4の影響箇所マトリクス3箇所)、[判断5-4](./design.md#5-4-金額計算の-decimal-一貫性と按分)）。 |
| **F3-10** | IF `scope = STORE`、THEN `storeId` は必須。IF `scope = PLATFORM`、THEN `storeId` は null/空を許容する（Zod `superRefine` による条件付き必須、[判断4](./design.md#判断4の影響箇所マトリクス3箇所)）。 |
| **F3-11** | platform-wide クーポンの割引按分において、システムは全工程を `Prisma.Decimal` で計算し、`Decimal(12,2)` 丸めで生じる端数（最大数セント）を **最終 OrderGroup で吸収** する（[判断5-4](./design.md#5-4-金額計算の-decimal-一貫性と按分)）。 |

---

## 5. 非機能要件（NFR）

| ID | 要件 | 根拠 |
| --- | --- | --- |
| **NFR-1（認可・多層防御）** | 全 admin Server Action は冒頭で `requireAdmin()` を呼ぶ。layout の `redirect("/")` と二重化する。 | [tech.md 認可ガード](../../../.claude/steering/tech.md)、[判断5-3](./design.md#5-3-認可境界特権昇格監査) |
| **NFR-2（型安全な権限分離）** | admin/seller 共用 UI（`OrderStatusSelect` 等）は **discriminated union props** でアクションを静的に切り替え、seller 文脈に admin action が混入しないことを型レベルで保証する。 | [判断5-3](./design.md#5-3-認可境界特権昇格監査) |
| **NFR-3（金額精度）** | 金額フィールドは `Decimal(12,2)`。演算は `Prisma.Decimal` メソッド（`.add/.sub/.mul/.div`）で行い、`.toNumber()` はシリアライズ/表示直前のみ。 | [tech.md 金額・数値精度](../../../.claude/steering/tech.md) |
| **NFR-4（動的レンダリング）** | DB 依存の各 `page.tsx` は `export const dynamic = 'force-dynamic';` を宣言する。統計取得関数だけをデータキャッシュ層で包む（動的ページ × キャッシュ済みデータの分離）。 | [tech.md 動的レンダリング規約](../../../.claude/steering/tech.md)、[判断5-1](./design.md#5-1-ダッシュボード集計のキャッシュ戦略) |
| **NFR-5（構造化ログ・監査）** | 状態変更系 admin action は `[Admin:Action] actor=<userId> target=<id> from=<x> to=<y>` 形式の構造化ログを残す。`console.log` 禁止規約に抵触しない手段を用いる。 | [判断5-3](./design.md#5-3-認可境界特権昇格監査) |
| **NFR-6（アトミック性）** | 複数テーブルを更新する操作（親子ステータス連動、注文確定）は `db.$transaction` でアトミック化する。 | [tech.md アトミック操作](../../../.claude/steering/tech.md) |
| **NFR-7（エラーハンドリング）** | 外部呼び出し（Prisma 等）は `try/catch` でラップし、`instanceof Error` で型ガードする。新規 query では `any` を使わず `unknown` + 型ガード。 | [tech.md](../../../.claude/steering/tech.md) |
| **NFR-8（i18n）** | 国際化（多言語 UI）は対象外。文言は既存に倣う。 | product.md スコープ |
| **NFR-9（後方互換）** | `storeId` の nullable 化（第2段）の前に、`coupon.store` / `coupon.storeId` を非null前提で扱う箇所を **先行して null セーフ化** し、退行を防ぐ。 | [判断5-5](./design.md#5-5-下位互換性確保--storeid-nullable-化の退行防止) |

---

## 6. 制限事項（仕様境界）

| ID | 制限 | 詳細 |
| --- | --- | --- |
| **C-a** | `paymentStatus` 手動変更は **DB ステータス更新のみ** | Stripe/PayPal の自動返金/キャプチャ API 呼び出しはスコープ外。運営者が各決済ダッシュボードで別途操作する前提。 |
| **C-b** | 1 カートに複数クーポンは不可 | 現状 `cart.couponId` は単一。platform-wide クーポンと store クーポンの併用はできない。 |
| **C-c** | `Coupon.code` はプラットフォーム全体で一意 | `@unique` 制約。store 間でも同一コードは作成不可（P2002 でハンドリング）。 |
| **C-d** | **在庫管理はスコープ外** | カートの DB 永続化・在庫予約・注文時の在庫減算・キャンセル/返品時の復元は仕様確定後に別タスク。現状 `placeOrder` は在庫を減算しない既知ギャップ。 |
| **C-e** | 部分返金額フィールド未実装 | `PartiallyRefunded` は総売上から全額除外。正確な部分減算には将来 `Order.refundedAmount Decimal(12,2)` の追加が前提。 |

---

## 7. 受け入れ基準（Acceptance Criteria）

> Given–When–Then 風のチェックリスト。各機能の「完了の定義」。実装時にテストへ落とし込む（[tasks.md](./tasks.md)）。

### F1 ダッシュボード

- [ ] **AC-F1-1**: Given 非 ADMIN ユーザー、When `/dashboard/admin` にアクセス、Then `/` にリダイレクトされる。
- [ ] **AC-F1-2**: Given `Paid` 注文 3 件（合計 $X）と `Refunded` 注文 1 件、When 総売上を表示、Then 表示額は `$X`（Refunded は除外）。
- [ ] **AC-F1-3**: Given `status = PENDING` のストアが 2 件、When 保留中店舗数を表示、Then `2`。
- [ ] **AC-F1-4**: Given 論理削除済み（`isDeleted = true`）ストアが 1 件、When 店舗数を表示、Then そのストアはカウントに **含まれない**。
- [ ] **AC-F1-5**: Given 論理削除済みストアに `Paid` 注文がある、When 総売上を表示、Then その売上は **算入される**。
- [ ] **AC-F1-6**: Given 同一の集計を 15 分以内に 2 回要求、When 統計を取得、Then 2 回目はキャッシュから返る（DB 再集計が走らない）。

### F2 注文管理

- [ ] **AC-F2-1**: Given 複数店舗の注文、When `/dashboard/admin/orders` を開く、Then 全店舗の注文が一覧に現れ、各行に **ストア名（または店舗識別）列** がある。
- [ ] **AC-F2-2**: Given 非 ADMIN ユーザー、When `updateOrderGroupStatusAsAdmin` を直接呼ぶ、Then 「Only admins can perform this action.」で拒否される。
- [ ] **AC-F2-3**: Given `limit=500000` のリクエスト、When 一覧を取得、Then 実際の取得件数は **100 件以下** にキャップされる。
- [ ] **AC-F2-4**: Given ある OrderGroup、When ADMIN がステータスを `Shipped` に変更、Then 店舗所有権に関わらず更新が成功する。
- [ ] **AC-F2-5**: Given 親 Order を `Canceled` に変更、When 更新、Then 配下の全 OrderGroup / OrderItem も同一トランザクションで連動更新される。
- [ ] **AC-F2-6**: Given `paymentStatus` を `Refunded` に手動変更、When 更新、Then DB は更新されるが Stripe/PayPal の API 呼び出しは **発生しない**。

### F3 クーポン管理

- [ ] **AC-F3-1**: Given 複数店舗のクーポン、When `/dashboard/admin/coupons` を開く、Then 全店舗のクーポンが Store 列・Active バッジ付きで一覧表示される。
- [ ] **AC-F3-2**: Given 既存クーポンと同一の `code`、When 新規作成、Then P2002 を捕捉し「このクーポンコードは既に使用されています」が返る。
- [ ] **AC-F3-3**: Given クーポンを `isActive = false` に切替後、When 顧客がそのクーポンで注文確定、Then 「このクーポンは現在無効です」で弾かれ、注文は作成されない。
- [ ] **AC-F3-4（第2段）**: Given `scope = PLATFORM`・`storeId = null` のクーポン、When カート（複数店舗の商品）に適用、Then 全アイテムが割引対象になる。
- [ ] **AC-F3-5（第2段）**: Given platform-wide クーポンを適用したカート、When 注文確定、Then 全 OrderGroup に割引が適用され、`Order.total` がカート total と一致する（端数は最終グループで吸収）。
- [ ] **AC-F3-6（第2段）**: Given `scope = STORE` で `storeId` 未指定、When フォーム送信、Then Zod バリデーションで弾かれる。

### 横断（規約適合）

- [ ] **AC-X-1**: 新規 admin query はすべて `requireAdmin()` を使用（インライン認可展開の新規追加が無い）。
- [ ] **AC-X-2**: 第2段の `storeId` nullable 化は `safe-migration` 経由で実施され、ER 図（`bun run erd:generate`）が再生成されている。
- [ ] **AC-X-3**: テスト統計が変動した場合、`spec-sync-after-test` で関連ドキュメントが同期されている。

---

## 8. トレーサビリティ

| 要件 ID 群 | design.md 対応セクション | tasks.md 対応フェーズ |
| --- | --- | --- |
| F1-* | [§F1 ダッシュボード設計](./design.md#2-f1-dashboardadmindashboard) | Phase 2 |
| F2-* | [§F2 注文管理設計](./design.md#3-f2-注文管理dashboardadminorders) | Phase 1 |
| F3-1〜F3-6 | [§F3 クーポン設計（第1段）](./design.md#4-f3-クーポン管理dashboardadmincoupons) | Phase 3 |
| F3-7〜F3-11 | [§スキーマ第2段 + 影響箇所マトリクス](./design.md#52-スキーマ変更第2段platform-wide) | Phase 4-5 |
| NFR-*, C-* | [§判断 5・6](./design.md#判断5-アーキテクチャ品質要件) | 全フェーズ横断 |
