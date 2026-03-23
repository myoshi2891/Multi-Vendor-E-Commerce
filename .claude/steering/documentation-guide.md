# Documentation Management Guide

このドキュメントは、プロジェクトのドキュメント配置ルールとベストプラクティスを定義します。

---

## ドキュメント体系の概要

プロジェクトは **4層構造** のドキュメント体系を持っています：

| レイヤー | ディレクトリ | 役割 | 更新頻度 |
|---------|------------|------|---------|
| **Layer 1: 永続メモリ** | `root/`, `.claude/` | セッション間の要点・プロジェクト設定 | 高 |
| **Layer 2: チーム規約** | `.claude/steering/` | チーム全体で共有する不変ルール | 低（破壊的変更時のみ） |
| **Layer 3: SDD（仕様駆動開発）** | `specs/multi-vendor-ecommerce/` | Single Source of Truth | 中（機能追加時） |
| **Layer 4: 実装ガイド・履歴** | `docs/` | 設計決定・移行履歴・テスト戦略 | 中 |

---

## 配置ルール: Decision Tree

新しい設計決定や実装パターンを記録する際は、以下の判断基準に従ってください：

```
新しい設計決定・実装パターンが発生
  │
  ├─ Q1: これは全プロジェクトで不変のルールか？
  │   └─ YES → `.claude/steering/tech.md` に追記
  │       例: TypeScript strict mode、`any` 禁止、金額フィールドは Decimal 必須
  │
  ├─ Q2: これは機能仕様の一部か？
  │   └─ YES → `specs/multi-vendor-ecommerce/` の該当ファイルに追記
  │       - 品質基準・セキュリティ → `06-quality.md`
  │       - データモデル・制約 → `03-data-model.md`
  │       - テスト方針 → `07-testing.md`
  │
  ├─ Q3: これは実装の詳細な手順・パターンか？
  │   └─ YES → `docs/testing/TESTING_DESIGN.md` または関連ドキュメントに追記
  │       例: E2E ヘルパー関数パターン、環境変数処理パターン
  │
  ├─ Q4: これは過去の技術選定・移行の理由か？
  │   └─ YES → `docs/migration/` または `docs/architecture/decisions/` に新規ファイル作成
  │       例: MySQL → PostgreSQL 移行、Elasticsearch → tsvector 移行
  │
  └─ Q5: それ以外（進捗・一時的な記録）
      └─ YES → `PROGRESS.md` に追記（定期的にアーカイブ）
```

---

## 各ドキュメントの責務

### Layer 1: 永続メモリ

| ファイル | 責務 | 記録すべき内容 |
|---------|------|---------------|
| `CLAUDE.md` | プロジェクト手順・コマンド集 | 開発コマンド、アーキテクチャ概要、コーディング規約へのリンク |
| `README.md` | プロジェクト概要 | 技術スタック、セットアップ手順、デプロイ手順 |
| `PROGRESS.md` | 進捗・一時的な決定 | 実装ログ、TODO、一時的な問題と解決策 |

### Layer 2: チーム規約

| ファイル | 責務 | 記録すべき内容 |
|---------|------|---------------|
| `.claude/steering/product.md` | プロダクトビジョン | ペルソナ、KPI、スコープ |
| `.claude/steering/tech.md` | 技術制約・実装パターン | TypeScript規約、禁止事項、実装パターン例 |
| `.claude/steering/structure.md` | ディレクトリ責務 | 重要な設計判断、データモデル |
| `.claude/steering/documentation-guide.md` | ドキュメント管理ルール | このファイル |

### Layer 3: SDD（仕様駆動開発）

| ファイル | 責務 | 記録すべき内容 |
|---------|------|---------------|
| `specs/*/03-data-model.md` | データモデル | ER図、スキーマ、エンティティ、制約 |
| `specs/*/06-quality.md` | 品質基準 | セキュリティ、パフォーマンス、データ整合性 |
| `specs/*/07-testing.md` | テスト方針 | テスト階層、カバレッジ要件 |
| `specs/*/08-open-questions.md` | 未解決課題 | 既知問題、解決済み問題 |

### Layer 4: 実装ガイド・履歴

| ディレクトリ | 責務 | 記録すべき内容 |
|------------|------|---------------|
| `docs/architecture/decisions/` | **ADR（Architecture Decision Records）** | **技術選定理由、代替案比較、トレードオフ** |
| `docs/migration/` | DB移行履歴 | 互換性マトリックス、移行手順、環境構築 |
| `docs/testing/` | テスト設計詳細 | E2E ヘルパー関数、環境変数処理、テストインフラ |

---

## ADR（Architecture Decision Records）作成基準

以下の条件を**すべて**満たす場合のみ、`docs/architecture/decisions/` に新規 ADR ファイルを作成してください：

### 必須条件（すべて満たす）

1. ✅ **複数の代替案を比較検討した**
   - 例: MySQL vs PostgreSQL、Redis vs Zustand

2. ✅ **チーム全体に影響する技術選定**
   - 個別コンポーネントの実装詳細は除外

3. ✅ **将来の技術選定時に参照価値がある**
   - 一時的な workaround は除外

4. ✅ **トレードオフが将来の開発に影響する**
   - 例: パフォーマンス vs 保守性

### ADR に含めるべき要素（MADR 形式）

