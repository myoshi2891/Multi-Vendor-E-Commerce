---
activation: always
---

# Core Rules — Multi-Vendor E-Commerce

## プロジェクト概要
Next.js 14 (App Router) + TypeScript + Prisma (PostgreSQL) + Clerk認証 + Stripe/PayPal決済のマルチベンダーEコマースマーケットプレイス。

## アーキテクチャ制約

- **サーバーアクションは `src/queries/` に集約**（`src/actions/` は存在しない）
- **入力バリデーションは `src/lib/schemas.ts` の Zod スキーマ**（フォームは React Hook Form + Zod resolver）
- **DBアクセスは `src/lib/db.ts` の Prisma シングルトン経由**（`new PrismaClient()` は禁止）
- **認証は Clerk middleware**（保護ルートは `/dashboard/*`, `/checkout`, `/profile/*`）
- **Client Component は Server Actions を直接 import しないこと**（`src/queries/` を使用）
  - `src/queries/` はサーバー側クエリロジックの承認済みファサード（approved facade）です
  - ✅ 【Allowed】 Server Component -> `src/queries/` -> server action
  - ❌ 【Disallowed】 Client Component -> server action の直接 import
- データモデルは **バリアントレベル**（価格・在庫・画像は `ProductVariant` に紐づく）

## セキュリティ制約

- 保護されたアクションでは `currentUser()` とロールチェックが必要
- 外部呼び出し（Prisma・Clerk・Stripe/PayPal）は `try/catch` でラップ
- シークレット・APIキーは `.env` にのみ記述、コミット禁止

## 禁止操作

- `console.log()` のコミット（レビュー前に削除必須）
- `bunx prisma db push` を本番相当環境で使用（`migrate dev` を使う）
- `migrations/` 配下の既存ファイルを編集する
- 本番DBへの `DELETE`/`DROP` を人間の確認なしに実行する
- `reactStrictMode` の変更（`next.config.mjs` で `false` に設定済み）

## SDD仕様書参照ルール

新機能を実装する前に必ず以下の順序で確認すること：

1. `specs/multi-vendor-ecommerce/00-overview.md` — プロダクトスコープ確認
2. `specs/multi-vendor-ecommerce/01-requirements.md` — 機能・非機能要件確認
3. `specs/multi-vendor-ecommerce/02-architecture.md` — アーキテクチャ制約確認
4. `specs/multi-vendor-ecommerce/03-data-model.md` — データモデル確認
5. `specs/multi-vendor-ecommerce/07-testing.md` — テスト方針確認

実装後は仕様書との乖離がないか確認し、乖離があれば人間に報告する。

## エージェント行動方針

- コードを一行も書く前に Implementation Plan を生成し、ユーザーに確認を求める
- 不確実な場合は実装前に確認（"Always Proceed" 禁止）
- git commit はタスク単位で細かく行う

## パスエイリアス（クイックリファレンス）

```
@/*        → ./src/*
@/store    → ./src/components/store  ※ @/cart-store ではない
@/public/* → ./public/*
```
