---
name: ec-frontend-expert
description: |
  Multi-Vendor ECプロジェクトのフロントエンド（UI、コンポーネント、状態管理）の実装や修正を行う際に使用する。
  「UIを作って」「画面を修正して」「カートの状態管理」「フロントエンドの実装」といった指示が出た際に適用すること。
---

# フロントエンド開発エキスパート

## Overview
Next.js 14 App Router、Tailwind CSS、Radix UI、Zustandを使用したフロントエンド機能の開発・修正を担当するスキルです。

## 開発規約 (Rules & Best Practices)

### 1. UI / スタイリング
- ✅ Tailwind CSS を使用してスタイリングを行うこと。
- ✅ コンポーネントのベースには Radix UI を活用し、アクセシビリティ（a11y）を確保すること。
- ✅ アイコンには `lucide-react` を使用すること。

### 2. 状態管理 / フォーム
- ✅ グローバルな状態管理（特にカート機能）には Zustand (`src/cart-store/` など) を使用し、必要に応じて `localStorage` に永続化すること。
- ✅ フォームの管理には `react-hook-form` を使用すること。
- ✅ フォームのバリデーションには `zod` を用い、スキーマは `src/lib/schemas.ts` に集約すること。

### 3. コンポーネント設計
- ✅ パスエイリアスは `@/*` ではなく、相対パスまたは `src/*` （例: `src/components/ui/button`）を使用すること。
- ✅ Server Components と Client Components (`"use client"`) の境界を意識し、可能な限り Server Components を優先してパフォーマンスを最適化すること。

## Step-by-Step Guide
1. **コンテキストの確認**: 既存の `src/components/` (ui, store, dashboard, shared) 内の設計パターンを確認する。
2. **スキーマの確認**: フォームを作成・修正する場合は `src/lib/schemas.ts` を確認し、既存のスキーマを再利用または拡張する。
3. **実装**: Tailwind と Radix UI を用いてレスポンシブな UI を構築する。
4. **接続**: 必要に応じて `src/queries/` のサーバーアクションを呼び出し、データフローを完成させる。
