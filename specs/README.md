# Spec Directory — AI 仕様駆動開発 (SDD)

このディレクトリは仕様書群を管理します。**AIエージェントはコードを一行も書く前に該当する仕様書を確認すること。**

> `specs/multi-vendor-ecommerce/` が **Single Source of Truth** です。コードと仕様書が乖離した場合は、AIエージェントが人間に報告し、どちらを修正するかを人間が判断します。

---

## 仕様書一覧（`specs/multi-vendor-ecommerce/`）

| ファイル | 内容 |
|---------|------|
| `00-overview.md` | プロダクトスコープ・アクター・システム概要 |
| `01-requirements.md` | 機能要件・非機能要件・スコープ外 |
| `02-architecture.md` | アーキテクチャ制約・技術選定理由 |
| `03-data-model.md` | データモデル・主要エンティティ・ER 概要 |
| `04-interfaces.md` | API・UI インターフェース定義 |
| `05-workflows.md` | ユーザーフロー・業務フロー |
| `06-quality.md` | 品質基準・非機能要件詳細 |
| `07-testing.md` | テスト方針・テスト種別・カバレッジ要件 |
| `08-open-questions.md` | 未解決事項・議論中の設計課題 |

---

## 新機能追加時のワークフロー

```
1. 00-overview でスコープ確認（スコープ外でないか）
2. 01-requirements に新要件を追記
3. 03-data-model を更新（スキーマ変更がある場合）
4. feature-plan スキルで Implementation Plan を生成・ユーザーが承認
5. 実装 → テスト → spec-sync-check スキルで乖離チェック
```

### AI エージェントの仕様書読み順

| ステップ | ファイル | 確認内容 |
|---------|---------|---------|
| 1 | `00-overview.md` | プロダクトスコープの境界・スコープ外の確認 |
| 2 | `01-requirements.md` | 対象機能の要件と Acceptance Criteria |
| 3 | `02-architecture.md` | アーキテクチャ制約の違反がないか |
| 4 | `03-data-model.md` | スキーマ変更が必要か |
| 5 | `07-testing.md` | テスト要件の確認（実装前に把握） |

---

## 更新ルール

| ルール | 内容 |
|--------|------|
| **コードとの同期** | コードが変わったら対応する仕様書も必ず更新する（乖離がプロジェクト品質劣化の原因） |
| **ファイル名** | 変更しない。新しいセクションは末尾に追記する |
| **未解決事項** | `08-open-questions.md` に記録し、人間にエスカレーションする |
| **乖離の報告** | 実装と仕様が乖離した場合は AI エージェントが人間に報告する（自動修正しない） |

---

## 実装アンカー（主要ファイル）

| ファイル | 対応する仕様書 |
|---------|-------------|
| `prisma/schema.prisma` | `03-data-model.md` |
| `src/app/` | `05-workflows.md` |
| `src/queries/` | `04-interfaces.md` |
| `src/lib/schemas.ts` | `04-interfaces.md` |
| `src/cart-store/useCartStore.ts` | `05-workflows.md` |
| `docs/testing/TESTING_DESIGN.md` | `docs/testing/07-testing.md` |
| `docs/testing/QA_TEST_PERSPECTIVES.md` | `docs/testing/07-testing.md` / `docs/testing/06-quality.md` |
