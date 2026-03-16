---
name: ec-backend-expert
description: |
  Multi-Vendor ECプロジェクトのバックエンド（サーバーアクション、データベース、認証）の実装や修正を行う際に使用する。
  「DBに保存して」「APIを作って」「バックエンドの処理」「サーバーアクション」といった指示が出た際に適用すること。
---

# バックエンド開発エキスパート

## Overview
Next.js Server Actions、Prisma (PostgreSQL)、Clerk認証を使用したサーバーサイドのビジネスロジックやデータアクセスの開発・修正を担当するスキルです。

## 開発規約 (Rules & Best Practices)

### 1. サーバーアクション (Server Actions)
- ❌ **禁止事項**: `src/actions/` ディレクトリは絶対に作成・使用しないこと。
- ✅ **必須事項**: すべてのサーバーアクションは `src/queries/` ディレクトリ配下のドメイン固有ファイル（例: `product.ts`, `user.ts`, `store.ts`）に配置すること。
- ✅ ファイルの先頭、または関数のスコープ内で `"use server"` ディレクティブを明記すること。
- ✅ CRUD操作とデータ取得ロジックは、ドメインごとに同じファイルに同置（コロケーション）すること。

### 2. データアクセス (Database & Prisma)
- ✅ データベースアクセスには、必ず `src/lib/db.ts` からエクスポートされた Prisma クライアントを使用すること。
- ✅ **金額・数値精度**: 金額を扱う際は `Float` を使用せず、`Prisma.Decimal` を使用すること。演算は `.add()`, `.mul()`, `.sub()`, `.div()` メソッドを使い、浮動小数点誤差を避けること。
- ✅ **アトミック操作**: 注文作成、在庫更新、ポイント付与などの複数テーブル更新は、必ず `db.$transaction` でラップしアトミック性を保証すること。
- ✅ Prisma Client は `withAccelerate()` 拡張を使用している前提でコードを書くこと。

### 3. エラーハンドリング・ログ
- ✅ すべての外部 API（Clerk, Stripe/PayPal）や DB 呼び出しは `try/catch` でラップすること。
- ✅ **構造化ログ**: `src/queries/` 内の `console.error` は `[Module:Function] Message` 形式のプレフィックスを付け、エラーメッセージとスタックを構造化データとして記録すること。
- ✅ 型ガード `if (error instanceof Error)` を用いて安全にエラーメッセージへアクセスすること。

### 4. 認証・アクセス制御
- ✅ 保護されたルート（`/dashboard/*`, `/checkout`, `/profile/*`）のアクセス制御は、基本的に `src/middleware.ts` (Clerk) で行われている。
- ✅ サーバーアクション内で実行権限が必要な場合、`currentUser()` 等を利用して適切にロール（USER, SELLER, ADMIN）を検証し、不正なデータアクセスを防ぐこと。

## Step-by-Step Guide
1. **DBモデルの確認**: 実装前に必ず `prisma/schema.prisma` を確認し、データ構造とリレーションを把握する。
2. **アクションの設計**: `src/queries/` 内のどのドメインファイルに処理を追加・修正するかを決定する。
3. **実装**: 型安全（TypeScript）に配慮し、Prismaを用いた効率的なクエリ（N+1問題の回避など）を記述する。
4. **検証**: 必要なバリデーション（`src/lib/schemas.ts` の Zodスキーマ利用など）がサーバー側で行われているか確認する。