```markdown
# [番号]. [決定のタイトル]

- **Status**: Accepted / Rejected / Deprecated / Superseded
- **Date**: YYYY-MM-DD
- **Deciders**: [決定者名]

## Context

何が問題で、なぜこの決定が必要だったか。

## Decision

何を決定したか。

## Alternatives Considered

1. **Option A**: 説明
   - メリット: ...
   - デメリット: ...

2. **Option B**: 説明
   - メリット: ...
   - デメリット: ...

## Consequences

### Positive
- 利点1
- 利点2

### Negative
- トレードオフ1
- トレードオフ2

## Related
- 関連 ADR: [ADR-002](002-xxx.md)
- 関連コミット: `abc123f`
```

### ADR テンプレート

[`docs/architecture/decisions/template.md`](../../docs/architecture/decisions/template.md) を使用してください。

---

## 既存ドキュメントへの追記例

### 例1: 新しい実装パターンを発見した場合

**シナリオ**: E2E テストで新しいヘルパー関数パターンを導入した

**判断プロセス**:
- Q1: 不変のルールか？ → No（テスト実装の詳細）
- Q2: 機能仕様の一部か？ → No
- Q3: 実装の詳細なパターンか？ → **Yes**

**配置先**: `docs/testing/TESTING_DESIGN.md`

**追記内容**:

```markdown
### New Helper Pattern: Multi-Step Navigation

E2E tests can use multi-step navigation helpers:

\`\`\`typescript
async function navigateToCheckout(page: Page) {
  await addItemToCart(page, productSlug, variantSlug);
  await page.getByTestId("checkout").click();
  await page.waitForURL(/\/checkout/);
}
\`\`\`
```

### 例2: 新しいセキュリティ対策を実装した場合

**シナリオ**: CSRFトークン検証を追加した

**判断プロセス**:
- Q1: 不変のルールか？ → No（セキュリティ対策は機能要件の一部）
- Q2: 機能仕様の一部か？ → **Yes**（セキュリティ基準）

**配置先**: `specs/multi-vendor-ecommerce/06-quality.md`

**追記内容**:

```markdown
## Security

- CSRF protection: Server actions validate CSRF tokens on state-mutating operations.
  Implementation: `src/lib/csrf.ts`
```

### 例3: 大規模技術変更を検討している場合

**シナリオ**: Redis 導入を検討（Zustand との比較あり）

**判断プロセス**:
- Q1-Q3: No
- Q4: 過去の技術選定か？ → **Yes**（代替案比較あり）

**配置先**: `docs/architecture/decisions/00X-redis-adoption.md`（新規ADR作成）

**内容**:

```markdown
# 00X. Redis Adoption for Session Management

- **Status**: Under Review
- **Date**: 2026-XX-XX
- **Deciders**: Team

## Context

現在の Zustand ベースのクライアント状態管理では、セッション永続化が不十分...

## Alternatives Considered

1. **Option A: Redis** - サーバーサイドセッション管理
2. **Option B: Zustand + localStorage** - 現状維持

（以下略）
```

---

## 実装パターン vs ADR の判断

| 項目 | 実装パターン例（tech.md） | ADR（decisions/） |
|-----|------------------------|------------------|
| 配送料計算の中央集約 | ✅ tech.md に記載済み | ❌ ADR 不要（実装詳細） |
| リエントランシーガード | ✅ tech.md に記載済み | ❌ ADR 不要（実装詳細） |
| MySQL → PostgreSQL 移行 | ❌ 不適切 | ✅ ADR 推奨（技術選定） |
| Redis 導入検討 | ❌ 不適切 | ✅ ADR 推奨（代替案比較あり） |

**原則**: 実装の How（どう実装するか）は `tech.md`、技術選定の Why（なぜ選んだか）は ADR。

---

## ドキュメント間の参照関係

```
README.md（トップ）
  ↓ 参照
  ├→ CLAUDE.md（コマンド集）
  │   ├→ .claude/steering/*（ルール）
  │   └→ specs/README.md（仕様読み順）
  │
  ├→ specs/multi-vendor-ecommerce/（SDD）
  │   └→ docs/testing/*.md（テスト詳細）
  │
  └→ docs/architecture/（履歴）
      ├→ decisions/（ADR）
      └→ saas-roadmap.md（ロードマップ）
```

---

## ベストプラクティス

### ✅ 推奨

1. **小さく始める**: 最初は既存ドキュメントに追記、大規模変更時のみ ADR
2. **コミットハッシュを記録**: 変更内容に関連するコミットを明記
3. **定期的なレビュー**: 3-6ヶ月ごとにドキュメントの鮮度を確認
4. **Git 履歴を活用**: `git log` で補完できる情報は過度に記録しない

### ❌ 避けるべき

1. **過剰な文書化**: 実装の詳細すぎる記録（コード自身が documentation）
2. **ADR の乱用**: 小さな実装判断で ADR を作成しない
3. **重複記録**: 同じ情報を複数の場所に記録しない
4. **古い情報の放置**: 実装と乖離したドキュメントは削除または更新

---

## 関連ドキュメント

- [`CLAUDE.md`](../../CLAUDE.md) - プロジェクト手順・コマンド集
- [`.claude/steering/tech.md`](tech.md) - 技術制約と実装パターン
- [`specs/multi-vendor-ecommerce/`](../../specs/multi-vendor-ecommerce/) - 機能仕様書
- [`docs/architecture/decisions/`](../../docs/architecture/decisions/) - ADR
- [`docs/testing/TESTING_DESIGN.md`](../../docs/testing/TESTING_DESIGN.md) - テスト設計
