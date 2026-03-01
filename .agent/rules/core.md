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
- **Server Actions のインポートと呼び出しに関する厳格なルール**
  - `src/queries/` はサーバー側クエリロジックの承認済みファサード（approved facade）です
  - ❌ **Client Component**: `src/queries/` を含むいかなる場所からも Server Actions を直接 import してはいけません。サーバーアクションの呼び出しは、Props（イベントハンドラー等）や API エンドポイントを経由して行う必要があります。
  - ✅ **Server Component**: `src/queries/` を経由して Server Actions を import し、呼び出すことが許可されています。
- データモデルは **バリアントレベル**（価格・在庫・画像は `ProductVariant` に紐づく）

## セキュリティ制約

- 保護されたアクションでは `currentUser()` とロールチェックが必要
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

## パスエイリアス（クイックリファレンス）

```
@/*        → ./src/*
@/store    → ./src/components/store  ※ @/cart-store ではない
@/public/* → ./public/*
```
