---
name: ec-db-migrator
description: |
  Multi-Vendor ECプロジェクトのデータベーススキーマ（prisma/schema.prisma）の変更、マイグレーション、シードデータの投入を行う際に使用する。
  「DBのスキーマを変更して」「マイグレーションを実行して」「Prismaの設定」「データベースの更新」といった指示が出た際に適用すること。
---

# データベースマイグレーションエキスパート

## Overview
Prisma ORM を使用した PostgreSQL (Neon) データベースのスキーマ設計、マイグレーション管理、およびデータシードを担当するスキルです。

## 開発規約 (Rules & Best Practices)

### 1. スキーマ定義 (`prisma/schema.prisma`)
- ✅ モデルを追加・修正する際は、既存の命名規則（PascalCaseのモデル名、camelCaseのフィールド名）に従うこと。
- ✅ リレーションを定義する際は、インデックスや外部キー制約を考慮し、パフォーマンスに悪影響を与えない設計にすること。
- ✅ 検索機能に関わるフィールド（例: `Product` の `searchVector`）では、PostgreSQL の `tsvector` 型と GIN インデックスを適切に設定すること。
- ✅ Prisma Client の機能拡張（`prisma-extension-accelerate`）を前提としたスキーマ設定を維持すること。

### 2. マイグレーション実行
- ❌ **禁止事項**: 開発環境において `bunx prisma db push` は安易に使用しないこと（本プロジェクトではマイグレーション履歴を管理するため）。
- ✅ **必須事項**: スキーマ変更後は基本的に `bunx prisma migrate dev --name <migration_name>` を使用してマイグレーションファイルを生成・適用すること。
- ✅ マイグレーション名は変更内容が明確にわかるケバブケース（例: `add-user-profile`）とすること。

### 3. データシードと運用
- ✅ 開発用の初期データやテストデータの投入には、必要に応じてシードスクリプト（例: `bun run seed:e2e` または `src/migration-scripts/` 内のスクリプト）を活用すること。
- ✅ クライアントの再生成が必要な場合は `bunx prisma generate` を実行すること。

## Step-by-Step Guide
1. **要件分析**: ユーザーの指示から、どのテーブル（モデル）にどのようなフィールドが必要かを特定する。
2. **スキーマ編集**: `prisma/schema.prisma` を修正する。
3. **検証**: スキーマの構文エラーがないか確認する。
4. **マイグレーション手順の提示**: スキーマ変更後、`bunx prisma migrate dev --name <migration_name>` を実行することをユーザーに提案する（または実行する）。
5. **クライアント更新**: 必要に応じて `bunx prisma generate` を実行し、TypeScriptの型を最新化する。
6. **コード修正への連携**: スキーマ変更に伴い影響を受ける `src/queries/` 内のサーバーアクションの修正案を提示する。
