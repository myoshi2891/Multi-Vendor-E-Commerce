# 販売者ダッシュボード 2 機能 — 実装トラッカー（PROGRESS.md）

> [tasks.md](./tasks.md) のフェーズ実行状況を記録する。実装セッションは各 Step 完了ごとに本ファイルを更新する。
> 統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。テスト数が動いたら [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) で同期する。

## 🧭 現在地

- **2026-06-19 時点**: **全フェーズ完了** — Phase 1 / Phase 2（F2 在庫管理）/ Phase 3（F1 店舗ダッシュボード）/ **Phase 4（F3 在庫減算 + F3-5 在庫復元）完了**。🎉
- 残り: なし（4-D 在庫復元はユーザー承認のもと実施済み）。
- 検証: tsc 0 / lint 0 errors / test 1496 → **1505 passed**（154 スイート不変・`user.test.ts` +3 / `order.test.ts` +6）/ E2E `stock-decrement.spec.ts` 新規（3 ブラウザ）。

---

## Phase 1: スキーマ追加 `lowStockThreshold`

| Step | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 1-1 | `safe-migration` で `Store.lowStockThreshold Int @default(5)` 追加 | ✅ 完了 | `dbf7127` |
| 1-2 | `migrate dev` + `generate` | ✅ 完了 | `dbf7127` |
| 1-3 | `erd:generate` 再生成 | ✅ 完了 | `dbf7127` |

> **検証**: tsc 0 / lint 0 / test 変動なし（additive） / build 成功。

## Phase 2: F2 在庫管理（高優先）

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 2-A | 在庫 query（`inventory.ts`）+ IDOR 3 階層テスト | ✅ 完了 | `807e5c0`–`a9ad821`（query 3 種 + `getStockStatus` 抽出、`inventory.test.ts` +22 / `utils.test.ts` +6） |
| 2-B | 型定義（`StoreInventoryRow`） | ✅ 完了 | `2dd35b5`（`Prisma.PromiseReturnType` で `types.ts` に導出） |
| 2-C | F2 UI（page/columns + seller コンポーネント群） | ✅ 完了 | `3e2e175`–`b3ba8c9`（badge +3 / columns +5、`page.tsx` + `getInventoryColumns` ファクトリ + seller コンポーネント 4 本） |

> **検証**: 2-C 完了時点で tsc 0 / lint 0 errors / test 1435 → **1443 passed**（147 スイート）/ build 成功 / `/dashboard/seller/stores/[storeUrl]/inventory` = Dynamic（ƒ）。

## Phase 3: F1 店舗ダッシュボード統計（中優先）

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 3-A | 統計 query（`store-dashboard.ts`）+ キャッシュ分離テスト | ✅ 完了 | `f2cd8f1`（query 4 種 + `StoreRecentOrderType`/`StoreTopProductType` 導出、`store-dashboard.test.ts` +39。売上 join / null→0 / storeId 別キャッシュキー / 認可 3 階層） |
| 3-B | F1 UI（page 置換 + KPI/チャート/最近リスト） | ✅ 完了 | `4301c85`–`07bc12e`（`store-stats-cards`/`store-recent-orders`/`store-top-products` 新規 + RTL +6、`page.tsx` を `Promise.all` 4 query + `SalesChart` 再利用へ置換・`force-dynamic`） |

> **検証**: tsc 0 / lint 0 errors / test 1490 → **1496 passed**（151 → 154 スイート）/ build 成功（`/[storeUrl]` = Dynamic ƒ）。

## Phase 4: F3 placeOrder 在庫減算（最後に隔離）

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 4-A | `placeOrder` アトミック減算 + 不足ガード + 回帰テスト | ✅ 完了 | `8cbf4c0`–`037c8ff`（条件付き `tx.size.updateMany`・`count===0` で throw → ロールバック、`user.test.ts` +3） |
| 4-B | E2E（購入フロー → 在庫減少） | ✅ 完了 | `1a66ed2`（`tests/e2e/stock-decrement.spec.ts`・認証付きで在庫 before/after 検証・AC-F3-4） |
| 4-C | `spec-sync-after-test` で docs 同期 | ✅ 完了 | 本コミット |
| 4-D | キャンセル/返品時の在庫復元（ユーザー承認のもと実施） | ✅ 完了 | `b3badc6`–`eca47a6`（admin cancel/refund に `increment` 復元 + 非終端→終端の遷移ガードで冪等化、`order.test.ts` +6） |

> **検証**（完了時に記入）: tsc 0 / lint 0 / test +N / E2E 3 ブラウザ green / build 成功。

---

## レビュー必須ポイント（実装着手前に確認）

[tasks.md レビュー必須ポイント](./tasks.md#レビュー必須ポイント) を参照。要約:

- [ ] 4-D（在庫復元）を今回実施するか。
- [ ] 在庫不足時に注文全体ロールバック（部分確定なし）でよいか。
- [ ] しきい値は店舗単位の単一値でよいか（サイズ別 override スコープ外）。
- [ ] PV は既存 `Product.views` 合算表示のみでよいか。
- [ ] 在庫アラートは視覚バッジのみ（通知なし）でよいか。

---

## ステータス凡例

| 記号 | 意味 |
| --- | --- |
| ⬜ 未着手 | 未開始 |
| 🟡 進行中 | 実装中 / 一部コミット済み |
| ✅ 完了 | test-complete 通過・コミット済み |
