# Spec Directory — AI仕様駆動開発 (SDD)

このディレクトリは仕様書群を管理します。AIエージェントは**コードを一行も書く前**に該当する仕様書を確認すること。

## 仕様書一覧 (`specs/multi-vendor-ecommerce/`)

| ファイル | 内容 |
|---|---|
| `00-overview.md` | プロダクトスコープ・アクター・システム概要 |
| `01-requirements.md` | 機能要件・非機能要件・スコープ外 |
| `02-architecture.md` | アーキテクチャ制約・技術選定理由 |
| `03-data-model.md` | データモデル・主要エンティティ・ER概要 |
| `04-interfaces.md` | API・UI インターフェース定義 |
| `05-workflows.md` | ユーザーフロー・業務フロー |
| `06-quality.md` | 品質基準・非機能要件詳細 |
| `07-testing.md` | テスト方針・テスト種別・カバレッジ要件 |
| `08-open-questions.md` | 未解決事項・議論中の設計課題 |

## AIエージェント向け読み順

新機能を実装する前に以下の順序で確認すること:

1. `00-overview.md` → プロダクトスコープの境界を把握
2. `01-requirements.md` → 対象機能の要件とAcceptance Criteriaを確認
3. `02-architecture.md` → アーキテクチャ制約（違反しないか確認）
4. `03-data-model.md` → スキーマ変更が必要か確認
5. `07-testing.md` → テスト要件を確認してから実装

## 更新ルール

1. コードが変わったら対応する仕様書も必ず更新する（コードとspecの乖離がプロジェクト品質劣化の原因）
2. ファイル名は変更しない。新しいセクションを末尾に追記する
3. `08-open-questions.md` に未解決事項を記録し、人間にエスカレーションする
4. 実装と仕様が乖離した場合はAIエージェントが人間に報告する

## 実装アンカー（主要ファイル）

- `prisma/schema.prisma` — データモデルの実装
- `src/app/` — ページ・ルート
- `src/queries/` — サーバーアクション・データ取得関数
- `src/cart-store/useCartStore.ts` — カート状態管理
- `src/lib/schemas.ts` — バリデーションスキーマ
- `TESTING_DESIGN.md` — テスト設計詳細

## 新機能追加時のワークフロー

```
1. 00-overview で スコープ確認
2. 01-requirements に新要件を追記
3. 03-data-model を更新（スキーマ変更がある場合）
4. AIエージェントに Implementation Plan を生成させる
5. ユーザーがレビュー・承認
6. 実装 → テスト → 仕様書の乖離チェック
```
