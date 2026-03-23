# Architecture Decision Records (ADR)

このディレクトリには、プロジェクトの重要な技術選定と設計決定の記録（ADR）が含まれています。

---

## ADR とは

ADR（Architecture Decision Records）は、以下の要素を含むドキュメントです：

- **Context**: なぜこの決定が必要だったか
- **Decision**: 何を決定したか
- **Alternatives**: 検討した代替案とそのトレードオフ
- **Consequences**: 決定による影響（利点・欠点）

---

## いつ ADR を作成するか

以下の条件を**すべて**満たす場合のみ、新規 ADR を作成してください：

### 必須条件

1. ✅ **複数の代替案を比較検討した**
   - 例: MySQL vs PostgreSQL、Redis vs Zustand

2. ✅ **チーム全体に影響する技術選定**
   - 個別コンポーネントの実装詳細は除外

3. ✅ **将来の技術選定時に参照価値がある**
   - 一時的な workaround は除外

4. ✅ **トレードオフが将来の開発に影響する**
   - 例: パフォーマンス vs 保守性

### ADR を作成しない場合

以下は ADR ではなく、既存ドキュメントに追記してください：

| ケース | 配置先 |
|-------|--------|
| 実装パターン・コーディング規約 | [`.claude/steering/tech.md`](../../../.claude/steering/tech.md) |
| セキュリティ・品質基準 | [`specs/multi-vendor-ecommerce/06-quality.md`](../../../specs/multi-vendor-ecommerce/06-quality.md) |
| テスト設計パターン | [`docs/testing/TESTING_DESIGN.md`](../../testing/TESTING_DESIGN.md) |
| DB 移行手順 | [`docs/migration/`](../../migration/) |

---

## ADR の作成方法

### Step 1: テンプレートをコピー

```bash
cp docs/architecture/decisions/template.md docs/architecture/decisions/00X-your-decision-title.md
```

### Step 2: 番号の決定

- 既存の ADR ファイルを確認し、次の番号を使用
- 例: 既に `001-xxx.md`、`002-yyy.md` が存在する場合、`003-zzz.md` を作成

### Step 3: 内容の記入

テンプレートの各セクションを埋めてください：

- **Status**: Accepted / Rejected / Deprecated / Superseded
- **Date**: 決定日（YYYY-MM-DD）
- **Deciders**: 決定に関与した人々
- **Context**: 背景・問題
- **Decision**: 決定内容
- **Alternatives Considered**: 代替案とトレードオフ
- **Consequences**: 決定による影響

### Step 4: このREADMEを更新

新しい ADR を作成したら、下の「ADR 一覧」セクションにエントリを追加してください。

---

## ADR 一覧

| 番号 | タイトル | ステータス | 決定日 |
|-----|---------|----------|--------|
| - | （現在 ADR なし） | - | - |

<!--
### 将来の ADR 候補

以下は、将来的に ADR 化が推奨される技術選定です（現時点では `docs/migration/` や既存ドキュメントに記録済み）：

1. **MySQL → PostgreSQL 移行** - 現在: `docs/migration/`
2. **Prisma Accelerate 導入** - 現在: `PROGRESS.md` + `README.md`
3. **tsvector/tsquery 全文検索** - 現在: `README.md`

必要に応じて、これらを ADR 化してください。
-->

---

## ADR のライフサイクル

### Status の意味

| Status | 説明 | 次のアクション |
|--------|------|---------------|
| **Proposed** | 提案段階（レビュー待ち） | チームレビュー後、Accepted または Rejected に更新 |
| **Accepted** | 承認済み（実装中または実装済み） | 実装完了後、関連コミットを記録 |
| **Rejected** | 却下（代替案が選ばれた） | 却下理由を Consequences に記録 |
| **Deprecated** | 非推奨（新しい決定に置き換えられた） | Superseded by [ADR-XXX] をリンク |
| **Superseded** | 置き換えられた（Deprecated の完全版） | 新しい ADR へのリンクを明記 |

### 既存 ADR の更新

ADR は**イミュータブル**（不変）です。以下の場合を除き、既存 ADR を編集しないでください：

- **誤字脱字の修正**: OK
- **リンク切れの修正**: OK
- **Status の更新**: OK（Accepted → Deprecated など）
- **内容の変更**: ❌ NG（新しい ADR を作成し、Superseded でリンク）

---

## 関連ドキュメント

### ドキュメント管理ルール
- [`.claude/steering/documentation-guide.md`](../../../.claude/steering/documentation-guide.md) - 詳細な配置ルールとベストプラクティス

### 仕様書
- [`specs/multi-vendor-ecommerce/`](../../../specs/multi-vendor-ecommerce/) - 機能仕様書（SDD）

### その他の履歴
- [`docs/migration/`](../../migration/) - DB 移行履歴
- [`PROGRESS.md`](../../../PROGRESS.md) - 進捗記録

---

## 参考リンク

- [MADR（Markdown Architectural Decision Records）](https://adr.github.io/madr/) - ADR テンプレート標準
- [ADR Tools](https://github.com/npryce/adr-tools) - ADR 管理ツール

---

## 注意事項

### ✅ 推奨

- **小さく始める**: 最初は既存ドキュメント追記、大規模変更時のみ ADR
- **コミットハッシュを記録**: 実装に関連するコミットを明記
- **定期的なレビュー**: 6ヶ月ごとに ADR の鮮度を確認

### ❌ 避けるべき

- **ADR の乱用**: 小さな実装判断で ADR を作成しない
- **過度な詳細**: コードレベルの実装詳細は記録しない（コード自身が documentation）
- **古い ADR の放置**: Deprecated になった ADR は Status を更新
