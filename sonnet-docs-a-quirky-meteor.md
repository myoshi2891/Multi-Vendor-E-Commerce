# 管理者ダッシュボード3機能の詳細設計ドキュメント作成

## Context（なぜこの作業を行うか）

docs/unimplemented-screens-plan.md の「A. 管理者ダッシュボード」に挙がった3つの未実装画面を、**Sonnet が迷わず実装できる詳細さ**の設計ドキュメントへ落とし込む。対象は以下：

| ルート | 現状 | 必要機能 | 優先度 |
| --- | --- | --- | --- |
| `/dashboard/admin` | プレースホルダー | 統計可視化メインダッシュボード | 中 |
| `/dashboard/admin/orders` | 未作成（サイドバーにリンク有） | 全店舗横断の注文一覧・詳細・ステータス変更 | 高 |
| `/dashboard/admin/coupons` | 未作成（サイドバーにリンク有） | クーポン横断管理 + platform-wide 発行（拡張） | 中 |

**この作業の成果物はコードではなく設計ドキュメント（Markdown）**。実装は後続セッション（Sonnet 可）で tasks.md に沿って行う。

### ユーザー確定事項（AskUserQuestion 回答）

1. **クーポン範囲** = 拡張設計+段階実装 → 設計書に platform-wide 発行までの完全な拡張パスを記述。実装は第1段（横断管理）/第2段（platform-wide、スキーマ変更）に分割。
2. **ドキュメント構成** = `docs/design/admin-dashboard/` に requirements / design / tasks の3分割。
3. **統計範囲** = KPIカード + 売上推移チャート + 最近の注文/新規ストア。
4. **注文ステータス変更** = 全店舗変更可（admin 専用 query を新設）。

### スコープ調整（重要）

- **在庫管理（カートの DB 永続化・在庫予約・注文時の在庫減算・キャンセル時の在庫復元）は今回スコープ外**。ユーザー指示により、仕様が固まり次第、別タスクとして改めて依頼される。本計画では実装せず、注文管理の admin ステータス変更 action に将来の在庫連動フック位置（TODO コメント）のみ残す。

---

## 成果物（作成するファイル）

`docs/design/admin-dashboard/
├── README.md          # 索引・概要・読み順・スコープ境界
├── requirements.md    # 要件・ユーザーストーリー・受け入れ基準（EARS 風）
├── design.md          # 詳細設計（アーキテクチャ・queries・コンポーネント・スキーマ）
└── tasks.md           # TDD ステップ・コミット粒度・並列性・依存関係`

`docs/` 直下には索引行を1つ追記する選択肢もあるが、原則 `docs/design/admin-dashboard/README.md` を入口とする。

> 配置根拠: .claude/steering/documentation-guide.md の Layer 4（実装ガイド）に相当。ai-driven-development-guidelines の requirements/design/tasks 3分割に準拠。
>

---

## 設計の核心判断（3ドキュメント横断の前提）

### 判断1: 既存実装の最大再利用（新規発明の最小化）

seller ダッシュボードに同等機能が実装済み。admin 版は「全店舗横断」への一般化として設計する。

| 再利用元 | パス | admin での扱い |
| --- | --- | --- |
| 注文一覧テーブル | `src/app/dashboard/seller/stores/[storeUrl]/orders/columns.tsx` | **Store 名列を追加**して流用 |
| 注文詳細モーダル | `src/components/dashboard/shared/store-order-summary.tsx` | そのまま流用 |
| ステータス変更UI | `src/components/dashboard/forms/order-status-select.tsx` | admin 用 action を注入できるよう **props 拡張**（判断5-3） |
| クーポンフォーム | `src/components/dashboard/forms/coupon-details.tsx` | **store 選択 + scope 切替**を追加した admin 版を派生 |
| クーポン列 | `src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx` | Store 列 + Active バッジを追加 |
| データテーブル | `src/components/ui/data-table.tsx` | そのまま流用 |
| Decimal→number | `src/lib/utils.ts` の `toNumberSafe()` | 金額集計・表示で使用 |
| チャート | `@tremor/react`（既存依存）/ `src/components/ui/chart.tsx` | **依存追加なし**で使用 |

### 判断2: 認可は `requireAdmin()` を新規 query で使う（既存負債を触らない）

