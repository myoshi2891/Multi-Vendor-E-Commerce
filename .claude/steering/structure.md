# Project Structure

## ディレクトリ責務

| ディレクトリ | 責務 |
|---|---|
| `src/app/(store)/` | 顧客向けページ（ホーム・商品閲覧・カート・チェックアウト・プロフィール） |
| `src/app/(auth)/` | Clerk認証ページ（sign-in・sign-up） |
| `src/app/dashboard/admin/` | 管理者ダッシュボード（カテゴリ・店舗管理） |
| `src/app/dashboard/seller/stores/[storeUrl]/` | 販売者ダッシュボード（商品・注文・クーポン・配送） |
| `src/app/api/` | APIルート（商品検索・Webhook） |
| `src/queries/` | **サーバーアクション・データ取得関数**（`"use server"` 付き） |
| `src/lib/` | 共有ユーティリティ（db.ts・schemas.ts・types.ts・utils.ts） |
| `src/components/ui/` | shadcn/ui コンポーネント群 |
| `src/components/dashboard/` | ダッシュボード固有UIコンポーネント |
| `src/components/store/` | 顧客向けUIコンポーネント |
| `src/components/shared/` | 全体共有コンポーネント |
| `src/cart-store/` | Zustandカートストア |
| `prisma/` | Prismaスキーマ・マイグレーション（`migrations/` 履歴付き） |
| `tests/e2e/` | Playwright E2Eテスト |
| `specs/` | SDD仕様書群（`specs/multi-vendor-ecommerce/` が主） |
| `docs/` | アーキテクチャ・マイグレーション記録 |
| `.claude/steering/` | チーム横断コンテキスト（本ファイル群） |
| `.agent/rules/` | Antigravity向けルール定義 |

## 重要な設計判断

- **サーバーアクションは `src/queries/` に集約**（`src/actions/` は存在しない）
- **入力バリデーションは `src/lib/schemas.ts` の Zod スキーマ**（フォームは React Hook Form + Zod resolver）
- **DBアクセスは `src/lib/db.ts` の Prisma シングルトン経由**
- **認証は Clerk middleware**（保護ルート: `/dashboard/*`, `/checkout`, `/profile/*`）

## パスエイリアス

```
@/*       → ./src/*
@/store   → ./src/components/store   （注意: @/cart-storeではない）
@/public/* → ./public/*
```

## データモデル（主要エンティティ）

`prisma/schema.prisma` の核心: **商品→バリアント→サイズ/カラー** の階層構造。

- `User` → `Store`（1:N）→ `Product`（1:N）→ `ProductVariant`（1:N）
- `ProductVariant` に価格・在庫・画像が紐づく（商品レベルではなくバリアントレベル）
- `Cart` → `CartItem` → `ProductVariant`（バリアント単位でカートに追加）
- `Order` → `OrderGroup`（店舗単位）→ `OrderItem`（バリアント単位）
- ロールは `enum Role { USER ADMIN SELLER }`

## 既知の制約

- `reactStrictMode: false`（`next.config.mjs`）
- Elasticsearch関連は現在コメントアウト（`src/lib/elastic-search.ts`）
- DB: PostgreSQL (Neon) + Prisma Accelerate。全文検索は `tsvector/tsquery`（`'simple'` トークナイザー）
- マイグレーション経緯: `docs/migration/` 参照
