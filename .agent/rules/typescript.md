---
activation: fileMatch
pattern: "**/*.ts,**/*.tsx"
---

# TypeScript & React/Next.js Coding Standards

## TypeScript 基本ルール

- `strict: true` モード必須（`tsconfig.json` 設定済み）
- `any` 型の使用禁止（型推論または適切な型定義を使用）
- `unknown` を使う場合は必ず型ガードで絞り込む
- 型アサーション (`as`) は最小限に留め、理由をコメントで明記
- インターフェースよりも型エイリアス (`type`) を優先（拡張が必要な場合のみ `interface`）

## React / Next.js 規約

- Server Components がデフォルト。クライアントが必要な場合のみ `"use client"` を付与
- `"use server"` ディレクティブは `src/queries/` 配下のファイルに限定
- データフェッチは Server Component で行う（`useEffect` でのデータフェッチは禁止）
- フォームハンドリング: React Hook Form + Zod resolver を使用
- エラーバウンダリは `error.tsx` で実装

## コンポーネント設計

- Props の型は必ず明示的に定義する（インライン型は可）
- デフォルトエクスポートはページコンポーネントのみ（その他は名前付きエクスポート）
- shadcn/ui コンポーネントを活用し、独自スタイリングには Tailwind CSS を使用
- Tailwind クラスの順序は `tailwindcss/classnames-order` の lint ルールに従う

## Prisma / DB クエリ

- Prisma クライアントは `src/lib/db.ts` のシングルトンのみ使用
- N+1 クエリを避ける（`include` / `select` で必要なデータのみ取得）
- 全ての DB 操作は `try/catch` でラップし、適切なエラーハンドリングを行う

## テスト規約 (TypeScript ファイル)

- Jest ユニットテスト: `src/queries/*.test.ts` に配置
- テストファイルは `.test.ts` または `.test.tsx` の拡張子を使用
- `@testing-library/jest-dom` と `@testing-library/react` を使用
- MSW (Mock Service Worker) でAPIモックを行う（セットアップ: `tests-setup/`）

## インポート順序

1. React / Next.js
2. 外部ライブラリ（npm packages）
3. 内部ユーティリティ（`@/lib/*`）
4. コンポーネント（`@/components/*`）
5. 型定義
6. 相対インポート