- 既存 `src/queries/order.ts` の `updateOrderGroupStatus` 等は **インライン認可展開**（`currentUser()` + role チェック）= tech.md 上は負債。これは**改変せず温存**（安全な差分・既存テスト保護）。
- admin 用に**新規追加**する query はすべて `src/lib/auth-guards.ts` の `requireAdmin()` を使う（CLAUDE.md「インライン展開を新規追加禁止」準拠）。
- `src/queries/coupon.ts` の `isGuardError` には既に `'Only admins can perform this action.'` が含まれており、admin query 追加が想定済み。
- layout の認可（`src/app/dashboard/admin/layout.tsx` の `redirect("/")`）は既存どおり画面アクセス制御として機能。各 server action は**多層防御**として再度 `requireAdmin()` を呼ぶ。

### 判断3: クーポンの段階的マイグレーション（破壊性の境界を明示）

現状 `Coupon` モデル: `code @unique`(グローバル一意), `startDate/endDate` は **String**, `storeId` **必須**, **isActive 無し**。

- **第1段（安全な列追加・後方互換）**: `isActive Boolean @default(true)` を追加 → 「有効/無効切替」を実現。既存行は default で有効。`migrate dev` で履歴化。
- **第2段（破壊的変更・`safe-migration` 必須）**: platform-wide 発行のため

    `enum CouponScope { STORE  PLATFORM }
    model Coupon {
      scope   CouponScope @default(STORE)   // 追加
      storeId String?                        // 必須 → nullable
      store   Store? @relation(...)
    }`

  - `applyCoupon` を改修（`scope=PLATFORM` は全 cartItems に割引適用、`STORE` は従来どおり storeId フィルタ）。
- **代替案も design.md に明記**: 有効/無効を第2段にまとめる案（第1段スキーマ変更ゼロ）も提示し、レビュー判断に委ねる。

### 判断4: platform-wide クーポン（第2段）が既存決済フローを破壊する3箇所（最重要）

`storeId: String → String?` への変更は、storeId の**等価比較**と `coupon.store` への**非null前提アクセス**を含む既存3箇所を実行時に壊す。**第2段タスクに「改修 + 回帰テスト」を必須で含める**。design.md に下表をそのまま転記する。

| # | 箇所 | 現状コード | storeId=null での破綻 | 改修方針 |
| --- | --- | --- | --- | --- |
| 1 | `applyCoupon`<br>`src/queries/coupon.ts` L240-289 | `cart.cartItems.filter(i => i.storeId === storeId)` / メッセージ `${coupon.store.name}` | 全item対象外→「No items」誤エラー／`store=null` で **TypeError** | `scope===PLATFORM` は全cartItemsを対象。成功メッセージを store 非依存の汎用文言へ条件分岐 |
| 2 | `placeOrder`<br>`src/queries/user.ts` L641-665 | `check = storeId === cartCoupon?.storeId`／`couponId: check ? id : null` | 全OrderGroupで `check=false` → **割引消失（満額で注文作成）**・couponId未紐付け→カートtotalと乖離 | `check = scope==='PLATFORM' || storeId === cartCoupon?.storeId`。PLATFORM は各 OrderGroup の`groupedTotalPrice`に`discount%` を適用（％演算のため全グループ合計はカートと一致）し、全該当グループに couponId を紐付け |
| 3 | カート再計算（`saveUserCart` 系）<br>`src/queries/user.ts` L1072-1151 | `i.storeId === coupon.storeId`／返却時 `cart.coupon.store.<Decimal4種>.toNumber()` | 割引未適用／`store=null` で **TypeError** | PLATFORM は全item対象。返却整形で `cart.coupon.store` を null ガード（`store ? {...toNumber} : null`） |

**決済プロバイダ境界**: F2 の `paymentStatus` 手動変更（Paid/Refunded 等）は **DB ステータス更新のみ**。Stripe/PayPal の Refund/Capture API 自動呼び出しは**スコープ外**（運営者が各決済ダッシュボードで別途操作する前提）。requirements.md に制限事項として明記。

**コード一意性**: `Coupon.code` は `@unique`（プラットフォーム全体一意）。`upsertCouponAsAdmin` の重複検知は **code 単独**で行う（既存 seller 版の `code + storeId` 複合チェックは DB の単一列ユニーク制約と不整合になりうる）。seller の `upsertCoupon` も platform/他店舗コードと衝突しうるため、Prisma の一意制約違反（P2002）を捕捉し「このクーポンコードは既に使用されています」を返すエラーハンドリングを design.md に明記。

