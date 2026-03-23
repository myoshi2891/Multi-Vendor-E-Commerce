# Architecture Documentation

このディレクトリには、プロジェクトのアーキテクチャに関する重要なドキュメントが含まれています。

---

## Contents

- [`saas-roadmap.md`](saas-roadmap.md) - 将来のマルチテナント化ロードマップ
- [`decisions/`](decisions/) - Architecture Decision Records (ADR)

---

## ADR について

ADR（Architecture Decision Records）は、大規模な技術選定や設計変更の際に作成する意思決定記録です。

### いつ ADR を作成するか

以下の条件を**すべて**満たす場合のみ、ADR を作成してください：

1. ✅ 複数の代替案を比較検討した
2. ✅ チーム全体に影響する技術選定
3. ✅ 将来の技術選定時に参照価値がある
4. ✅ トレードオフが将来の開発に影響する

詳細は [`decisions/README.md`](decisions/README.md) を参照してください。

### ADR を作成しない場合

以下は ADR ではなく、既存ドキュメントに追記してください：

- **実装パターン・コーディング規約** → [`.claude/steering/tech.md`](../../.claude/steering/tech.md)
- **セキュリティ・品質基準** → [`specs/multi-vendor-ecommerce/06-quality.md`](../../specs/multi-vendor-ecommerce/06-quality.md)
- **テスト設計パターン** → [`docs/testing/TESTING_DESIGN.md`](../testing/TESTING_DESIGN.md)

---

## 関連ドキュメント

### ドキュメント管理ルール
- [`.claude/steering/documentation-guide.md`](../../.claude/steering/documentation-guide.md) - ドキュメント配置ルールとベストプラクティス

### 仕様書
- [`specs/multi-vendor-ecommerce/`](../../specs/multi-vendor-ecommerce/) - 機能仕様書（SDD）

### 実装ガイド
- [`docs/migration/`](../migration/) - DB 移行履歴
- [`docs/testing/`](../testing/) - テスト設計とプラン

---

## 現在のアーキテクチャ概要

詳細は [`README.md`](../../README.md) を参照してください。

**技術スタック**:
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js Server Actions + Prisma ORM
- **Database**: PostgreSQL (Neon) + Prisma Accelerate
- **Authentication**: Clerk
- **Payment**: Stripe / PayPal

**主要な設計判断**:
- サーバーアクションは `src/queries/` に集約
- 金額フィールドは `Decimal(12,2)` で精度保証
- トランザクションは `db.$transaction` で原子性保証
- 全文検索は PostgreSQL の `tsvector/tsquery`
