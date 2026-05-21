# GEMINI.md

This file provides guidance to Antigravity (Google's agentic IDE) when working with code in this repository.
Antigravity reads this file at the start of every agent session to maintain persistent context.

> 詳細な開発コマンド・アーキテクチャ・コーディング規約は [`CLAUDE.md`](CLAUDE.md) と [`.claude/steering/`](.claude/steering/) を参照（Claude Code と共通の Single Source of Truth）。

## プロジェクト概要

マルチベンダーEコマースマーケットプレイス。Next.js 16 (App Router) + TypeScript + Prisma (PostgreSQL) + Clerk認証 + Stripe/PayPal決済。3つのユーザーロール: 顧客 (USER)・販売者 (SELLER)・管理者 (ADMIN)。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | Next.js 16.2.1 (App Router) + TypeScript strict mode |
| Runtime | React 19 |
| UI | Tailwind CSS + shadcn/ui（CSS 変数・base カラー: slate） |
| 認証 | Clerk v7（middleware: `src/middleware.ts`） |
| DB | PostgreSQL (Neon) + Prisma ORM + Prisma Accelerate |
| 決済 | Stripe / PayPal |
| 画像 | Cloudinary |
| Webhook | Svix |
| 状態管理 | Zustand（カート） |
| テスト | Jest（ユニット）+ Playwright（E2E） |
| Lint | ESLint 9（flat config: `eslint.config.mjs`） |
| パッケージマネージャー | Bun |

## 開発コマンド

```bash
bun run dev                    # 開発サーバー起動
bun run build                  # 本番ビルド
bun run lint                   # ESLint
bun run test                   # Jest ユニットテスト
bunx playwright test           # Playwright E2E
bun run seed:e2e               # E2E 用シードデータ投入
bunx prisma generate           # Prisma クライアント再生成
bunx prisma migrate dev        # マイグレーション適用（ローカルのみ）
bunx prisma migrate deploy     # マイグレーション適用（本番・ステージング）
bunx prisma studio             # DB ブラウザ
```

## エージェント行動方針

- **実装前・実装中・実装後の 3 フェーズで必ず [`specs/multi-vendor-ecommerce/`](specs/multi-vendor-ecommerce/) 以下の該当仕様書を参照・確認する**
- コードを一行も書く前に実装プランを生成し、ユーザーに確認を求める
- 不確実な場合は実装前に確認（"Always Proceed" 禁止）
- git commit はタスク単位で細かく行う（Conventional Commits 形式: `feat:` / `fix:` / `chore:`）
- `src/` 配下での `console.log()` 禁止（CLI は許容）
- 本番 DB への `DELETE` / `DROP` は人間確認なしに実行しない
- `bunx prisma db push` は禁止。`prisma migrate dev`（ローカル）／ `prisma migrate deploy`（本番）を使用する
- 金額フィールドは `Decimal(12,2)` 必須。演算は `Prisma.Decimal` メソッド（`.add()`, `.mul()` 等）で行う
- `any` 禁止（`unknown` + 型ガード）

## ルール・規約参照

- 技術制約・実装パターン: [`.claude/steering/tech.md`](.claude/steering/tech.md)
- ディレクトリ責務・データモデル: [`.claude/steering/structure.md`](.claude/steering/structure.md)
- プロダクトビジョン・スコープ: [`.claude/steering/product.md`](.claude/steering/product.md)
- ドキュメント配置ルール: [`.claude/steering/documentation-guide.md`](.claude/steering/documentation-guide.md)
- 常時適用ガードレール: [`.claude/rules/`](.claude/rules/)
- PR 提出手順: [`.claude/workflows/submit-pr.md`](.claude/workflows/submit-pr.md)
- Antigravity 固有のルール（既存）: [`.agent/rules/core.md`](.agent/rules/core.md), [`.agent/rules/typescript.md`](.agent/rules/typescript.md)

## テスト構成

- 共通テストインフラ: `src/config/`（`test-fixtures.ts`, `test-helpers.ts`, `test-scenarios.ts`, `test-config.ts`）
- テスト設計の詳細: [`docs/testing/TESTING_DESIGN.md`](docs/testing/TESTING_DESIGN.md)
- QA 観点: [`docs/testing/QA_TEST_PERSPECTIVES.md`](docs/testing/QA_TEST_PERSPECTIVES.md)
- 直近のハンドオフ: [`docs/testing/QA_HANDOFF.md`](docs/testing/QA_HANDOFF.md)

## 仕様書参照

**Single Source of Truth**: [`specs/multi-vendor-ecommerce/`](specs/multi-vendor-ecommerce/)
読み順は [`specs/README.md`](specs/README.md) を参照。

**1. 実装前（新規機能・既存機能変更・バグ修正時）**
必ず以下の順序で関連仕様を確認すること:

1. `specs/multi-vendor-ecommerce/00-overview.md` — プロダクトのスコープ
2. `specs/multi-vendor-ecommerce/01-requirements.md` — 機能・非機能要件
3. `specs/multi-vendor-ecommerce/02-architecture.md` — アーキテクチャ制約
4. `specs/multi-vendor-ecommerce/03-data-model.md` — データモデル
5. `specs/multi-vendor-ecommerce/07-testing.md` — テスト方針

**2. 実装中（レビュー・差分チェック時）**
実装を進めながら、該当仕様書の要件や制約事項を満たしているか定期的に再確認する。

**3. 実装後**
実装が完了した時点（または変更時）で、仕様との差分がないか検証し、その結果（乖離がある場合はその報告）を人間に報告する。