**Zod 条件付き**: admin 版 `CouponFormSchema`（または派生スキーマ）は `superRefine` で `scope===STORE → storeId 必須`／`scope===PLATFORM → storeId は null/空` を検証。`discount` 1-99 は既存維持。フォームは scope ドロップダウン連動で storeId セレクトの活性/必須を切替。

### 判断5: アーキテクチャ品質要件（既存実装の事実に基づく）

既存実装を実地確認した結果に基づき、エンタープライズ品質のための必須設計要件を定義する。**各 doc に下記を反映**。

### 5-1. ダッシュボード集計のキャッシュ戦略（DB負荷・スケーラビリティ）

- **既存事実**: src/ にキャッシュ戦略は皆無（`unstable_cache`/`revalidate*` 使用ゼロ）、全 DB 依存ページが `force-dynamic`。
- **設計**: `getAdminDashboardStats()` は `_sum`/`count`/`groupBy` を `Promise.all` で並列化しつつ、**`unstable_cache`（or Next.js 16 `"use cache"` + `cacheLife`）で 15〜30分キャッシュ**を必須要件とする（統計にリアルタイム性は不要）。
- **tech.md 整合**: ページは `force-dynamic` を維持（DB依存ページ規約）し、**統計取得関数だけをデータキャッシュ層で包む**（「動的ページ × キャッシュ済みデータ」の分離）。design にこの整合理由を明記。
- **ロードマップ**: 数十万件規模では集計サマリーテーブル（`DashboardSnapshot`：日次バッチ集計）/ マテビュー導入を将来拡張として記載。集計対象列（`Order.paymentStatus`・`createdAt`、`Store.status`）のインデックス確認を tasks に含める。

### 5-2. ステータス変更時の売上整合性（在庫連動は今回スコープ外）

- **在庫管理は別タスク**: 在庫の減算・復元・カート永続化・在庫予約は、**仕様確定後に別途実装**（ユーザー指示によりスコープ外）。現状 `placeOrder` は `Size.quantity` を減算しない（既知ギャップ）。本設計の admin ステータス変更 action には**将来の在庫連動フック位置（TODO コメント）のみ**残し、在庫ロジックは実装しない。
- **売上集計の返金考慮**: 総売上は `paymentStatus = Paid` のみ集計し `Refunded`/`Cancelled`/`Failed` を除外。**`PartiallyRefunded` は Order に返金額フィールドが無い**ため正確な減算不可 → 「現状は総売上から全額除外」とし、正確な部分返金には将来 `Order.refundedAmount Decimal(12,2)` 追加が必要と明記。
- **副作用マトリクス**: 変更先ステータス × 売上への影響を design に掲載（在庫への影響欄は「在庫管理仕様で別途」と注記）。

### 5-3. 認可境界・特権昇格・監査（セキュリティ）

- **UI 共通化の型安全**: `OrderStatusSelect` 等を admin/seller 共用する際、**discriminated union props**（例 `{ mode:'seller'; storeId:string } | { mode:'admin' }`）でアクションを静的に切替え、seller 文脈に admin action が混入しないことを**型レベルで保証**。
- **多層防御**: admin Server Action（`AsAdmin`）は冒頭 `requireAdmin()` 必須。layout の redirect と二重化。
- **監査ログ**: 状態変更系 admin action に操作ログを残す。**既存事実**: `console.info` 使用ゼロ／tech.md は構造化 `console.error` のみ規定 → design で「`[Admin:Action] actor=<userId> target=<id> from=<x> to=<y>` 形式の構造化ログ」方針を新規定義（`console.log` 禁止規約に抵触しない手段）。永続監査が要件化したら `AuditLog` テーブルをロードマップへ。
- **IDOR**: admin は `requireAdmin` で全件許可（正当）。seller 既存 query の `requireStoreOwner` は不変。

### 5-4. 金額計算の Decimal 一貫性と按分（計算精度・丸め誤差）

