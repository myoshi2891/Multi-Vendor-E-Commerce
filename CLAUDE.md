# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Prismaコマンド
bunx prisma generate        # クライアント再生成
bunx prisma db push          # スキーマをDBに反映
bunx prisma studio           # DBブラウザ
```

## アーキテクチャ

### ディレクトリ構造の責務

| ディレクトリ | 責務 |
|---|---|
| `src/app/(store)/` | 顧客向けページ（ホーム、商品閲覧、カート、チェックアウト、プロフィール） |
| `src/app/(auth)/` | Clerk認証ページ（sign-in, sign-up） |
| `src/app/dashboard/admin/` | 管理者ダッシュボード（カテゴリ、店舗管理） |
| `src/app/dashboard/seller/stores/[storeUrl]/` | 販売者ダッシュボード（商品、注文、クーポン、配送） |
| `src/app/api/` | APIルート（商品検索、Webhook） |
| `src/queries/` | **サーバーアクション・データ取得関数**（`"use server"` ディレクティブ付き） |
| `src/lib/` | 共有ユーティリティ（db.ts, schemas.ts, types.ts, utils.ts） |
| `src/components/ui/` | shadcn/ui コンポーネント群 |
| `src/components/dashboard/` | ダッシュボード固有のUIコンポーネント |
| `src/components/store/` | 顧客向けUIコンポーネント |
| `src/components/shared/` | 全体で共有するコンポーネント |
| `src/cart-store/` | Zustandカートストア |
| `prisma/` | Prismaスキーマ・マイグレーション |

### 重要な設計判断

- **サーバーアクションは `src/queries/` に集約**: `src/actions/` ディレクトリは存在しない。サーバーアクションとクエリ関数は同一ファイルに配置
- **UIコンポーネントからサーバーアクションを直接importしない**: `src/queries/` 経由で呼び出す
- **入力バリデーションは `src/lib/schemas.ts` のZodスキーマ**: フォームは React Hook Form + Zod resolver
- **DBアクセスは `src/lib/db.ts` のPrismaシングルトン経由**: 直接 `new PrismaClient()` しない
- **認証は Clerk middleware (`src/middleware.ts`)**: 保護ルートは `/dashboard/*`, `/checkout`, `/profile/*`

### パスエイリアス

```
@/*       → ./src/*
@/store   → ./src/components/store   （注意: @/cart-storeではない）
@/public/* → ./public/*
```

### 外部サービス依存

| サービス | 用途 | 設定ファイル |
|---|---|---|
| Clerk | 認証・ユーザー管理 | `src/middleware.ts` |
| Stripe | 決済処理 | `src/queries/stripe.ts` |
| PayPal | 決済処理 | `src/queries/paypal.ts` |
| Cloudinary | 画像ホスティング | `next.config.mjs` の remotePatterns |
| Svix | Webhook検証 | `src/app/api/webhooks/` |

### データモデル（主要エンティティ）

`prisma/schema.prisma` の核心: **商品→バリアント→サイズ/カラー** の階層構造。

- `User` → `Store`（1:N）→ `Product`（1:N）→ `ProductVariant`（1:N）
- `ProductVariant` に価格・在庫・画像が紐づく（商品レベルではなくバリアントレベル）
- `Cart` → `CartItem` → `ProductVariant`（バリアント単位でカートに追加）
- `Order` → `OrderGroup`（店舗単位）→ `OrderItem`（バリアント単位）
- ロールは `enum Role { USER ADMIN SELLER }`

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

## 既知の制約

- `reactStrictMode: false` に設定されている（`next.config.mjs`）
- Elasticsearch関連は現在コメントアウト（`src/lib/elastic-search.ts`）
- PostgreSQL (Neon) への移行作業中（`docs/migration/` 参照）
- ネイティブ外部キー制約（`relationMode = "foreignKeys"`）は移行後の目標設定（現在は `"prisma"` モード）
