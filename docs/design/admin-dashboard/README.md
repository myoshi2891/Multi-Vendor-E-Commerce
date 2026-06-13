# 管理者ダッシュボード 3 機能 — 設計ドキュメント

> **このディレクトリの入口**。`docs/unimplemented-screens-plan.md`「A. 管理者ダッシュボード」に挙がった 3 つの未実装画面を、後続セッション（Sonnet 可）が **迷わず実装できる粒度** で設計したものです。

---

## 対象 3 機能

| ルート | 現状 | 必要機能 | 優先度 |
| --- | --- | --- | --- |
| `/dashboard/admin` | プレースホルダー（[page.tsx](../../../src/app/dashboard/admin/page.tsx) は `<div>Admin DashboardPage</div>` の 4 行） | 統計可視化メインダッシュボード（KPI + 売上推移 + 最近の注文/新規ストア） | 中 |
| `/dashboard/admin/orders` | 未作成（[sidebar](../../../src/components/dashboard/sidebar/) にリンク有） | 全店舗横断の注文一覧・詳細・ステータス変更 | **高** |
| `/dashboard/admin/coupons` | 未作成（sidebar にリンク有） | クーポン横断管理 + platform-wide 発行（拡張） | 中 |

---

## 読み順（このドキュメント群の歩き方）

```
1. README.md（このファイル）   ← 全体像・スコープ境界・核心判断サマリー
2. requirements.md             ← 何を作るか（EARS 風要件・受け入れ基準・制限事項）
3. design.md（中核）           ← どう作るか（queries・コンポーネント・スキーマ・影響箇所）
4. tasks.md                    ← どの順で作るか（TDD ステップ・コミット粒度・並列性）
```

| ドキュメント | 役割 | 主な読者 |
| --- | --- | --- |
| [requirements.md](./requirements.md) | 機能要件・非機能要件・制限事項・受け入れ基準 | レビュアー / PM / 実装者 |
| [design.md](./design.md) | アーキテクチャ・query シグネチャ・コンポーネント・スキーマ第1/2段・影響箇所マトリクス | 実装者（中核） |
| [tasks.md](./tasks.md) | フェーズ順・Red→Green→Refactor・コミット粒度・並列可否 | 実装者 / Agent Manager |

---

## スコープ境界（最重要・最初に確認）

### ✅ スコープ内

- **F1** 管理者ダッシュボード統計（KPI カード + 売上推移チャート + 最近の注文/新規ストア）
- **F2** 全店舗横断の注文管理（一覧・検索/フィルタ・詳細・OrderGroup/Item ステータス変更・Order paymentStatus 変更）
- **F3-第1段** クーポン横断管理（全店舗一覧・編集・削除・有効/無効切替）
- **F3-第2段** platform-wide クーポン発行（破壊的スキーマ変更を伴う拡張。`safe-migration` 必須）

### ❌ スコープ外（明示）

| 項目 | 理由 | 扱い |
| --- | --- | --- |
| **在庫管理全般**（カートの DB 永続化・在庫予約・注文時の在庫減算・キャンセル/返品時の復元） | **ユーザー指示により仕様確定後に別タスク** | admin ステータス変更 action に **将来の在庫連動フック位置（TODO コメント）のみ** 残す。在庫ロジックは実装しない |
| Stripe/PayPal の自動返金/キャプチャ API 呼び出し | 運営者が各決済ダッシュボードで別途操作する前提 | `paymentStatus` 手動変更は **DB ステータス更新のみ** |
| 多通貨対応・税計算エンジン | [product.md](../../../.claude/steering/product.md) でフェーズ外 | 触れない |
| 高度な分析ダッシュボード | product.md でフェーズ外 | F1 は KPI + 単純な売上推移までに留める |
| seller 側既存 query のリファクタ（インライン認可の `requireAdmin` 化） | 既存テスト保護・安全な差分優先 | 負債として温存。新規 admin query のみ `requireAdmin()` を使う |

> **在庫管理に関する注記**: 現状 [placeOrder](../../../src/queries/user.ts)（`src/queries/user.ts`）は `Size.quantity` を減算しません（既知ギャップ）。カートは Zustand + localStorage 永続化で、Checkout 時のみ DB `Cart` へ同期します。これらは在庫管理仕様の確定時に改めて再評価されます。

---

## 設計の核心判断（サマリー）

詳細は [design.md](./design.md) に記載。ここでは「なぜそうするか」の要点のみ。

