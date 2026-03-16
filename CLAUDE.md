# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コンテキスト参照

@.claude/steering/product.md
@.claude/steering/tech.md
@.claude/steering/structure.md

## プロジェクト概要

マルチベンダーEコマースマーケットプレイス。Next.js 14 (App Router) + TypeScript + Prisma (PostgreSQL) + Clerk認証 + Stripe/PayPal決済。3つのユーザーロール: 顧客(USER)、販売者(SELLER)、管理者(ADMIN)。

## 開発コマンド

```bash
# 開発サーバー起動
bun run dev

# ビルド
bun run build

# リント
bun run lint

# フォーマット
bunx prettier --write <file>

# ユニットテスト（Jest）
bun run test
bun run test -- --testPathPattern=src/queries/store.test.ts   # 単一テスト

# E2Eテスト（Playwright）
bunx playwright test
bunx playwright test tests/e2e/cart-smoke.spec.ts             # 単一テスト

# E2Eシードデータ投入
bun run seed:e2e

# ラグジュアリーデータセット生成（ローカル開発・デザイン確認用）
bun run seed:luxury

# Prismaコマンド
bunx prisma generate          # クライアント再生成
bunx prisma migrate dev       # マイグレーション適用（prisma/migrations/ の履歴を使用）
bunx prisma db push           # スキーマ直接反映（マイグレーション履歴なし、開発専用）
bunx prisma studio            # DBブラウザ
# ※ db push ではなく migrate dev を使うことで prisma/migrations/ と migration_lock.toml に
#    履歴が残り、本番環境への安全なデプロイが可能になります。
```

## アーキテクチャ

> 詳細は `.claude/steering/structure.md` を参照。以下はクイックリファレンス。

### 外部サービス依存

| サービス | 用途 | 設定ファイル |
|---|---|---|
| Clerk | 認証・ユーザー管理 | `src/middleware.ts` |
| Stripe | 決済処理 | `src/queries/stripe.ts` |
| PayPal | 決済処理 | `src/queries/paypal.ts` |
| Cloudinary | 画像ホスティング | `next.config.mjs` の remotePatterns |
| Svix | Webhook検証 | `src/app/api/webhooks/` |

## コーディング規約

- TypeScript strict mode。`any` 禁止
- ESLint: `next/core-web-vitals` + `plugin:tailwindcss/recommended`
- Tailwind CSSクラスの順序は `tailwindcss/classnames-order` で warn
- shadcn/ui: `components.json` の設定に従う（RSC対応、CSS変数使用、ベースカラー: slate）
- 外部呼び出し（Prisma, Clerk, Stripe/PayPal）は `try/catch` でラップ
- 保護されたアクションでは `currentUser()` とロールチェックが必要

## テスト構成

- **Jest**: ユニット/コンポーネントテスト。`src/queries/*.test.ts` にテストファイルを配置。E2Eディレクトリは除外設定済み。`@testing-library/jest-dom` + MSW（オプショナル）がセットアップ済み
- **Playwright**: E2Eテスト。`tests/e2e/` に配置。3ブラウザ（Chromium, Firefox, WebKit）。`bun run dev` でwebServer起動
- **共通テストインフラ** (`src/config/`): `test-fixtures.ts`（型安全ファクトリ）、`test-helpers.ts`（モックユーティリティ）、`test-scenarios.ts`（シナリオデータ）、`test-config.ts`（定数）
- テスト設計の詳細は `docs/testing/TESTING_DESIGN.md`、QA観点は `docs/testing/QA_TEST_PERSPECTIVES.md` を参照

## 既知の制約

- `reactStrictMode: false` に設定されている（`next.config.mjs`）
- Elasticsearch関連は現在コメントアウト（`src/lib/elastic-search.ts`）
- DB: PostgreSQL (Neon) + Prisma Accelerate。全文検索は `tsvector/tsquery`（`'simple'` トークナイザー）。移行経緯は `docs/migration/` 参照
