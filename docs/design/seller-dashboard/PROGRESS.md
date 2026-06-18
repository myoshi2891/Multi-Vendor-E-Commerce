# 販売者ダッシュボード 2 機能 — 実装トラッカー（PROGRESS.md）

> [tasks.md](./tasks.md) のフェーズ実行状況を記録する。実装セッションは各 Step 完了ごとに本ファイルを更新する。
> 統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。テスト数が動いたら [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) で同期する。

## 🧭 現在地

- **2026-06-18 時点**: **Phase 1 完了 / Phase 2（F2 在庫管理）完了**（query 層・型・純粋関数 + UI まで一通り）。
- 残り: **Phase 3**（F1 店舗ダッシュボード統計: `store-dashboard.ts` query + KPI/チャート UI）👈 次はここ。
- 検証: tsc 0 / lint 0 errors / test 1435 → **1443 passed**（147 スイート）/ build 成功 / `/dashboard/seller/stores/[storeUrl]/inventory` = Dynamic（ƒ）を確認。

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
| 3-A | 統計 query（`store-dashboard.ts`）+ キャッシュ分離テスト | ⬜ 未着手 | — |
| 3-B | F1 UI（page 置換 + KPI/チャート/最近リスト） | ⬜ 未着手 | — |

> **検証**（完了時に記入）: tsc 0 / lint 0 / test +N / build 成功（`/[storeUrl]` = Dynamic）。

## Phase 4: F3 placeOrder 在庫減算（最後に隔離）

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 4-A | `placeOrder` アトミック減算 + 不足ガード + 回帰テスト | ⬜ 未着手 | — |
| 4-B | E2E（購入フロー → 在庫減少） | ⬜ 未着手 | — |
| 4-C | `spec-sync-after-test` で docs 同期 | ⬜ 未着手 | — |
| 4-D | （任意）キャンセル/返品時の在庫復元 | ⬜ 未着手 | レビュー対象（recommended ON） |

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
