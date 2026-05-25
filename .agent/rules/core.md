---
activation: always
---

# Core Rules — Multi-Vendor E-Commerce

## プロジェクト概要
Next.js 16.2.1 (App Router) + React 19 + TypeScript + Prisma (PostgreSQL) + Clerk認証 + Stripe/PayPal決済のマルチベンダーEコマースマーケットプレイス。

## アーキテクチャ制約

- **サーバーアクションは `src/queries/` に集約**（`src/actions/` は存在しない）
- **入力バリデーションは `src/lib/schemas.ts` の Zod スキーマ**（フォームは React Hook Form + Zod resolver）
- **DBアクセスは `src/lib/db.ts` の Prisma シングルトン経由**（`new PrismaClient()` は禁止）
- **認証は Clerk middleware**（保護ルートは `/dashboard/*`, `/checkout`, `/profile/*`）
- **Server Actions のインポートと呼び出しに関する厳格なルール**
  - `src/queries/` はサーバー側クエリロジックの承認済みファサード（approved facade）です
  - ❌ **Client Component**: `src/queries/` を含むいかなる場所からも Server Actions を直接 import してはいけません。サーバーアクションの呼び出しは、Props（イベントハンドラー等）や API エンドポイントを経由して行う必要があります。
  - ✅ **Server Component**: `src/queries/` を経由して Server Actions を import し、呼び出すことが許可されています。
- データモデルは **バリアントレベル**（価格・在庫・画像は `ProductVariant` に紐づく）

## セキュリティ制約

- 保護されたアクションでは **`src/lib/auth-guards.ts`** のヘルパー（`requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner`）で認証・ロール・店舗所有権を集約検証する。**`currentUser()` + `if (!user) ...` / `if (role !== "...") ...` のインライン展開を新規追加することは禁止**（詳細: [`.claude/steering/tech.md`](../../.claude/steering/tech.md) "認可ガード" 項、根拠: [`docs/testing/SECURITY_GAP_REPORT.md §5`](../../docs/testing/SECURITY_GAP_REPORT.md)）
- IDOR テストは 3 階層パターン (a) スロー検証 / (b) `where: { url, userId }` 構造検証 / (c) ガード失敗時の副作用なし検証 を必ず満たす
- 外部呼び出し（Prisma・Clerk・Stripe/PayPal）は `try/catch` でラップ
- シークレット・APIキーは `.env` にのみ記述、コミット禁止

## 禁止操作

- `console.log()` のコミット（レビュー前に削除必須）
- `bunx prisma db push` の使用（これはプロトタイピングやローカル開発環境でのみ許可されます。ステージング・本番環境など、永続的でバージョン管理されたマイグレーション履歴が必要な環境では必ず `prisma migrate dev` を使用してください）
- `migrations/` 配下の既存ファイルを編集する
- 本番DBへの `DELETE`/`DROP` を人間の確認なしに実行する
- `reactStrictMode` の変更（`next.config.mjs` で `false` に設定済み）

## SDD仕様書参照ルール

**1. 実装前（新規機能・既存機能変更・バグ修正時）**
必ず以下の順序で関連仕様を確認すること：
1. `specs/multi-vendor-ecommerce/00-overview.md` — プロダクトスコープ確認
2. `specs/multi-vendor-ecommerce/01-requirements.md` — 機能・非機能要件確認
3. `specs/multi-vendor-ecommerce/02-architecture.md` — アーキテクチャ制約確認
4. `specs/multi-vendor-ecommerce/03-data-model.md` — データモデル確認
5. `specs/multi-vendor-ecommerce/07-testing.md` — テスト方針確認

**2. 実装中（レビュー・差分チェック時）**
実装を進めながら、該当仕様書の要件や制約事項を満たしているか定期的に再確認する。

**3. 実装後**
実装が完了した時点（または変更時）で、仕様との差分がないか検証し、その結果（乖離がある場合はその報告）をユーザーに報告する。

## エージェント行動方針

- コードを一行も書く前に Implementation Plan を生成し、ユーザーに確認を求める
- 不確実な場合は実装前に確認（"Always Proceed" 禁止）
- git commit はタスク単位で細かく行う

## テスト関連ドキュメントの更新ルール

テストコードを追加・変更したセッションでは、以下のドキュメントを**必ず**更新してコミットする。
詳細は [`.claude/steering/documentation-guide.md`](.claude/steering/documentation-guide.md#docstesting-各ファイルの更新ルール) を参照。

| タイミング | 更新対象 | 内容 |
|----------|---------|------|
| Step 完了時 | `docs/testing/TEST_IMPLEMENTATION_PLAN.md` | 該当 Step に `✅ Completed (日付)` を付与 |
| セッション終了時（**必須**） | `docs/testing/QA_HANDOFF.md` | Open Issues 更新・次着手の明記・テスト統計を同期 |
| セル状態変化時 | `docs/testing/COVERAGE_REPORT.md` | ヒートマップ更新（`◯`→`◐`→`✦`）・§3 タスクの完了記録 |
| セキュリティ修正時 | `docs/testing/SECURITY_GAP_REPORT.md` | 脆弱性・修正コミット・追加テストを記録 |
| 統計値変化時 | `docs/PROGRESS.md` | テスト統計（テスト数・型エラー数など）を `QA_HANDOFF.md` と同期して更新 |
| カバレッジ更新時 | `docs/coverage-dashboard.html` | `bun run coverage:dashboard` を実行してダッシュボードを再生成 |

**重複防止の鉄則**:
- 即時 TODO（次何をするか）→ `QA_HANDOFF.md` のみ
- 戦略理由（なぜやるか）→ `COVERAGE_REPORT.md §3` のみ
- 実装手順パターン（どう書くか）→ `TESTING_DESIGN.md` のみ
- テスト統計（テスト数・型エラー数等）の正（SSOT）→ `QA_HANDOFF.md`（`PROGRESS.md` は `QA_HANDOFF.md` の値を転記・同期する）

## パスエイリアス（クイックリファレンス）

```
@/*        → ./src/*
@/store    → ./src/components/store  ※ @/cart-store ではない
@/public/* → ./public/*
```