| # | 判断 | 要点 |
| --- | --- | --- |
| 判断1 | **既存実装の最大再利用** | seller ダッシュボードに同等機能あり。admin 版は「全店舗横断」への一般化。新規発明を最小化（[design.md §再利用マトリクス](./design.md#13-再利用元マトリクス)） |
| 判断2 | **認可は新規 query で `requireAdmin()`** | 既存 `order.ts` のインライン認可は温存。新規 admin query は [auth-guards.ts](../../../src/lib/auth-guards.ts) の `requireAdmin()` を使う（CLAUDE.md 準拠） |
| 判断3 | **クーポンの段階的マイグレーション** | 第1段=`isActive` 列追加（後方互換）、第2段=`scope` enum + `storeId` nullable 化（破壊的） |
| 判断4 | **platform-wide が既存決済フローを壊す 3 箇所** | `applyCoupon` / `placeOrder` / カート再計算。改修 + 回帰テストを第2段に必須化（[design.md §影響箇所マトリクス](./design.md#判断4の影響箇所マトリクス3箇所)） |
| 判断5 | **アーキテクチャ品質要件** | 統計キャッシュ（5-1）/在庫スコープ外明示（5-2）/discriminated union 型ガード + 監査ログ（5-3）/Decimal 一貫演算と按分（5-4）/storeId nullable 化前の下位互換ステップ（5-5） |
| 判断6 | **状態整合性・認可 SSOT・入力上限** | isActive 再検証（6-1）/Order↔OrderGroup ステートマシン（6-2）/論理削除ストアの統計スコープ（6-3）/認可 SSOT=Clerk privateMetadata（6-4）/limit 上限キャップ z.max(100)（6-5） |

---

## 実装フェーズ順（安全な変更を先・破壊的変更を最後に）

> 詳細な TDD ステップは [tasks.md](./tasks.md) を参照。

```
Phase 1: F2 注文管理（高優先・スキーマ変更なし）          ← 最初に着手
Phase 2: F1 ダッシュボード統計（F2 の query を一部再利用）
Phase 3: F3-第1段 クーポン横断管理 + isActive 列追加（migrate dev / 後方互換）
Phase 4: 下位互換性確保ステップ（coupon.store / storeId の null セーフ化先行）
Phase 5: F3-第2段 platform-wide 発行（safe-migration / 破壊的 / 決済フロー波及）  ← 最後に単独で
```

**順序の根拠**: 優先度（F2 が「高」）・依存（F1 は F2 の query を再利用）・破壊性（F3-第2段は `storeId` nullable 化で決済フローに波及するため最後に隔離）。

---

## 関連ドキュメント・規約

| 種別 | パス | 関連内容 |
| --- | --- | --- |
| プラン原本 | `sonnet-docs-a-quirky-meteor.md`（リポジトリ未追跡・ローカル限定。`.gitignore` で意図的に除外） | 本設計群の入力（メタ仕様）。共有リポジトリには含めないため、参照は各自のローカル作業ツリーでのみ有効 |
| 未実装画面一覧 | [docs/unimplemented-screens-plan.md](../../unimplemented-screens-plan.md) | 「A. 管理者ダッシュボード」 |
| 認可ガード規約 | [.claude/steering/tech.md](../../../.claude/steering/tech.md) | "認可ガード" 項（`requireAdmin` 必須） |
| 動的レンダリング規約 | [.claude/steering/tech.md](../../../.claude/steering/tech.md) | DB 依存ページは `force-dynamic` |
| TDD・コミット規律 | [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) | Red→Green→Refactor・コミット粒度 |
| ER 図同期 | [.claude/rules/03-data-model-diagram-sync.md](../../../.claude/rules/03-data-model-diagram-sync.md) | スキーマ変更時の `bun run erd:generate` |
| 安全マイグレーション | [.claude/skills/safe-migration/SKILL.md](../../../.claude/skills/safe-migration/) | 第2段の破壊的変更で使用 |
| IDOR/認可テスト | [docs/testing/SECURITY_GAP_REPORT.md](../../testing/SECURITY_GAP_REPORT.md) | 3 階層パターン §5.2 |

---

## ステータス

- **本ドキュメント群**: 設計フェーズ（実装前）。
- **次アクション**: [tasks.md](./tasks.md) のレビュー → 承認後に Phase 1 から実装着手。
- **実装そのもの**（page.tsx 作成・migrate 実行・テスト）は本設計のスコープ外。tasks.md が後続実装セッションの入力になります。