- **既存事実**: `placeOrder` は `Prisma.Decimal` チェーンで一貫（良）。一方 **`applyCoupon`（coupon.ts L253-267）は `.toNumber()` 経由の JS 浮動小数点演算**（精度リスク）。
- **設計**: 金額演算は全工程 `Prisma.Decimal`（`.add/.sub/.mul/.div`）で行い、`.toNumber()` は**シリアライズ/表示直前のみ**。`applyCoupon` の Number 演算の Decimal 化を第2段の改修に含める（既存の精度バグ修正も兼ねる）。
- **按分アルゴリズム**: 現状 `discount` は **Int の % のみ**。PLATFORM は各 OrderGroup に**同率 %** を適用 → ％演算のため理論合計はカート割引と一致。`Decimal(12,2)` 丸めで生じる**最大数セントの差は最終 OrderGroup で吸収**（`総割引 − Σ(確定済グループ割引)` を最終グループに割当）するアルゴリズムを design に明記。
- **将来拡張**: 定額割引（`discountType: PERCENT|FIXED`）導入時は「各ストア小計の比率で按分 + 最終グループで端数吸収」を採用する旨を記載。

### 5-5. 下位互換性確保 — storeId nullable 化の退行防止（データ移行）

- **設計**: `storeId` の nullable 化は、既存の `getStoreCoupons`／`applyCoupon`／`saveUserCart`／`placeOrder`／クーポン UI（`coupon-details`・columns）で `coupon.storeId`・`coupon.store` を非null前提で扱う箇所をランタイムで壊しうる。
- **順序（tasks.md で F3-第2段の直前に「下位互換性確保ステップ」を新設）**: ①既存コードを **null セーフ化**（`coupon.store?.name ?? '全店舗'` 等、スキーマは非nullのまま**先行防御**）→ ②`bunx tsc --noEmit` + 既存テスト緑を確認 → ③`safe-migration` で nullable 化 → ④platform-wide 機能追加。**コード防御を先・スキーマ変更を後**にして退行を吸収する。

### 判断6: 状態整合性・認可SSOT・入力上限

### 6-1. クーポン無効化のすり抜け再検証

- **既存事実**: `placeOrder`（user.ts L646）と `applyCoupon` は期限（startDate/endDate）のみ検証し isActive を見ない。
- **設計**: 第1段の `isActive` 追加と**同時に**、`placeOrder` のクーポン適用判定と `applyCoupon` に **`coupon.isActive === true` の再検証**を追加。カート適用後に管理者が無効化しても、注文確定時に「このクーポンは現在無効です」で弾き、トランザクションをロールバック。

### 6-2. Order と OrderGroup のステータス伝播

- **設計**: 親 Order ↔ 子 OrderGroup/OrderItem の**状態遷移ルールをステートマシンとして design に定義**。連動規則: (a) 親 Order を Canceled/Refunded → 全 OrderGroup/OrderItem を一括連動（同一 `db.$transaction`）。(b) 全 OrderGroup が Shipped → 親 Order を Shipped、一部のみ → PartiallyShipped に集約更新。`updateOrderGroupStatusAsAdmin`/`updateOrderPaymentStatus` は単独実行でも親子整合を保つトリガーロジックを持つ。（在庫連動は今回スコープ外）

### 6-3. 論理削除ストアの統計スコープ

- **既存事実**: `getAllStores` は `isDeleted` 未フィルタ。`deleteStore` は `isDeleted:true` のソフト削除。
- **設計**: 統計の境界条件を明文化 — **ストア数カウントは `isDeleted:false` のみ**。一方**売上集計は論理削除ストアの Paid 注文も維持**（過去の会計実績を保全）。`getAdminDashboardStats` で両スコープを分離実装。

### 6-4. 認可ロールの SSOT

- **既存事実**: Clerk Webhook（`/api/webhooks/clerk/route.ts`）が `db.user.upsert({ id: data.id, role: data.private_metadata?.role || "USER", ... })` で **Clerk user.id を DB User.id の主キーに直結**し、**Clerk `privateMetadata.role` を DB `User.role` へ一方向同期**している。
- **設計**: **認可の SSOT = Clerk `privateMetadata.role`**（middleware/layout が参照）。DB `User.role` はミラー（Webhook 経由で同期）。ロール変更 Server Action（将来のユーザー管理含む）では **Clerk `updateUserMetadata` を更新 → Webhook（user.updated）が DB へ伝播**を正道とし、DB 直書きで Webhook 同期と競合させない方針を明記。本3機能はロール変更を含まないため、design に**認可 SSOT 原則**として記載するに留める。

### 6-5. ページネーション上限キャップ

