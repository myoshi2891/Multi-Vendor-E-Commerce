---
name: ec-backend-expert
description: Backend implementation and fixes for multi-vendor e-commerce projects, including server actions, database and authentication.
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
- ✅ サーバーアクション内で実行権限が必要な場合、**`src/lib/auth-guards.ts`** のヘルパーを使うこと:
  - `requireUser()` — 認証必須 (USER / SELLER / ADMIN 問わず)
  - `requireAdmin()` — `role === "ADMIN"` のみ (グローバルリソース管理用: category / offer-tag 等)
  - `requireSeller()` — `role === "SELLER"` のみ (店舗 URL を介さない場合: 例 `deleteProduct` は `productId` 起点で `product.store.userId !== user.id` を別途インライン検証)
  - `requireStoreOwner(storeUrl)` — `role === "SELLER"` + `where: { url, userId }` 複合検索で **IDOR 防御を集約**。返り値 `{ user, store }` を再利用して後段の `findUnique` 重複呼び出しを避ける
- ❌ **禁止**: `currentUser()` + `if (!user) ...` / `if (role !== "...") ...` のインライン展開を新規追加すること（[`.claude/steering/tech.md`](../../../.claude/steering/tech.md) "認可ガード" 項）。既存のインライン展開を見つけた場合は同セッションで auth-guards に置換することを推奨。
- ✅ 失敗系は `throw new Error("...")` で表現する（`src/queries/*` の既存実装は `{ success, error }` ラッパーを使わない throw ベース）。
- ✅ IDOR テストは 3 階層 (a) スロー検証 / (b) `where: { url, userId }` 構造検証 / (c) ガード失敗時の副作用なし検証 を必ず揃える（[`docs/testing/SECURITY_GAP_REPORT.md §5.2`](../../../docs/testing/SECURITY_GAP_REPORT.md)）。

## Step-by-Step Guide
1. **DBモデルの確認**: 実装前に必ず `prisma/schema.prisma` を確認し、データ構造とリレーションを把握する。
2. **アクションの設計**: `src/queries/` 内のどのドメインファイルに処理を追加・修正するかを決定する。
3. **認可ガードの選択**: 上記 §4 のヘルパー一覧から該当するものを選び、関数冒頭で 1 回だけ呼び出す。
4. **実装**: 型安全（TypeScript）に配慮し、Prismaを用いた効率的なクエリ（N+1問題の回避など）を記述する。
5. **検証**: 必要なバリデーション（`src/lib/schemas.ts` の Zodスキーマ利用など）がサーバー側で行われているか確認する。
6. **テスト追加**: IDOR 3 階層パターン (a)(b)(c) を満たすテストを `src/queries/XXX.test.ts` に追加する。詳細は [`server-action-scaffold` skill](../../../.claude/skills/server-action-scaffold/SKILL.md) のテストテンプレートを参照。
