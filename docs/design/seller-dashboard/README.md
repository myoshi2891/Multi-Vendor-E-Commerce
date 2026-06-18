# 販売者ダッシュボード 2 機能 — 設計ドキュメント

> **このディレクトリの入口**。`docs/unimplemented-screens-plan.md`「B. 販売者ダッシュボード」に挙がった 2 つの未実装画面を、後続セッション（Sonnet 可）が **迷わず実装できる粒度** で設計したものです。
> 構成は [docs/design/admin-dashboard/](../admin-dashboard/) を踏襲します。

---

## 対象 2 機能

| ルート | 現状 | 必要機能 | 優先度 |
| --- | --- | --- | --- |
| `/dashboard/seller/stores/[storeUrl]` | プレースホルダー（[page.tsx](../../../src/app/dashboard/seller/stores/[storeUrl]/page.tsx) は `<div>SellerStorePage</div>`） | 店舗別 統計ダッシュボード（KPI カード + 売上推移 + 最近の注文 + トップ商品） | 中 |
| `/dashboard/seller/stores/[storeUrl]/inventory` | 未作成（[sidebar](../../../src/constants/data.ts#L57) に `link:"inventory"` 有・ディレクトリ無し） | バリアント×サイズ単位の在庫一覧・在庫数クイック編集・在庫切れ/過小在庫アラート | **高** |

> 本設計では機能 ID を **ルート表の並び**で付与する（F1=ダッシュボード / F2=在庫管理）。**実装順は優先度準拠で在庫（F2）を先**にする（[実装フェーズ順](#実装フェーズ順安全な変更を先在庫減算を最後に)）。さらに在庫減算（**F3**）を派生機能として定義する。

---

## 読み順（このドキュメント群の歩き方）

```
1. README.md（このファイル）   ← 全体像・スコープ境界・核心判断サマリー
2. requirements.md             ← 何を作るか（EARS 風要件・受け入れ基準・制限事項）
3. design.md（中核）           ← どう作るか（queries・コンポーネント・スキーマ・影響箇所）
4. tasks.md                    ← どの順で作るか（TDD ステップ・コミット粒度・並列性・スキル呼び出し）
```

| ドキュメント | 役割 | 主な読者 |
| --- | --- | --- |
| [requirements.md](./requirements.md) | 機能要件・非機能要件・制限事項・受け入れ基準 | レビュアー / PM / 実装者 |
| [design.md](./design.md) | アーキテクチャ・query シグネチャ・コンポーネント・スキーマ変更・影響箇所マトリクス | 実装者（中核） |
| [tasks.md](./tasks.md) | フェーズ順・Red→Green→Refactor・コミット粒度・並列可否・**スキル呼び出し箇所** | 実装者 / Agent Manager |
| [PROGRESS.md](./PROGRESS.md) | 実行トラッカー（現在地・フェーズ状態・検証行・レビュー必須ポイント） | トラッカー |

---

## スコープ境界（最重要・最初に確認）

### ✅ スコープ内

- **F1** 店舗ダッシュボード統計（KPI カード + 売上推移チャート + 最近の注文 + トップ商品。`/dashboard/seller/stores/[storeUrl]`）
- **F2** 在庫管理（バリアント×サイズの在庫一覧・在庫数クイック編集・在庫切れ/過小在庫の**視覚アラート**・店舗ごとの**しきい値設定**。`/dashboard/seller/stores/[storeUrl]/inventory`）
- **F3** 注文確定時の在庫自動減算（`placeOrder` で `Size.quantity` をアトミック減算 + 在庫不足ガード。**ユーザー指示によりスコープイン**）
- **スキーマ拡張**: `Store.lowStockThreshold Int @default(5)` 追加（additive・後方互換。`safe-migration` 必須）

### ❌ スコープ外（明示）

| 項目 | 理由 | 扱い |
| --- | --- | --- |
| **メール / アプリ内通知**（在庫が閾値を下回った際の能動的通知） | 通知基盤（メール送信・通知テーブル）が現フェーズに存在しない | アラートは**在庫一覧上の視覚バッジ**（赤=在庫切れ / 橙=過小）に留める。「通知設定」はしきい値設定 UI として実装 |
| **サイズ別の個別しきい値 override** | 設定 UX が複雑化。まず店舗単位の単一しきい値で十分 | `Store.lowStockThreshold` の店舗単位のみ。`Size` 単位 override は将来拡張 |
| **キャンセル/返品時の在庫復元** | 減算（F3）の整合性対となるが、注文ステータス変更フローへの波及が追加で発生 | **レビュー対象**として recommended ON で設計（[design §5.3](./design.md#53-キャンセル返品時の在庫復元レビュー対象)）。Phase 4 の任意サブステップ 4-D |
| **多通貨対応・税計算エンジン** | [product.md](../../../.claude/steering/product.md) でフェーズ外 | 触れない |
| **高度な分析ダッシュボード**（コホート・LTV 等） | product.md でフェーズ外 | F1 は KPI + 単純な売上推移 + 最近リスト + トップ商品までに留める |
| **閲覧数(PV) の収集ロジック新設** | `Product.views` は既存フィールド。収集経路の改修は別タスク | F1 は **既存 `Product.views` の店舗内合算**を表示するのみ |

> **在庫減算に関する注記**: 現状 [placeOrder](../../../src/queries/user.ts#L609)（`src/queries/user.ts`）は注文数を `Math.min(quantity, size.quantity)` で在庫数に**クランプするが `Size.quantity` を減算しない**（[user.ts:494](../../../src/queries/user.ts#L494) の既知ギャップ）。F3 はこのギャップを「アトミックな check-and-decrement」で埋める（[design §5.2](./design.md#52-placeorder-在庫減算の影響箇所マトリクス)）。

---

## 設計の核心判断（サマリー）

詳細は [design.md](./design.md) に記載。ここでは「なぜそうするか」の要点のみ。

| # | 判断 | 要点 |
| --- | --- | --- |
| 判断1 | **既存実装の最大再利用** | admin [dashboard.ts](../../../src/queries/dashboard.ts) の `getAdminDashboardStats`/`getSalesOverTime`/`getRecentOrders` を **店舗スコープ版**へ一般化。`@tremor/react` AreaChart・`StatsCards`・`DataTable` を流用し新規発明を最小化（[design §1.3](./design.md#13-再利用元マトリクス)） |
| 判断2 | **認可は `requireStoreOwner(storeUrl)`** | 新規 query は全て [auth-guards.ts:87](../../../src/lib/auth-guards.ts#L87) の `requireStoreOwner` で **SELLER ロール + 店舗所有権**を検証（IDOR 防止）。インライン認可は新規追加しない（CLAUDE.md 準拠） |
| 判断3 | **在庫しきい値は Store 単位で永続化** | `Store.lowStockThreshold Int @default(5)` を追加（additive・後方互換）。バッジ判定: `quantity===0`→在庫切れ(赤) / `0<quantity<=threshold`→過小(橙)。サイズ別 override は将来拡張 |
| 判断4 | **在庫クイック編集は専用 action** | `updateSizeStock(sizeId, quantity, storeUrl)` を新設。`requireStoreOwner` + **所有権チェーン**（size→variant→product→store.id 一致）で IDOR 防止。Zod `UpdateSizeStockSchema`（quantity: int≥0） |
| 判断5 | **店舗売上集計は OrderGroup×Order の join** | `OrderGroup` に `paymentStatus` が無い（[schema:521](../../../prisma/schema.prisma#L521)）ため、店舗売上は `OrderGroup.total` を **親 `Order.paymentStatus === "Paid"`** で絞って集計。Decimal は集計中 `.add()`、return 境界でのみ `.toNumber()`（[tech.md 金額精度](../../../.claude/steering/tech.md)） |
| 判断6 | **placeOrder 在庫減算 + 不足ガード（アトミック）** | 既存 `$transaction`（[user.ts:609](../../../src/queries/user.ts#L609)）内で `tx.size.updateMany({ where:{ id, quantity:{ gte: qty } }, data:{ quantity:{ decrement: qty } } })` を実行。`count===0` なら在庫不足 → throw でロールバック（TOCTOU レース回避）。減算は OrderItem 作成ループ（[user.ts:696](../../../src/queries/user.ts#L696)）と同一 tx |
| 判断7 | **安全な変更を先・波及的変更を最後に** | しきい値スキーマは additive で安全 → 早期（Phase 1）。在庫(高優先)→ダッシュボード(中優先)。在庫減算はチェックアウトフローを壊しうる最大リスク → 単独で最後（Phase 4・回帰+E2E） |

---

## 実装フェーズ順（安全な変更を先・在庫減算を最後に）

> 詳細な TDD ステップは [tasks.md](./tasks.md) を参照。

```
Phase 1: スキーマ追加 lowStockThreshold      [additive・後方互換]  ← safe-migration + erd:generate
Phase 2: F2 在庫管理ページ（高優先）          [read query + クイック編集 + しきい値設定 + バッジ UI]
Phase 3: F1 店舗ダッシュボード統計（中優先）  [dashboard.ts パターンを店舗スコープへ一般化]
Phase 4: F3 placeOrder 在庫減算 + 不足ガード   [チェックアウト波及・最後に隔離]  ← 回帰 + E2E
```

**順序の根拠**: しきい値スキーマは additive（default 付き）で後方互換なので、在庫 UI を解放するため早期に入れる（Phase 1）。在庫管理は **高優先**（Phase 2）、ダッシュボードは中優先（Phase 3）。在庫減算は `placeOrder` のチェックアウトフローに波及する最大リスクのため、単独で最後に隔離（Phase 4）。

> **フェーズ間の依存**: Phase 1 → 2 は直列（バッジ判定が `lowStockThreshold` に依存）。Phase 2 → 3 は弱依存（query パターン共有のため 2 先行を推奨だが型合意後は並列着手可）。**Phase 4 は厳格に最後**（在庫減算 + 回帰 + E2E）。

---

## 関連ドキュメント・規約

| 種別 | パス | 関連内容 |
| --- | --- | --- |
| 先行設計（参照元） | [docs/design/admin-dashboard/](../admin-dashboard/) | 本設計群のフォーマット元。`dashboard.ts` 等の再利用元 |
| 未実装画面一覧 | [docs/unimplemented-screens-plan.md](../../unimplemented-screens-plan.md) | 「B. 販売者ダッシュボード」 |
| 認可ガード規約 | [.claude/steering/tech.md](../../../.claude/steering/tech.md) | "認可ガード" 項（`requireStoreOwner` 必須） |
| 動的レンダリング規約 | [.claude/steering/tech.md](../../../.claude/steering/tech.md) | DB 依存ページは `force-dynamic` |
| 金額・数値精度規約 | [.claude/steering/tech.md](../../../.claude/steering/tech.md) | Decimal 一貫演算・`.toNumber()` は return 境界のみ |
| TDD・コミット規律 | [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) | Red→Green→Refactor・コミット粒度 |
| ER 図同期 | [.claude/rules/03-data-model-diagram-sync.md](../../../.claude/rules/03-data-model-diagram-sync.md) | スキーマ変更時の `bun run erd:generate` |
| 実装前計画 | [feature-plan skill](../../../.claude/skills/feature-plan/) | 本設計群の前段（実装前計画） |
| サーバーアクション雛形 | [server-action-scaffold skill](../../../.claude/skills/server-action-scaffold/) | 新規 query の雛形生成 |
| テスト生成 | [test-gen skill](../../../.claude/skills/test-gen/) | 各 Red ステップ・カバレッジ補完 |
| 安全マイグレーション | [safe-migration skill](../../../.claude/skills/safe-migration/) | Phase 1 のスキーマ追加 |
| IDOR/認可テスト | [docs/testing/SECURITY_GAP_REPORT.md](../../testing/SECURITY_GAP_REPORT.md) | 3 階層パターン §5.2 |

---

## ステータス

- **本ドキュメント群**: 設計フェーズ（実装前）。
- **次アクション**: [tasks.md](./tasks.md) のレビュー → 承認後に Phase 1 から実装着手。
- **実装そのもの**（page.tsx 作成・migrate 実行・テスト）は本設計のスコープ外。tasks.md が後続実装セッションの入力になります。