- **設計**: `getAllOrders`/`getAllCoupons` の `limit` を **Zod で `z.number().int().min(1).max(100)`・デフォルト 20**。URL パラメータは tech.md の `Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1` 正規化に**上限キャップ**を併用し、`limit=500000` 等の極端値による OOM/DoS を防止。Prisma は `take`/`skip` で実装。

---

## 各ドキュメントの内容骨子

### `requirements.md`

- **目的・スコープ・スコープ外**（platform-wide 発行は第2段、**在庫管理は今回スコープ外**、税計算/多通貨は product.md でスコープ外）。
- **ペルソナ**: ADMIN（運営者）。
- **機能要件**（EARS 風「〜のとき、システムは〜する」）を3機能ごとに記載：
  - F1 ダッシュボード: KPI 表示、売上推移チャート、最近の注文/新規ストア。
  - F2 注文管理: 一覧（検索/フィルタ/ページネーション）、詳細閲覧、OrderGroup/Item ステータス変更、Order paymentStatus 変更。
  - F3 クーポン管理: 横断一覧（store 列）、編集、削除、有効/無効切替、（第2段）platform-wide 発行。
- **非機能要件**: 認可（ADMIN 限定・多層防御）、金額精度（Decimal(12,2)）、動的レンダリング（`force-dynamic`）、i18n は対象外。
- **制限事項（仕様境界）**: (a) `paymentStatus` 手動変更は DB ステータス更新のみ。**Stripe/PayPal の自動返金/キャプチャ API 呼び出しはスコープ外**。(b) platform-wide クーポンと既存 store クーポンの併用（1カートに複数クーポン）は不可（現状 `cart.couponId` 単一）。(c) `Coupon.code` はプラットフォーム全体で一意。(d) **在庫管理（カートの DB 永続化・在庫予約・注文時の在庫減算・キャンセル時の在庫復元）は今回スコープ外**（仕様確定後に別タスク。現状 placeOrder は在庫を減算しない既知ギャップ）。(e) **部分返金額フィールド未実装**のため `PartiallyRefunded` は総売上から全額除外（正確な部分減算は将来 `Order.refundedAmount` 追加が前提）。
- **受け入れ基準**: 各機能のチェックリスト（例: 非 ADMIN は `/` リダイレクト、未承認ストア数が PENDING 件数と一致 等）。

### `design.md`（中核）

3機能それぞれを以下の粒度で：

**共通**

- ルーティング規約: 各 `page.tsx` 冒頭に `export const dynamic = 'force-dynamic'`（DB 依存ページ規約）。
- ディレクトリ構成図（page.tsx / columns.tsx / 専用コンポーネント）。

**F1 `/dashboard/admin`（ダッシュボード）**

- 新規 query ファイル `src/queries/dashboard.ts`:
  - `getAdminDashboardStats()` → `requireAdmin()` 後、`Promise.all` で並列集計。総売上(`order.aggregate _sum.total`, paymentStatus=Paid)、総注文数(`order.count`)、ストア数(`store.groupBy status` で ACTIVE/PENDING、`isDeleted:false`)、カテゴリ/サブカテゴリ/商品/ユーザー数(`count`)。返り値型を定義。`unstable_cache`（判断5-1）。
  - `getSalesOverTime(period: 'daily'|'monthly')` → 期間別売上配列（チャート用）。
  - `getRecentOrders(limit)` / `getRecentStores(limit)` → 最近データ。
- UI: KPIカード群（shadcn Card）+ 売上チャート（Tremor `AreaChart` or chart.tsx）+ 最近の注文/ストアリスト。プレースホルダー `page.tsx` を置換。
- Decimal は `toNumberSafe()` で number 化してから表示・集計。

**F2 `/dashboard/admin/orders`（注文管理）**

- 新規 query（`src/queries/order.ts` に追加、`requireAdmin()` 使用）:
  - `getAllOrders(filters?: { paymentStatus?, orderStatus?, search?, page?, limit? })` → 全店舗 Order。include groups{items,store,coupon}, shippingAddress{country,user}, paymentDetails。ページネーション（`limit` は判断6-5 の上限キャップ）。
  - `getOrderForAdmin(orderId)` → userId フィルタ無し版（既存 `getOrder` は自分の注文限定のため別途必要）。
  - `updateOrderGroupStatusAsAdmin(groupId, status)` / `updateOrderItemStatusAsAdmin(orderItemId, status)` → 店舗所有権チェック無し・`requireAdmin()`。親子連動（判断6-2）。
  - `updateOrderPaymentStatus(orderId, status)` → Order.paymentStatus 更新（DB のみ・決済API連携なし）。
