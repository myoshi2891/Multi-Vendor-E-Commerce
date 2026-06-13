# 管理者ダッシュボード 3 機能 — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md) を正とする（本ファイルは Phase 単位の現在地）。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-13 時点）

- ✅ **Phase 1（F2 注文管理）完了** — 1-A〜1-D すべて実装・検証済み。
- 👉 **次の着手: Phase 2（F1 ダッシュボード統計）の 2-A**（`getAdminDashboardStats` 等の統計 query）。
- Phase 3 以降（クーポン横断管理・スキーマ変更）は未着手。Phase 5 は破壊的変更のため `safe-migration` 必須。

---

## Phase 1: F2 注文管理（スキーマ変更なし）✅ 完了

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 1-A | admin 注文 query 5 種（`getAllOrders` / `getOrderForAdmin` / `updateOrderGroupStatusAsAdmin` / `updateOrderItemStatusAsAdmin` / `updateOrderPaymentStatus`）+ 親子連動 `reconcileParentOrderStatus` | ✅ | `1747f32` / `7083681` / `ff15259` / `d88063a`（2026-06-13） |
| 1-B | `AdminOrderType` 型追加 | ✅ | `445ad00` |
| 1-C | `OrderStatusSelect` を discriminated union 化（seller/admin）+ 既存 seller 呼び出し 3 箇所に `mode` 付与 + `any` 是正 | ✅ | `refactor(ui): make OrderStatusSelect props a discriminated union` |
| 1-D | admin 注文管理ページ（`/dashboard/admin/orders` の `page.tsx` + `columns.tsx`）。Store 列・group ごとの Status 変更・詳細モーダル | ✅ | `feat(admin): add cross-store order management page and columns` |
| — | order.ts カバレッジ補完（SonarCloud New Code Coverage 修復・PR #133） | ✅ | `38a9bbe`（2026-06-13） |

> **検証**: tsc 0 / lint 0 errors / test 1251 passed（変動なし）/ build 成功（`/dashboard/admin/orders` = Dynamic）。

### Phase 1 でスコープ外（後続に引き継ぎ）

- `updateOrderPaymentStatus` の **paymentStatus 手動変更 UI**（design §3.3 の「DB のみ変更・決済 API 非連携」警告付き UI / §3.5 runbook）。1-D は OrderGroup の**配送ステータス**変更のみ結線済み。詳細モーダル拡張として別途実装。
- 在庫連動（TODO フックのみ・[判断5-2]）。

---

## Phase 2: F1 ダッシュボード統計 ⬜ 未着手 👈 次はここ

| Task | 内容 | 状態 |
| --- | --- | --- |
| 2-A | 統計 query（`src/queries/dashboard.ts` 新規）: `getAdminDashboardStats`（`Promise.all` + `unstable_cache` 20分）/ `getSalesOverTime` / `getRecentOrders` / `getRecentStores` | ⬜ |
| 2-B | F1 UI（`admin/page.tsx` 置換 + `components/dashboard/admin/*`）: KPI カード + 売上チャート（`@tremor/react`・依存追加なし）+ 最近の注文/ストア | ⬜ |

> 確認済み: `enum StoreStatus` = `PENDING`/`ACTIVE`/`BANNED`/`DISABLED`。KPI は `ACTIVE`/`PENDING` を使用。

---

## Phase 3: F3-第1段 クーポン横断管理 + isActive 列 ⬜ 未着手

| Task | 内容 | 状態 |
| --- | --- | --- |
| 3-A | スキーマ第1段（`Coupon.isActive` 追加・`migrate dev`・後方互換）+ ERD 再生成 | ⬜ |
| 3-B | `isActive` 再検証（`placeOrder` / `applyCoupon`） | ⬜ |
| 3-C | admin クーポン query（`getAllCoupons` / `upsertCouponAsAdmin` (P2002) / `deleteCouponAsAdmin` / `toggleCouponActive`） | ⬜ |
| 3-D | Zod `AdminCouponFormSchema` | ⬜ |
| 3-E | F3 UI（coupons ページ・columns・admin フォーム） | ⬜ |

---

## Phase 4: 下位互換性確保（null セーフ化先行・スキーマ非変更）⬜ 未着手

| Task | 内容 | 状態 |
| --- | --- | --- |
| 4-1〜4-4 | `applyCoupon` / `saveUserCart` / `getStoreCoupons`・UI の `coupon.store` null セーフ化（直列・振る舞い不変の防御のみ） | ⬜ |

---

## Phase 5: F3-第2段 platform-wide 発行（破壊的・決済波及）⬜ 未着手

> **`safe-migration` skill 必須・厳格な直列・最後に単独実施。**

| Task | 内容 | 状態 |
| --- | --- | --- |
| 5-A | スキーマ第2段（`CouponScope` enum + `storeId` nullable 化） | ⬜ |
| 5-B | 影響箇所 3 改修（`placeOrder` / `applyCoupon` Decimal 化 / `saveUserCart`）+ seller `upsertCoupon` P2002 + 回帰テスト | ⬜ |
| 5-C | E2E 検証（PLATFORM クーポン購入フロー・3 ブラウザ） | ⬜ |

---

## レビュー必須ポイント（着手前に確認）

- [ ] platform-wide クーポンの按分（端数の最終グループ吸収）が会計要件と合致するか（Phase 5）。
- [ ] `paymentStatus` 手動変更が DB のみ（決済 API 非連携）で運用上問題ないか（Phase 1 の後続 UI）。
