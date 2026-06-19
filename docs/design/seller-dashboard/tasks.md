# 販売者ダッシュボード 2 機能 — 実装タスク（tasks.md）

> [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) **準拠（マスト）**。各タスクを **Red → Green → Refactor** とコミット粒度に分解する。
> 要件 ID は [requirements.md](./requirements.md)、設計詳細は [design.md](./design.md) を参照。
> **スキルの呼び出し漏れを防ぐため**、各 Step に「いつ・どのスキルを起動するか」を明記する（[§スキル起動マップ](#スキル起動マップ呼び出し漏れ防止)）。

---

## 0. 実装前チェック（全フェーズ共通）

- [ ] **着手前に [feature-plan](../../../.claude/skills/feature-plan/) skill** で本設計群（requirements/design）を読み込み、実装計画をユーザー確認する（コード記述前・[ai-driven Rule 3]）。
- [ ] 各 server action は [server-action-scaffold](../../../.claude/skills/server-action-scaffold/) skill で雛形生成（実装 + Zod + テストを一括）。
- [ ] 各 seller query は冒頭で [requireStoreOwner(storeUrl)](../../../src/lib/auth-guards.ts#L87) を呼ぶ（NFR-1・多層防御）。**認可ガードは `try/catch` の外**（[tech.md](../../../.claude/steering/tech.md)）。
- [ ] テストが必要な箇所では [test-gen](../../../.claude/skills/test-gen/) skill を起動する（Red ステップ・カバレッジ補完）。`src/queries/*.test.ts` に **AAA パターン**で正常系/異常系。特に **非 SELLER 拒否**（`"Only sellers can perform this action."`）・**非所有拒否**（`"Forbidden: store not owned by current user."`）の認可テストを必須。
- [ ] **IDOR/認可テストは 3 階層パターン**（[SECURITY_GAP_REPORT.md §5.2](../../testing/SECURITY_GAP_REPORT.md)）: (a) スロー検証 / (b) where 構造検証 / (c) 副作用なし検証。特に `updateSizeStock` の所有権チェーン（[判断4](./design.md#判断4-在庫クイック編集-updatesizestock)）。
- [ ] DB 依存 `page.tsx` は `export const dynamic = 'force-dynamic';` を import 直後に宣言（NFR-4）。
- [ ] 新規コードに `any` 禁止（`unknown` + 型ガード）。`console.log` 禁止（構造化 `console.error` 2 引数形式・NFR-7）。
- [ ] 金額は `Prisma.Decimal` で集計し、`.toNumber()` は return 境界のみ（NFR-3）。
- [ ] **完了の定義**: 各コミット前に [test-complete](../../../.claude/skills/test-complete/) skill（lint / tsc / test の 3 点）通過 + `bun run build` 成功。
- [ ] テスト数 / スイート数 / スナップショット数が変動したら [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) skill → `bun run coverage:dashboard`（**同一コミットで同期**・QA_HANDOFF.md SSOT）。

---

## スキル起動マップ（呼び出し漏れ防止）

> 「どの作業で・どのスキルを必ず呼ぶか」の早見表。各 Step の説明と対応する。

| 作業 | 起動スキル | タイミング |
| --- | --- | --- |
| 設計の読み込み・計画 | [feature-plan](../../../.claude/skills/feature-plan/) | 全 Phase 着手前（1 回） |
| 新規 server action 作成 | [server-action-scaffold](../../../.claude/skills/server-action-scaffold/) | `updateSizeStock` / `updateStoreLowStockThreshold` / `getStoreInventory` / `getStoreDashboardStats` 等の新規 query 着手時 |
| テスト追加・補完 | [test-gen](../../../.claude/skills/test-gen/) | 各 **Red** ステップ・カバレッジ不足の補完時 |
| コミット前の品質確認 | [test-complete](../../../.claude/skills/test-complete/) | **各コミット前**（lint/tsc/test + build） |
| テスト統計の同期 | [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) | Tests 数/スイート数/スナップショット数が変動した直後（同一コミット） |
| スキーマ変更 | [safe-migration](../../../.claude/skills/safe-migration/) | Phase 1（`lowStockThreshold` 追加）・Phase 4（在庫減算の影響評価） |
| ER 図再生成 | [.claude/rules/03-data-model-diagram-sync.md](../../../.claude/rules/03-data-model-diagram-sync.md) `bun run erd:generate` | スキーマ変更と同一コミット |

---

## フェーズ順（安全な変更を先・在庫減算を最後に）

```
Phase 1: スキーマ追加 lowStockThreshold  [additive・後方互換]   ← 最初に実施
Phase 2: F2 在庫管理（高優先）            [read query + クイック編集 + しきい値設定 + バッジ UI]
Phase 3: F1 店舗ダッシュボード統計（中優先）[dashboard.ts を店舗スコープへ一般化]
Phase 4: F3 placeOrder 在庫減算          [チェックアウト波及・最後に隔離]  ← 回帰 + E2E
```

**順序の根拠**: しきい値スキーマは additive（default 付き）で後方互換 → 早期（Phase 1）。在庫は **高優先**（Phase 2）→ ダッシュボード中優先（Phase 3）。在庫減算は `placeOrder` 波及の最大リスク → 単独で最後（Phase 4）。

> **フェーズ間の依存**: Phase 1 → 2 は直列（バッジ判定が `lowStockThreshold` に依存）。Phase 2 → 3 は弱依存（query パターン共有のため 2 先行推奨だが型合意後は並列着手可）。**Phase 4 は厳格に最後**。

---

## Phase 1: スキーマ追加 `lowStockThreshold`（additive・後方互換）

> 対応: スキーマ拡張・NFR-9。**[safe-migration](../../../.claude/skills/safe-migration/) skill 必須。** additive のため非破壊。

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 1-1 | [safe-migration](../../../.claude/skills/safe-migration/) skill 起動 → `Store` に `lowStockThreshold Int @default(5)` 追加（[design §5.1](./design.md#51-スキーマ変更-storelowstockthreshold)） | — |
| 1-2 | `bunx prisma migrate dev`（履歴化）→ `bunx prisma generate` | — |
| 1-3 | `bun run erd:generate` で ER 図再生成（[rule 03](../../../.claude/rules/03-data-model-diagram-sync.md)） | `feat(db): add Store.lowStockThreshold and regenerate ER diagram` |

> **コミット同梱**: `schema.prisma` 変更 + マイグレーション + `data-model.drawio` 再生成を **同一コミット**（rule 03 準拠）。additive のため既存テストは不変（変動があれば [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/)）。

---

## Phase 2: F2 在庫管理（高優先）

> 対応要件: F2-1〜F2-8。

### 2-A. 在庫 query（`src/queries/inventory.ts` 新規）　【Agent A 担当】

> 着手時に [server-action-scaffold](../../../.claude/skills/server-action-scaffold/) skill で雛形生成。各 Red で [test-gen](../../../.claude/skills/test-gen/)。

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 2-A-1 Red | `updateSizeStock` の **非 SELLER 拒否 + 非所有拒否 + IDOR（所有権チェーン）** テストを先に書き **失敗を確認**（[test-gen](../../../.claude/skills/test-gen/) で 3 階層パターン生成） | `test(inventory): add failing auth/IDOR tests for updateSizeStock` |
| 2-A-2 Green | `getStoreInventory`（`requireStoreOwner` + product→variant→size フラット化）実装 + 正常系テスト | `feat(inventory): add getStoreInventory store-scoped query` |
| 2-A-3 Green | `updateSizeStock`（`requireStoreOwner` + 所有権チェーン `findFirst` + `UpdateSizeStockSchema`）実装 → 2-A-1 を Green 化 | `feat(inventory): add updateSizeStock with ownership-chain IDOR guard` |
| 2-A-4 Green | `updateStoreLowStockThreshold`（`LowStockThresholdSchema`）実装 + テスト（Phase 1 完了が前提） | `feat(inventory): add updateStoreLowStockThreshold` |
| 2-A-5 Refactor | 構造化ログ（`[Inventory:Function]` + `{ error, stack }`）整備・`getStockStatus` 純粋関数を `utils` へ抽出 + 単体テスト | `refactor(inventory): structured logs and extract getStockStatus` |

- **テスト必須観点**: 非 SELLER 拒否（`"Only sellers can perform this action."`）/ 非所有拒否（`"Forbidden: store not owned by current user."`）/ **IDOR 3 階層**（他店舗 `sizeId` → スロー / `findFirst` の `productVariant.product.storeId` where 構造 / `db.size.update` 不実行・AC-F2-4）/ `quantity=-1` で Zod 弾き（AC-F2-3）/ `getStockStatus` の境界（0→out, threshold→low, threshold+1→ok・AC-F2-5）。

### 2-B. 型定義（`src/lib/types.ts`）　【Agent A 担当・2-A-2 完了後】

- [ ] `StoreInventoryRow = Prisma.PromiseReturnType<typeof getStoreInventory>[number]` を追加（[design §6](./design.md#6-型定義srclibtypests-に追加)）。
- コミット: `feat(types): add StoreInventoryRow type`

### 2-C. F2 UI（`inventory/{page,columns}.tsx` + `components/dashboard/seller/*`）　【Agent B 担当・2-A/2-B 完了後】

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 2-C-1 | `stock-status-badge.tsx`（`getStockStatus` 表示）+ コンポーネントテスト（[test-gen](../../../.claude/skills/test-gen/) RTL） | `feat(seller): add stock status badge with tests` |
| 2-C-2 | `inventory-quantity-cell.tsx`（インライン編集・リエントランシーガード・`updateSizeStock`→toast→`router.refresh()`・[design §2.4](./design.md#24-ui-コンポーネント)） | `feat(seller): add inventory quantity inline-edit cell` |
| 2-C-3 | `low-stock-threshold-form.tsx` + `inventory-alert-summary.tsx` | `feat(seller): add low-stock threshold form and alert summary` |
| 2-C-4 | `inventory/columns.tsx` + `inventory/page.tsx`（DataTable + サマリー + しきい値フォーム・`force-dynamic`） | `feat(seller): add inventory page and columns` |

> **並列性**: 2-A（query）と 2-C（UI 骨格）は型合意後に並列着手可。データ結線は 2-A 完了後。

---

## Phase 3: F1 店舗ダッシュボード統計（中優先）

> 対応要件: F1-1〜F1-9。Phase 2 の query パターンを再利用。

### 3-A. 統計 query（`src/queries/store-dashboard.ts` 新規）　【Agent A 担当】

> 着手時に [server-action-scaffold](../../../.claude/skills/server-action-scaffold/) skill。各 Red で [test-gen](../../../.claude/skills/test-gen/)。

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 3-A-1 Red | `getStoreDashboardStats` の **非 SELLER / 非所有拒否** テスト → 失敗確認 | `test(store-dashboard): add failing auth tests` |
| 3-A-2 Green | `getStoreDashboardStats`（`Promise.all` 並列集計・`unstable_cache` 20 分・**キャッシュキーに storeId**・`requireStoreOwner` はキャッシュ外）実装（[design §3.1](./design.md#31-新規-querysrcqueriesstore-dashboardts)） | `feat(store-dashboard): add getStoreDashboardStats with store-scoped cache` |
| 3-A-3 Green | 集計境界テスト: 売上は `OrderGroup.total` × 親 `Order.paymentStatus=Paid` のみ（AC-F1-3）/ PV は Σ`Product.views`（AC-F1-4）/ ゼロ件で `0`（AC-F1-5）/ **storeId 別キャッシュ混線なし**（AC-F1-7） | `test(store-dashboard): cover revenue join and store-scoped cache` |
| 3-A-4 Green | `getStoreSalesOverTime` / `getStoreRecentOrders` / `getStoreTopProducts` 実装 + テスト | `feat(store-dashboard): add sales-over-time, recent orders, top products` |

- **テスト必須観点**: 売上 join（親 Order が Paid のみ算入）・PV/sales 合算・ゼロ件描画・キャッシュキーに `storeId` 含有（店舗間混線なし）。

### 3-B. F1 UI（`[storeUrl]/page.tsx` 置換 + `components/dashboard/seller/*`）　【Agent B 担当・3-A 完了後】

- [ ] `store-stats-cards.tsx`（KPI カード・[admin/stats-cards.tsx](../../../src/components/dashboard/admin/stats-cards.tsx) 派生）+ `store-recent-orders.tsx` + `store-top-products.tsx`。売上チャートは [admin/sales-chart.tsx](../../../src/components/dashboard/admin/sales-chart.tsx) を **そのまま import**（依存追加なし）。
- [ ] プレースホルダー `page.tsx`（`<div>SellerStorePage</div>`）を `Promise.all([...])` で置換。`force-dynamic`。金額は `toNumberSafe()`/`.toNumber()` 済みの値を表示。
- [ ] ゼロ件エッジケースのコンポーネントテスト（AC-F1-5）。
- コミット: `feat(seller): replace store dashboard placeholder with stats UI`

> **並列性**: 3-A（query）と 3-B（UI 骨格）は型合意後に並列着手可。

---

## Phase 4: F3 placeOrder 在庫減算（チェックアウト波及・最後に隔離）

> 対応要件: F3-1〜F3-5。**厳格に最後。回帰 + E2E 必須。** [safe-migration](../../../.claude/skills/safe-migration/) はスキーマ変更を伴わないが、`placeOrder` は決済フローの中核のため**影響評価を慎重に**行う。

### 4-A. 在庫減算ロジック（`src/queries/user.ts` の `placeOrder` 改修）　【直列】

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 4-A-1 Red | 在庫不足で注文がロールバックされるテスト（`updateMany` モックが `count:0` → `Order`/`OrderGroup`/`OrderItem` 未作成）を書き **失敗確認**（[test-gen](../../../.claude/skills/test-gen/)） | `test(user): add failing insufficient-stock rollback test for placeOrder` |
| 4-A-2 Green | OrderItem 作成ループ（[user.ts:696](../../../src/queries/user.ts#L696)）内に条件付き `tx.size.updateMany`（`quantity:{ gte }` + `decrement`）を追加。`count===0` → `throw "在庫が不足しています"`（[design §5.2](./design.md#52-placeorder-在庫減算の影響箇所マトリクス)） | `feat(user): decrement Size.quantity atomically on placeOrder` |
| 4-A-3 Green | 在庫十分時の減算成功テスト（`quantity 10` − `3` = `7`・AC-F3-1）+ レース構造検証（`updateMany` が `gte` 条件付き・AC-F3-3） | `test(user): cover stock decrement success and race-safe update` |
| 4-A-4 Refactor | 在庫減算ヘルパー抽出（任意）・構造化ログ補強。既存の数量クランプ（[user.ts:494](../../../src/queries/user.ts#L494)）との整合コメント | `refactor(user): extract stock decrement helper` |

- **テスト必須観点**: (a) 減算成功（AC-F3-1）、(b) 不足で **全テーブル未作成のロールバック**（`$transaction` モック・AC-F3-2）、(c) `updateMany` が `quantity:{ gte: qty }` 条件付き（AC-F3-3）。

### 4-B. E2E 検証　【4-A 完了後】

- [ ] [tests/e2e/](../../../tests/e2e/) で購入フロー全体を検証（在庫のある商品 → カート → チェックアウト → 注文確定 → `Size.quantity` が注文数分減る・AC-F3-4）。Chromium / Firefox / WebKit。
- コミット: `test(e2e): verify stock decrement on end-to-end purchase flow`

### 4-C. ドキュメント同期　【テスト統計変動時】

- [ ] [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) skill → `bun run coverage:dashboard`。QA_HANDOFF.md(SSOT)/COVERAGE_REPORT.md/PROGRESS.md/07-testing.md を同一コミットで同期。
- コミット: `docs: sync spec and coverage after seller dashboard tests`

### 4-D. キャンセル/返品時の在庫復元（任意・レビュー対象・recommended ON）

> 採用は [レビュー必須ポイント](#レビュー必須ポイント) で確認。整合性の対だが注文ステータス変更フローへ波及するため任意サブステップ。

| Step | 内容 | コミット例 |
| --- | --- | --- |
| 4-D-1 Red | `Canceled`/`Refunded` 遷移で `Size.quantity` が復元されるテスト + **二重復元しない**冪等性テスト → 失敗確認 | `test(order): add failing restock-on-cancel idempotency test` |
| 4-D-2 Green | 注文ステータス変更 action の `$transaction` 内に `increment` 復元 + 遷移ガード（[design §5.3](./design.md#53-キャンセル返品時の在庫復元レビュー対象)） | `feat(order): restock Size.quantity on cancel/refund with idempotency guard` |

---

## 並列性サマリー（Agent Manager 向け）

| フェーズ | Agent A（query/型/schema） | Agent B（UI） | 並列可否 |
| --- | --- | --- | --- |
| Phase 1 | 1-1〜1-3 schema（直列） | — | **直列**（schema が後続の前提） |
| Phase 2 | 2-A query, 2-B 型 | 2-C UI | 型シグネチャ合意後に並列可。結線は A 先行 |
| Phase 3 | 3-A 統計 query | 3-B KPI/チャート UI | 型合意後に並列可 |
| Phase 4 | 4-A 在庫減算 → 4-B E2E → 4-C docs → 4-D 復元 | — | **厳格な直列**（チェックアウト波及） |

> **直列が必須の箇所**: Phase 1 全体、Phase 4 全体。スキーマ変更とチェックアウトフロー改修の順序が安全性の核心であり、並列化してはならない。

---

## レビュー必須ポイント

> [ai-driven Rule 3] 準拠。実装着手前に、本 tasks.md を **ユーザー/レビュアーと確認**すること。特に以下は設計判断のレビュー対象:

- [ ] **4-D（在庫復元）を今回実施するか**（recommended ON だが任意）。実施しない場合、キャンセル/返品で在庫が戻らないギャップが残ることを許容するか。
- [ ] 在庫不足時に **注文全体をロールバック**（部分確定なし）でよいか（AC-F3-2）。
- [ ] しきい値を **店舗単位の単一値**（`Store.lowStockThreshold`）に留め、サイズ別 override をスコープ外とする方針でよいか（C-b）。
- [ ] PV(閲覧数)は **既存 `Product.views` の合算表示のみ**（収集経路は改修しない）でよいか（C-c）。
- [ ] 在庫アラートは **視覚バッジのみ**（メール/アプリ内通知なし）でよいか（C-a）。