- 返り値型 `AdminOrderType` を `src/lib/types.ts` に追加（`Prisma.PromiseReturnType`）。
- UI: `page.tsx`（DataTable）+ `columns.tsx`（seller 版 + Store 列）+ 詳細モーダル（`StoreOrderSummary` 流用）+ ステータス変更（`OrderStatusSelect` を discriminated union props で admin 対応、判断5-3）。
- 一覧の `getAllOrders` は store 横断のため `Order` 起点（seller 版は OrderGroup 起点）。設計で起点の違いを明示。
- **在庫連動は今回スコープ外**: 注文ステータス変更に伴う在庫減算/復元は在庫管理仕様の確定後に別タスク。admin action には将来の在庫連動フック位置（TODO コメント）のみ残す。

**F3 `/dashboard/admin/coupons`（クーポン管理）**

- 新規 query（`src/queries/coupon.ts` に追加、`requireAdmin()` 使用）:
  - `getAllCoupons(filters?)` → 全 Coupon + store（`limit` 上限キャップ）。
  - `upsertCouponAsAdmin(coupon)` → 第1段は storeId 指定編集、第2段で scope/nullable storeId 対応。code グローバル一意の衝突チェック（P2002 ハンドリング）。
  - `deleteCouponAsAdmin(couponId)` → 所有権チェック無し。
  - `toggleCouponActive(couponId, isActive)` → 第1段の isActive 追加後に有効。
- Zod: `src/lib/schemas.ts` の `CouponFormSchema` を admin 拡張（`isActive`、第2段で `scope` + 条件付き `storeId` を `superRefine`）。
- UI: `page.tsx` + `new/page.tsx`（seller 同様の専用作成ページ）+ `columns.tsx`（Store 列 + Active バッジ）+ admin 版 `coupon-details` フォーム（store 選択ドロップダウン + scope 切替 + active トグル）。
- **スキーマ変更セクション**: 第1段/第2段の Prisma diff、`migrate dev` vs `safe-migration` の使い分け、**判断4 の影響3箇所マトリクス（applyCoupon / placeOrder / カート再計算）の改修内容と回帰テスト**、code 一意制約違反(P2002)ハンドリング、ER 図再生成（`bun run erd:generate`, 03-data-model-diagram-sync.md 準拠）を明記。
- **影響箇所サブセクション**: 判断4 の表を design.md にそのまま掲載し、各改修の Before/After 擬似コードを添える（Sonnet が該当行を特定して差分修正できる粒度）。
- **isActive 再検証（判断6-1）**: 第1段で `placeOrder`/`applyCoupon` に isActive チェックを追加。
- **拡張余地**: 利用回数上限・最低購入額・対象カテゴリ限定などを「将来フィールド候補」として列挙（今後の拡張前提）。

### `tasks.md`

.claude/rules/02-tdd-step-commit.md 準拠で、各タスクを Red→Green→Refactor とコミット粒度に分解。ai-driven Rule 6 に従い**並列性**を明示。

- **フェーズ順**（優先度・依存・破壊性に基づく。安全な変更を先・破壊的変更を最後に）:
    1. **F2 注文管理（高優先・スキーマ変更なし）** ← 最初に着手。admin 専用 query（`requireAdmin`）+ `OrderStatusSelect` の discriminated union 化（判断5-3）。注文一覧は `limit` 上限キャップ（判断6-5）、ステータス変更は親子連動更新（判断6-2）。売上集計対象列のインデックス確認も付随。（在庫連動は今回スコープ外）
    2. **F1 ダッシュボード統計**（F2 の query を一部再利用可）。`getAdminDashboardStats` は `unstable_cache` でキャッシュ（判断5-1）。売上集計は `paymentStatus=Paid` のみ・返金除外（判断5-2）。ストア数は `isDeleted:false`（判断6-3）。
    3. **F3-第1段 クーポン横断管理 + `isActive` 列追加**（`migrate dev`、後方互換の安全な列追加）。同時に `placeOrder`/`applyCoupon` に **`isActive` 再検証**を追加（判断6-1）。
    4. **下位互換性確保ステップ（判断5-5）**: 第2段の前に、`getStoreCoupons`/`applyCoupon`/`saveUserCart`/`placeOrder`/クーポン UI の `coupon.store`・`storeId` を **null セーフ化先行**（スキーマは非nullのまま）→ `bunx tsc --noEmit` + 既存テスト緑を確認。
    5. **F3-第2段 platform-wide 発行**（`safe-migration` で `storeId` nullable 化 + `CouponScope` enum → 判断4 の**既存3箇所改修**（applyCoupon / placeOrder / カート再計算）+ 判断5-4 の Decimal 一貫化・按分端数吸収 → 各箇所の**回帰テスト**（特に placeOrder の PLATFORM クーポンで全 OrderGroup に割引適用され Order.total がカート total と一致すること）→ ER 図再生成）。**破壊的かつ決済フローに波及するため最後に単独で**実施し、E2E（`tests/e2e/`）で購入フロー全体を検証。
