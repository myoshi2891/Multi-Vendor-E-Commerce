# PROGRESS.md

> **運用ルール**: 進捗・一時的な決定を記録する。gitで追えるもの（コミット一覧・変更行数）は書かない。
> 書くべき情報: なぜその決定をしたか／今どこにいるか／次に何をするか。

---

## 現在の状態（2026-05-21 時点）

### テスト統計
| 指標 | 値 |
|------|----|
| Jestユニットテスト | 945テスト / 60スイート（全パス） |
| 型エラー | 0件 |
| Playwright E2E | Chromium / Firefox / WebKit（3ブラウザ） |

### 技術スタック（現行）
| パッケージ | バージョン |
|-----------|-----------|
| Next.js | 16.2.1（App Router） |
| React | 19 |
| @clerk/nextjs | v7 |
| ESLint | 9（flat config） |
| Swiper | 12.x |

---

## フェーズ別サマリ（経緯）

### 2025-12〜2026-02: テスト基盤・DB移行
- Playwright + Jest 導入。E2E seed（tsx ランナー）整備
- MySQL → PostgreSQL (Neon) + Prisma Accelerate に移行
  - **理由**: Neon のサーバーレス特性 + Prisma Accelerate のコネクションプーリングでコールドスタートを解消

### 2026-03-01: ユニットテスト大量追加・バグ修正
- 536テスト → 543テストへ。`src/config/` にテスト共通インフラを整備
- 修正した実装バグ4件（IDOR脆弱性・Svix evt.data 二重パース・countryId 比較・エラーメッセージ）
  - **IDOR修正の背景**: `review.ts` の upsert がオーナーチェックなしで任意の review を上書きできた

### 2026-03-14〜16: AIスキル・ラグジュアリーシード・Decimal移行
- `.claude/skills/` に5スキル追加（spec-sync-check, safe-migration, server-action-scaffold, test-complete, feature-plan）
- `prisma/seed/` に5フェーズシーダー構築（`bun run seed:luxury`）
- 全金額フィールドを `Decimal(12,2)` に統一
  - **理由**: Float の浮動小数点誤差が注文金額計算に影響するリスクを排除

### 2026-03-23: ドキュメント管理戦略確立
- `.claude/steering/documentation-guide.md` を新規作成（ADRガイドライン・Decision Tree）
- plans/archive ディレクトリを削除（有用な情報は正式ドキュメントに統合済み）

### 2026-03-28: Next.js 16 マイグレーション完了
- Next.js 14→16、React 18→19、Clerk v6→v7、ESLint 8→9 を一括アップグレード
- **主な Breaking Changes 対応**:
  - `params`/`cookies`/`headers` が Promise 化 → `await` / `use()` フック対応
  - Clerk v7 で `auth()` / `currentUser()` が async 化
  - ESLint 9 flat config（`eslint.config.mjs`）への移行
  - React 19 の `useRef<T>(null)` → `RefObject<T | null>` に module augmentation で対応
- 881テスト / 54スイートで全パス確認後マージ

### 2026-05-21: Phase 1 基盤テスト検証（TEST_IMPLEMENTATION_PLAN.md P0対応）
- `use-mobile`, `useFromStore`, `middleware`, `modal-provider` の4スイートに優先度ラベルを付与
- プレエキシスティング型エラー2件を修正（`quantity-selector.test.tsx`・`product.test.ts`）
- 945テスト / 60スイート / 型エラー 0件に到達

### 2026-05-21: A1 認可テストギャップ補完（COVERAGE_REPORT.md 高優先度）
- 14 ファイルの認可テスト実態を `docs/testing/SECURITY_GAP_REPORT.md` に記録
- `review.test.ts` に IDOR レグレッションテスト追加（`findFirst.where.userId` を明示検証）
- `paypal.test.ts` / `stripe.test.ts` に `it.skip` で IDOR スケルトンテスト追加（実装側の `userId` フィルタ未実装を documenting）
- **次アクション**: 別 PR で `paypal.ts` / `stripe.ts` の `db.order.findUnique` に `userId` フィルタを追加し、`it.skip` を有効化

---

## 既知の課題

| 課題 | 詳細 | 優先度 |
|------|------|--------|
| Elasticsearch 未実装 | `src/lib/elastic-search.ts` がコメントアウト中。全文検索は現在 tsvector で代替 | 低 |
| E2E シード不安定 | `bun run seed:e2e` が外部DBへの接続前提。CI環境での冪等性は未検証 | 中 |
| E2E テスト網羅不足 | `TEST_IMPLEMENTATION_PLAN.md` の P1/P2 スイートが未実装 | 中 |

---

## 次アクション

### 1. TEST_IMPLEMENTATION_PLAN.md の P1 スイート実装

**背景**: Phase 1 の P0（基盤テスト）は2026-05-21 に完了。次は P1 優先度のコンポーネントテストに着手。

**入力ファイル**:
- `docs/testing/TEST_IMPLEMENTATION_PLAN.md`（⏸️ステータスのスイートを確認）
- `src/config/test-fixtures.ts`（既存ファクトリを活用）

**進め方**:

```
/test-gen
```

対象スイートを指定して `test-gen` スキルを呼び出す。AAAパターン・既存インフラ活用を指示。

---

### 2. E2E テストの CI 安定化

**背景**: Playwright E2E は `bun run dev` でローカル起動を前提としているが、CI 環境での seed:e2e 実行と安定した接続が未検証。

**確認すべきこと**:
- `E2E_DATABASE_URL` が CI secrets に設定されているか
- `tests/e2e/` の各スペックが seed データに依存している箇所の一覧化
- `playwright.config.ts` の `webServer` タイムアウト設定

---

### 3. spec-sync-check で仕様乖離を確認

**背景**: Next.js 16 マイグレーション後、いくつかのインターフェース仕様が変更されている可能性がある。

**進め方**:

```
/spec-sync-check
```

---

## 参照ドキュメント

| ドキュメント | 目的 |
|-------------|------|
| `docs/testing/TEST_IMPLEMENTATION_PLAN.md` | テスト実装計画（P0/P1/P2 優先度付き） |
| `docs/testing/TESTING_DESIGN.md` | テスト設計方針・ヘルパー関数パターン |
| `docs/migration/06-framework-upgrade.md` | Next.js 16 マイグレーションの詳細記録 |
| `specs/multi-vendor-ecommerce/` | SDD 仕様書群（Single Source of Truth） |
| `.claude/steering/tech.md` | 実装パターン・コーディング規約 |
