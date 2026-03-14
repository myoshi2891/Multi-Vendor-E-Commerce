# Project Structure

## ディレクトリ責務

| ディレクトリ | 責務 |
|------------|------|
| `src/app/(store)/` | 顧客向けページ（ホーム・商品閲覧・カート・チェックアウト・プロフィール） |
| `src/app/(auth)/` | Clerk 認証ページ（sign-in・sign-up） |
| `src/app/dashboard/admin/` | 管理者ダッシュボード（カテゴリ・店舗管理） |
| `src/app/dashboard/seller/stores/[storeUrl]/` | 販売者ダッシュボード（商品・注文・クーポン・配送） |
| `src/app/api/` | API ルート（商品検索・Webhook） |
| `src/queries/` | **サーバーアクション・データ取得関数**（`"use server"` 付き） |
| `src/lib/` | 共有ユーティリティ（`db.ts` / `schemas.ts` / `types.ts` / `utils.ts`） |
| `src/components/ui/` | shadcn/ui コンポーネント群 |
| `src/components/dashboard/` | ダッシュボード固有 UI コンポーネント |
| `src/components/store/` | 顧客向け UI コンポーネント |
| `src/components/shared/` | 全体共有コンポーネント |
| `src/cart-store/` | Zustand カートストア |
| `prisma/` | Prisma スキーマ・マイグレーション（`migrations/` 履歴付き） |
| `src/config/` | テスト共通インフラ（ファクトリ・ヘルパー・シナリオ・定数） |
| `tests/e2e/` | Playwright E2E テスト |
| `specs/` | SDD 仕様書群（`specs/multi-vendor-ecommerce/` が主） |
| `docs/` | アーキテクチャ・マイグレーション・テスト設計記録 |
| `.claude/steering/` | チーム横断コンテキスト（本ファイル群） |
| `.agent/rules/` | エージェント向けルール定義 |

---

## 重要な設計判断

> 新機能実装前に必ず確認してください。違反すると既存テストが壊れます。

| 判断 | 内容 |
|-----|------|
| **サーバーアクションの配置** | `src/queries/` に集約する（`src/actions/` は存在しない） |
| **入力バリデーション** | `src/lib/schemas.ts` の Zod スキーマを使用する（フォームは React Hook Form + Zod resolver） |
| **DB アクセス** | `src/lib/db.ts` の Prisma シングルトン経由のみ（`new PrismaClient()` は禁止） |
| **認証** | Clerk middleware を使用する（保護ルート: `/dashboard/*` / `/checkout` / `/profile/*`） |

---

## パスエイリアス

```
@/*        → ./src/*
@/store    → ./src/components/store   ※ @/cart-store ではない
@/public/* → ./public/*
```

---

## データモデル（主要エンティティ）

`prisma/schema.prisma` の核心は **商品 → バリアント → サイズ / カラー** の階層構造です。

```
User (1) ──→ (N) Store (1) ──→ (N) Product (1) ──→ (N) ProductVariant
                                                              │
                                              価格・在庫・画像はバリアントレベルに紐づく
                                              （商品レベルではない）

Cart (1) ──→ (N) CartItem ──→ ProductVariant   ← バリアント単位でカートに追加
Order (1) ──→ (N) OrderGroup（店舗単位）──→ (N) OrderItem（バリアント単位）

enum Role { USER  ADMIN  SELLER }
```

---

## 既知の制約

| 項目 | 内容 |
|-----|------|
| `reactStrictMode` | `false`（`next.config.mjs`） |
| Elasticsearch | 現在コメントアウト中（`src/lib/elastic-search.ts`） |
| DB | PostgreSQL (Neon) + Prisma Accelerate。全文検索は `tsvector/tsquery`（`'simple'` トークナイザー） |
| マイグレーション経緯 | `docs/migration/` 参照 |