- 各 server action は `server-action-scaffold` スキルで雛形生成 → `src/queries/*.test.ts` に AAA パターンの正常系/異常系（特に **非 ADMIN 拒否**の認可テスト）。
- IDOR/認可テストは3階層パターン（SECURITY_GAP_REPORT.md §5.2）。
- テスト統計が変動したら `spec-sync-after-test` → `bun run coverage:dashboard` 同期（同一コミット）。
- 各タスクに **並列可否マーク**（例: F2 columns と F2 query は並列可、スキーマ変更は直列）。
- 完了の定義: `test-complete`（lint/tsc/test 3点）通過 + `bun run build` 成功。

---

## 検証（この設計作業の完了確認）

成果物は Markdown のため、検証 = **規約適合とレビュー可能性**：

1. `docs/design/admin-dashboard/` に4ファイルが生成され、README から相互リンクが張られている。
2. design.md の全 query シグネチャ・ファイルパスが実在パスと整合（`src/queries/`, `src/components/dashboard/...`）。
3. スキーマ変更が第1段/第2段に分離され、破壊的変更に `safe-migration` 適用が明記されている。 3b. **判断4 の影響3箇所**（applyCoupon / placeOrder / カート再計算）の改修方針・回帰テストと、**決済プロバイダ境界**（手動 paymentStatus = DB のみ）が design.md / requirements.md に明記されている。 3c. **判断5 のアーキテクチャ要件**が反映されている: 統計のキャッシュ戦略（5-1）、**在庫連動は今回スコープ外と明記・将来フック位置のみ**（5-2）、admin action の discriminated union 型ガード + 構造化監査ログ（5-3）、Decimal 一貫演算と按分の端数吸収（5-4）、storeId nullable 化**前**の下位互換ステップ（5-5）。 3d. **判断6 の整合性要件**が反映されている: 注文確定時の `isActive` 再検証（6-1）、Order↔OrderGroup の状態遷移ステートマシン（6-2）、論理削除ストアの統計スコープ分離（6-3）、認可 SSOT=Clerk privateMetadata（6-4）、`limit` 上限キャップ z.max(100)（6-5）。
4. tasks.md が TDD ステップ + コミット粒度 + 並列性を含み、Sonnet が順に実行可能な粒度になっている。
5. product.md のスコープ外（多通貨・税計算）に抵触しない。**在庫管理がスコープ外として明記**されている。
6. （任意）`spec-sync-check` skill で steering ↔ 新ドキュメントのドリフトが無いか確認。

> 注: 実装そのもの（page.tsx 作成・migrate 実行・テスト）は本プランのスコープ外。tasks.md が後続実装セッションの入力になる。
>

---

## アーキテクチャレビューによる追加の設計考慮事項（必須対応）

アーキテクチャレビューに基づき、設計ドキュメント（`requirements.md`, `design.md`, `tasks.md`）の作成において、以下の懸念・漏れに対する具体的な設計と対策を必ず記述すること。

### 1. クーポン関連のロジック不整合とすり抜け防止

