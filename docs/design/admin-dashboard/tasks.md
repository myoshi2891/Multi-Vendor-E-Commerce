# 管理者ダッシュボード 3 機能 — 実装タスク（tasks.md）

> [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) 準拠。各タスクを **Red → Green → Refactor** とコミット粒度に分解する。
> [ai-driven-development-guidelines Rule 6] に従い **並列可否** を明示する。
> 要件 ID は [requirements.md](./requirements.md)、設計詳細は [design.md](./design.md) を参照。

---

## 0. 実装前チェック（全フェーズ共通）

- [ ] 各 server action は [server-action-scaffold](../../../.claude/skills/server-action-scaffold/) skill で雛形生成（実装 + Zod + テストを一括）。
- [ ] 各 admin query は冒頭で [requireAdmin()](../../../src/lib/auth-guards.ts#L53) を呼ぶ（NFR-1・多層防御）。
- [ ] `src/queries/*.test.ts` に **AAA パターン**で正常系/異常系。特に **非 ADMIN 拒否**（`"Only admins can perform this action."`）の認可テストを必須。
- [ ] IDOR/認可テストは **3 階層パターン**（[SECURITY_GAP_REPORT.md §5.2](../../testing/SECURITY_GAP_REPORT.md)）: (a) スロー検証 / (b) where 構造検証 / (c) 副作用なし検証。
- [ ] DB 依存 `page.tsx` は `export const dynamic = 'force-dynamic';` を import 直後に宣言（NFR-4）。
- [ ] 新規コードに `any` 禁止（`unknown` + 型ガード）。`console.log` 禁止（構造化 `console.error` を使用）。
- [ ] **完了の定義**: [test-complete](../../../.claude/skills/test-complete/)（lint / tsc / test の 3 点）通過 + `bun run build` 成功。
- [ ] テスト数 / スイート数 / スナップショット数が変動したら [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) → `bun run coverage:dashboard`（同一コミットで同期）。

---

## フェーズ順（安全な変更を先・破壊的変更を最後に）

```
Phase 1: F2 注文管理          [高優先・スキーマ変更なし]   ← 最初に着手
Phase 2: F1 ダッシュボード統計 [F2 query を一部再利用]
Phase 3: F3-第1段 + isActive  [migrate dev・後方互換]
Phase 4: 下位互換性確保        [null セーフ化先行・スキーマ非変更]
Phase 5: F3-第2段 platform-wide [safe-migration・破壊的・決済波及] ← 最後に単独
```

**順序の根拠**: 優先度（F2=高）/ 依存（F1 は F2 の query パターンを再利用）/ 破壊性（Phase 5 は `storeId` nullable 化で決済フローに波及するため隔離）。

> **フェーズ間の依存**: Phase 1 → 2 は弱依存（並列着手も可だが query パターン共有のため 1 先行を推奨）。**Phase 3 → 4 → 5 は厳格な直列**（スキーマ変更と影響箇所改修の順序が安全性の核心）。

---

## Phase 1: F2 注文管理（高優先・スキーマ変更なし）

> 対応要件: F2-1〜F2-12。

### 1-A. admin 注文 query（`src/queries/order.ts` 追加）　【Agent A 担当】

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 1-A-1 Red | `getAllOrders` の異常系テスト（非 ADMIN 拒否）を先に書き **失敗を確認** | `test(order): add failing admin auth test for getAllOrders` |
| 1-A-2 Green | `getAllOrders`（`requireAdmin` + `AdminOrderFilterSchema` で limit≤100）実装 → Green | `feat(order): add getAllOrders admin query with limit cap` |
| 1-A-3 Green | `getOrderForAdmin`（userId フィルタ無し）実装 + テスト | `feat(order): add getOrderForAdmin (no userId filter)` |
| 1-A-4 Red→Green | `updateOrderGroupStatusAsAdmin`（`requireAdmin` + `$transaction` + 親子連動 `reconcileParentOrderStatus`）。**在庫連動は TODO コメントのみ** | `feat(order): add updateOrderGroupStatusAsAdmin with parent reconcile` |
| 1-A-5 Green | `updateOrderItemStatusAsAdmin`（`OrderItem.status`=`ProductStatus` 更新・配送/履行系）+ `updateOrderPaymentStatus`（`Order.paymentStatus` を DB のみ更新・決済 API 呼ばない）実装 + テスト。**「DB のみ変更・決済 API 非連携」警告は `updateOrderPaymentStatus` の操作 UI にのみ表示**（`updateOrderItemStatusAsAdmin` には付与せず、必要なら配送キャリア未連携の手動変更である旨のみ示す）（[design §3.3](./design.md#33-ui)・[§3.5 runbook](./design.md#35-決済ステータス手動変更運用手順runbook)・C-a） | `feat(order): add admin item/payment status updates` |
| 1-A-6 Refactor | 監査ログ（`[Admin:Action] actor=... target=... to=...`）を各 action に付与 | `refactor(order): add structured audit logs to admin actions` |

- **テスト必須観点**: 非 ADMIN 拒否（a/b/c 3 階層）、limit=500000 → 100 にキャップ（AC-F2-3）、親 Canceled → 子連動（AC-F2-5）、paymentStatus 変更で決済 API 未呼出（AC-F2-6・モック検証）。

### 1-B. 型定義（`src/lib/types.ts`）　【Agent A 担当・1-A-2 完了後】

- [ ] `AdminOrderType = Prisma.PromiseReturnType<typeof getAllOrders>["orders"][number]` を追加。
- コミット: `feat(types): add AdminOrderType for admin order table`

### 1-C. `OrderStatusSelect` discriminated union 化　【Agent B 担当・1-A と並列可】

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 1-C-1 | props を `{ mode:'seller'; storeId; groupId; status } \| { mode:'admin'; groupId; status }` に変更（[design §3.4](./design.md#34-orderstatusselect-の-discriminated-union-化判断5-3)） | `refactor(ui): make OrderStatusSelect props a discriminated union` |
| 1-C-2 | 既存 seller 呼び出し側（seller columns.tsx）に `mode:'seller'` を付与 | `refactor(ui): pass mode=seller from seller order columns` |

> **並列性**: 1-C は UI 改修、1-A は query。**互いに独立で並列実行可**。ただし 1-C-1 が `updateOrderGroupStatusAsAdmin`（1-A-4）を import するため、admin 呼び出しの結線は 1-A-4 完了後。型シグネチャだけ先に合意すれば UI 骨格は並列着手可。

### 1-D. F2 UI（`orders/page.tsx` + `columns.tsx`）　【Agent B 担当・1-A/1-B 完了後】

- [ ] `columns.tsx`: seller 版をベースに型を `AdminOrderType` に変更 + **Store 列追加**。`OrderStatusSelect` を `mode:'admin'` で使用。詳細モーダルは [StoreOrderSummary](../../../src/components/dashboard/shared/store-order-summary.tsx) 流用。
- [ ] `page.tsx`: `getAllOrders()` を DataTable へ。`searchParams` の URL 正規化 + limit キャップ。`force-dynamic`。
- コミット: `feat(admin): add cross-store order management page and columns`

> **付随タスク**: 売上集計対象列のインデックス確認（`Order.paymentStatus`・`createdAt`・`OrderGroup.storeId`）を Phase 2 と共有（判断5-1）。

---

## Phase 2: F1 ダッシュボード統計

> 対応要件: F1-1〜F1-9。Phase 1 の query パターンを再利用。

### 2-A. 統計 query（`src/queries/dashboard.ts` 新規）　【Agent A 担当】

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 2-A-1 Red | `getAdminDashboardStats` の非 ADMIN 拒否テスト → 失敗確認 | `test(dashboard): add failing admin auth test` |
| 2-A-2 Green | `getAdminDashboardStats`（`Promise.all` 並列集計・`unstable_cache` 20 分・`requireAdmin` はキャッシュ外）実装 | `feat(dashboard): add getAdminDashboardStats with cache` |
| 2-A-3 Green | 統計境界テスト: Paid のみ集計（AC-F1-2）/ 論理削除ストア除外（AC-F1-4）/ 売上は算入（AC-F1-5） | `test(dashboard): cover revenue and store-count scopes` |
| 2-A-4 Green | `getSalesOverTime` / `getRecentOrders` / `getRecentStores` 実装 + テスト | `feat(dashboard): add sales-over-time and recent lists` |

- **テスト必須観点**: `paymentStatus=Paid` 以外を除外、`PartiallyRefunded` 全額除外（C-e）、`isDeleted:false` の店舗カウント、キャッシュヒット（AC-F1-6）。
- **確認済み**: `enum StoreStatus`（[schema.prisma:73-78](../../../prisma/schema.prisma#L73)）= `PENDING`/`ACTIVE`/`BANNED`/`DISABLED`。KPI は `ACTIVE`/`PENDING` を使用（`INACTIVE` は存在しない）。

### 2-B. F1 UI（`admin/page.tsx` 置換 + `components/dashboard/admin/*`）　【Agent B 担当・2-A 完了後】

- [ ] KPI カード群（shadcn Card）+ 売上チャート（`@tremor/react` AreaChart・**依存追加なし**）+ 最近の注文/ストアリスト。
- [ ] プレースホルダー `page.tsx`（`<div>Admin DashboardPage</div>`）を置換。`force-dynamic`。金額は `toNumberSafe()` 経由。
- コミット: `feat(admin): replace dashboard placeholder with stats UI`

> **並列性**: 2-A（query）と 2-B（UI 骨格）は型合意後に並列着手可。データ結線は 2-A 完了後。

---

## Phase 3: F3-第1段 クーポン横断管理 + isActive 列追加

> 対応要件: F3-1〜F3-6。**`migrate dev`（後方互換・非破壊）**。

### 3-A. スキーマ第1段（`isActive` 追加）　【直列・最初に実施】

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 3-A-1 | `prisma/schema.prisma` の `Coupon` に `isActive Boolean @default(true)` 追加 | — |
| 3-A-2 | `bunx prisma migrate dev`（履歴化）→ `bunx prisma generate` | — |
| 3-A-3 | `bun run erd:generate` で ER 図再生成（[03-data-model-diagram-sync.md](../../../.claude/rules/03-data-model-diagram-sync.md)） | `feat(db): add Coupon.isActive and regenerate ER diagram` |

> **コミット同梱**: schema 変更 + マイグレーション + `data-model.drawio` 再生成を **同一コミット**（rule 03 準拠）。

### 3-B. isActive 再検証（判断6-1）　【3-A 完了後・直列】

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 3-B-1 Red | `placeOrder` で `isActive=false` クーポン → 注文確定が弾かれるテスト（失敗確認） | `test(user): add failing isActive guard test for placeOrder` |
| 3-B-2 Green | `placeOrder` / `applyCoupon` に `coupon.isActive === true` 再検証を追加（F3-6） | `feat(coupon): re-validate isActive on order placement` |

### 3-C. admin クーポン query（`src/queries/coupon.ts` 追加）　【Agent A 担当・3-A 完了後】

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 3-C-1 Red→Green | `getAllCoupons`（`requireAdmin` + limit≤100 + include store）+ 認可テスト | `feat(coupon): add getAllCoupons admin query` |
| 3-C-2 Green | `upsertCouponAsAdmin`（**P2002 捕捉**で「このクーポンコードは既に使用されています」・F3-5） | `feat(coupon): add upsertCouponAsAdmin with P2002 handling` |
| 3-C-3 Green | `deleteCouponAsAdmin` + `toggleCouponActive` 実装 + テスト | `feat(coupon): add admin delete and active toggle` |

- **テスト必須観点**: 非 ADMIN 拒否、code 重複 → P2002 → 日本語メッセージ（AC-F3-2）、`isActive` トグル反映。

### 3-D. Zod スキーマ（`src/lib/schemas.ts`）　【Agent A 担当・3-C と並列可】

- [ ] `AdminCouponFormSchema`（`isActive` 追加。`scope`/`storeId` は定義のみ・第1段は既定 STORE）。コミット: `feat(schemas): add AdminCouponFormSchema`

### 3-E. F3 UI（`coupons/{page,columns}.tsx` + `new/page.tsx` + `admin-coupon-details.tsx`）　【Agent B 担当・3-C/3-D 完了後】

- [ ] `columns.tsx`: seller 版 + **Store 列 + Active バッジ** + `toggleCouponActive` トグル。
- [ ] `admin-coupon-details.tsx`: [coupon-details.tsx](../../../src/components/dashboard/forms/coupon-details.tsx) から派生 + store 選択 + active トグル（scope は第1段では非表示可）。
- [ ] `page.tsx` / `new/page.tsx`: DataTable + 作成ページ。`force-dynamic`。
- コミット: `feat(admin): add coupon management page, columns, and admin form`

---

## Phase 4: 下位互換性確保ステップ（判断5-5・NFR-9）

> **Phase 5 の破壊的スキーマ変更の前に、コードを先行して null セーフ化**。スキーマは非nullのまま。

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 4-1 | `applyCoupon`（[coupon.ts:289](../../../src/queries/coupon.ts#L289)）の `coupon.store.name` を `coupon.store?.name ?? '全店舗'` 等へ先行防御 | `refactor(coupon): null-safe coupon.store access (pre-migration)` |
| 4-2 | `saveUserCart`（[user.ts:1135-1150](../../../src/queries/user.ts#L1135-L1150)）の返却整形で `cart.coupon.store` を null ガード | `refactor(user): null-safe coupon.store in cart serialization` |
| 4-3 | `getStoreCoupons` / クーポン UI（columns・coupon-details）の `coupon.store`/`storeId` 非null前提箇所を防御 | `refactor(coupon): null-safe coupon.store in UI` |
| 4-4 検証 | `bunx tsc --noEmit` + 既存テスト緑を確認（**スキーマ未変更でも壊れないこと**） | — |

> **原則**: コード防御を先・スキーマ変更を後にして退行を吸収する。この段階では機能追加せず、**振る舞いを変えない安全な防御のみ**。

---

## Phase 5: F3-第2段 platform-wide 発行（破壊的・決済波及）

> 対応要件: F3-7〜F3-11。**[safe-migration skill](../../../.claude/skills/safe-migration/) 必須。最後に単独で実施。** 厳格な直列。

### 5-A. スキーマ第2段（`safe-migration`）

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 5-A-1 | `safe-migration` skill で承認取得 → `enum CouponScope { STORE PLATFORM }` 追加 + `Coupon.scope`（default STORE）+ `storeId: String → String?` + `store: Store?` | — |
| 5-A-2 | `bunx prisma migrate dev`（ローカル）/ 本番は `migrate deploy`。`bunx prisma generate` | — |
| 5-A-3 | `bun run erd:generate` で ER 図再生成 | `feat(db): add CouponScope and nullable storeId, regenerate ERD` |

### 5-B. 影響箇所 3 改修 + 回帰テスト（[design §判断4 マトリクス](./design.md#判断4の影響箇所マトリクス3箇所)）

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 5-B-1 Red | `placeOrder` の PLATFORM クーポンで **全 OrderGroup に割引適用 + Order.total = カート total** を検証するテスト（失敗確認） | `test(user): add failing platform coupon test for placeOrder` |
| 5-B-2 Green | **#2** `placeOrder`（[user.ts:642-665](../../../src/queries/user.ts#L642-L665)）: `check = scope==='PLATFORM' \|\| storeId===cartCoupon?.storeId`、全グループ couponId 紐付け、**端数を最終グループで吸収**（判断5-4） | `feat(coupon): apply platform-wide discount across all order groups` |
| 5-B-3 Green | **#1** `applyCoupon`（[coupon.ts:240-289](../../../src/queries/coupon.ts#L240-L289)）: PLATFORM は全 cartItems 対象 + メッセージ汎用化 + **Number 演算を Prisma.Decimal 化**（判断5-4・既存精度バグ修正兼） | `feat(coupon): support platform scope in applyCoupon with Decimal math` |
| 5-B-4 Green | **#3** `saveUserCart`（[user.ts:1082](../../../src/queries/user.ts#L1082)）: PLATFORM は全 item 対象（store null ガードは Phase 4 で済） | `feat(coupon): support platform scope in cart recalculation` |
| 5-B-5 Green | Zod `AdminCouponFormSchema` の `superRefine` を有効化（STORE→storeId 必須 / PLATFORM→null・F3-10）+ UI の scope ドロップダウン連動 | `feat(coupon): enable scope-based conditional validation` |
| 5-B-6 Refactor | seller `upsertCoupon`（[coupon.ts:43-51](../../../src/queries/coupon.ts#L43-L51)）にも P2002 ハンドリング追加（他店舗/platform コード衝突対策）。**メッセージは admin と同一の日本語「このクーポンコードは既に使用されています」へ統一**。`findFirst` 事前チェックは楽観的 UX 用に残すが、TOCTOU レースの**最終防御は P2002 捕捉**（DB `code @unique` が一意性 SSOT・[design.md](./design.md) §4.1 補足） | `refactor(coupon): add P2002 handling to seller upsertCoupon` |

- **回帰テスト必須観点**:
  - PLATFORM クーポンで全 OrderGroup に割引適用・`Order.total` がカート total と一致（AC-F3-5）。
  - 端数（数セント）が最終 OrderGroup で吸収される（判断5-4）。
  - `storeId=null` で TypeError が出ない（#1/#3）。
  - **STORE クーポンの意図する割引額は Decimal 基準で正当化される**（従来の Number 出力とは端数ケースで**最大 1 セント差**が出うる）。`applyCoupon` の Number→`Prisma.Decimal` 化（上記 **5-B-3**）は**既存の浮動小数点丸めバグの修正を兼ねる**ため、この差分は「退行」ではなく「バグ修正（挙動改善）」として扱う（リリースノート相当の挙動変化として記録）。`applyCoupon` が**唯一の権威ある計算面**であり、差分検証はここで行う。
    - **アサート戦略**: 5-B-3 後の `applyCoupon` は割引額・新 total を `Prisma.Decimal` で算出し、Decimal 値として永続化する（現状の `item.price.toNumber()` / `cart.total.toNumber()` による Number 演算を置換）。テストはこの `Prisma.Decimal` 結果に対する**厳密一致（strict Decimal equality）**を既定とし、比較は **`Decimal.equals()`**、または正準表現 **`Decimal.toString()` の文字列一致**で行う（`toBeCloseTo` は使わない）。丸め差を許容してよいのは**表示・シリアライズ系テストに限り**、その場合のみ数値許容差 `Math.abs(actual - expected) < 0.01`（必要なら `toBeCloseTo`）を使用し、許容する理由をテストコメントに明記する。
    - **BEFORE/AFTER ベクトル例**（5-B-3 のテストコメントに記録し再現可能にする）:
      - `storeTotal=10.00, discount=33%` → Number 期待 `3.3` / Decimal 期待 `3.30`（差分なし）。
      - `storeTotal=9.99, discount=15%` → Number era `1.4985`（`toFixed(2)`→`1.50`）/ `Prisma.Decimal`（`mul`→`ROUND_HALF_UP`）`1.50`。端数の中間値（例 `0.005` 境界）で最大 1 セント差が生じうるケースを最低 1 件含める。
  - **計算面ではない箇所は回帰パリティ対象外**: `src/queries/user.ts` の `.toNumber()`（`subTotal`/`shippingFees`/`total`/`item.price`）は **シリアライズ/表示整形**であり計算ロジックではない。これらは表示チェックに限定し、Decimal 化の差分検証対象に含めない。

### 5-C. E2E 検証

- [ ] [tests/e2e/](../../../tests/e2e/) で購入フロー全体を検証（PLATFORM クーポン適用 → チェックアウト → 注文確定 → total 整合）。Chromium / Firefox / WebKit。
- コミット: `test(e2e): verify platform-wide coupon end-to-end purchase flow`

---

## 並列性サマリー（Agent Manager 向け）

| フェーズ | Agent A（query/型/schema） | Agent B（UI） | 並列可否 |
| --- | --- | --- | --- |
| Phase 1 | 1-A query, 1-B 型 | 1-C union 化, 1-D UI | **型シグネチャ合意後に並列可**。結線は A 先行 |
| Phase 2 | 2-A 統計 query | 2-B KPI/チャート UI | **型合意後に並列可** |
| Phase 3 | 3-A schema → 3-C query, 3-D Zod | 3-E UI | 3-A は直列先頭。query/UI は型合意後並列 |
| Phase 4 | 4-1〜4-4 防御（直列） | — | **直列**（安全防御の順序が核心） |
| Phase 5 | 5-A schema → 5-B 改修 → 5-C E2E | 5-B-5 UI 連動 | **厳格な直列**（破壊的・決済波及） |

> **直列が必須の箇所**: 3-A（schema）→ 3-B（isActive 検証）、Phase 4 全体、Phase 5 の 5-A → 5-B → 5-C。スキーマ変更と影響箇所改修の順序が安全性の核心であり、並列化してはならない。

---

## レビュー必須ポイント（ai-driven Rule 3）

> 実装着手前に、本 tasks.md を **ユーザー/レビュアーと確認**すること。特に以下は設計判断のレビュー対象:

- [ ] Phase 3 で `isActive` を入れるか、第2段にまとめるか（[design §5.2 代替案](./design.md#52-スキーマ変更第2段platform-wide)）。
- [ ] platform-wide クーポンの按分アルゴリズム（端数の最終グループ吸収）が会計要件と合致するか。
- [ ] `paymentStatus` 手動変更が DB のみ（決済 API 非連携・C-a）で運用上問題ないか。
- [ ] 在庫管理スコープ外の前提（TODO フックのみ）が後続タスクへ正しく引き継がれるか。