- **`placeOrder` 時の platform-wide 割引適用**: `placeOrder` トランザクション（`src/queries/user.ts`）内の `check = storeId === cartCoupon?.storeId` が platform-wide 時（`storeId` が null の場合）に機能しない問題を解決する設計（全ストアグループへの適用と `couponId` 紐付け）を記述すること（判断4）。
- **`applyCoupon` 時の TypeError 回避**: `applyCoupon` の成功メッセージで `coupon.store.name` を参照している箇所の null セーフ対応と、割引対象アイテムのフィルタリングロジックの修正を記述すること（判断4）。
- **`isActive` 無効化のすり抜け防止**: `placeOrder` のトランザクション内で、適用中クーポンの `isActive === true` であることを再検証し、無効化されたクーポンでの注文確定を防ぐガードロジックを設計に含めること（判断6-1）。
- **クーポンコードの一意性衝突**: `Coupon.code` の `@unique` 制約によるストア間およびプラットフォーム全体間での名前衝突をどうハンドリングするか（P2002 バリデーション設計）を明記すること（判断4）。
- **Zod スキーマの条件付きバリデーション**: `CouponFormSchema` において、`scope` が `STORE` のときは `storeId` を必須とし、`PLATFORM` のときは `null` を許容する条件付き必須チェック設計を含めること（判断4）。

### 2. トランザクション整合性と状態管理

- **ステータス連動（親子ねじれの防止）**: 管理者が注文の支払い・配送ステータスを変更した際、親 `Order` と子 `OrderGroup` / `OrderItem` のステータスが不整合（ねじれ）を起こさないよう、状態遷移ルールと連動更新ロジックを設計すること（判断6-2）。
- **在庫減算・復元（今回スコープ外／仕様確定後に別タスク）**: 在庫管理（カートの DB 永続化・在庫予約・注文時減算・キャンセル/返品時の復元）は、**仕様が固まってから別途依頼として実装**する。本計画では実装せず、admin ステータス変更 action に将来の在庫連動フック位置（TODO コメント）を残すに留める。
- **決済プロバイダとの連携境界**: 管理画面からの手動ステータス変更（`Refunded` など）はDB上のステータス更新のみを行い、Stripe/PayPalとの自動返金連携はスコープ外であることを明記すること（判断4）。

### 3. パフォーマンスとスケーラビリティ

- **ダッシュボード集計のキャッシュ戦略**: `getAdminDashboardStats()` によるリアルタイム集計（全件カウント・Sum）がスケール時にDB負荷を高めるため、Next.js の `unstable_cache` 等を利用した短期キャッシュ（例: 15〜30分）の導入設計を必須とすること（判断5-1）。
- **論理削除データの統計上の扱い**: ストアの論理削除 (`isDeleted: true`) が発生した際、ストア数のカウントからは除外しつつ、過去の売上集計からは除外しないといった、整合性のある統計フィルタリング仕様を定義すること（判断6-3）。
- **API パラメータの DoS / OOM 対策**: `getAllOrders` 等のクエリで `limit` パラメータの上限キャップ（最大値制御、例: 最大100件）を設け、メモリ枯渇やレスポンス遅延を防ぐ設計を含めること（判断6-5）。

### 4. 認可とデータ同期

- **共通UI拡張時の認可チェックとIDOR防御**: `OrderStatusSelect` を admin アクションに対応させる際、フロントエンド境界での権限混同を防ぐ TypeScript の型安全設計（discriminated union）と、サーバー側 Server Actions での `requireAdmin()` による厳格な特権検査・操作ログ記録を定義すること（判断5-3）。
- **Clerk と DB のロール同期**: DB 内の `User.role` と Clerk 側の `privateMetadata.role` の二重管理における不整合を防ぐため、Clerk を SSOT とし、ロール変更時に Clerk API（`updateUserMetadata`）→ Webhook 経由で DB に伝播する設計を含めること（判断6-4）。

---

## スコープ外（明示）

- 実際のコード実装・Prisma マイグレーション実行・テスト実行（→ tasks.md に基づく後続作業）。
- **在庫管理全般（カートの DB 永続化・在庫予約・注文時の在庫減算・キャンセル/返品時の在庫復元）。ユーザー指示により仕様確定後に別タスクで実施。** カートは現状 Zustand + localStorage 永続化（Checkout 時のみ DB `Cart` へ同期、Clerk user.id 直結、ゲスト→ログインのマージ無し）であり、在庫管理設計時にこの前提を再評価する。
- seller 側既存 query のリファクタ（インライン認可の `requireAdmin` 化）。負債として温存。
- 多通貨・税計算エンジン（product.md でフェーズ外）。
