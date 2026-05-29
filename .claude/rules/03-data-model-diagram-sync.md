# Data Model Diagram Sync

## Scope
- `prisma/schema.prisma`（モデル・enum・リレーション・`@@unique`・`onDelete` 等）の変更全般
- ER 図の生成物 `docs/architecture/data-model.drawio`
- 生成スクリプト `scripts/erd/generate-erd.ts`
- 関連仕様書 `specs/multi-vendor-ecommerce/03-data-model.md` の図リンク

## Rules

### MUST
- `prisma/schema.prisma` を変更したら、**同一 PR 内で** `bun run erd:generate` を実行し、
  再生成された `docs/architecture/data-model.drawio` をコミットすること。
- 新規モデルを追加した場合は `scripts/erd/generate-erd.ts` の `DOMAINS` 配列に分類を追記し、
  再生成時に **stderr の orphan WARNING がゼロ**（全モデルが分類済み）であることを確認すること。
- 図の見た目・分類・記法を変えたい場合は、`scripts/erd/generate-erd.ts`（=データ源）を編集してから
  `bun run erd:generate` で再生成すること。
- `data-model.drawio` を変更するコミットには、対応する `schema.prisma` 変更または
  `generate-erd.ts` 変更が **同一コミットに含まれている**こと（生成のみの差分は単独でも可）。

### NEVER
- `docs/architecture/data-model.drawio` を draw.io GUI / エディタで**手編集してコミット**する
  （生成物のため。次回再生成で必ず上書き・消失する）。
- `scripts/erd/generate-erd.ts`（生成器）を介さずに、スキーマと図を個別に更新する
  （ドリフトの直接原因になる）。
- スキーマを変更したのに図を再生成せずに PR を出す。

## Rationale
- **生成物は手編集しない原則**: 本リポジトリは「SSOT から派生物を再生成する」運用を採っている
  （テスト統計の SSOT = `QA_HANDOFF.md`、ダッシュボードは `render-html.ts` から
  `bun run coverage:dashboard` で再生成 ― [`02-tdd-step-commit.md`](02-tdd-step-commit.md)）。
  データモデル図も同型で、SSOT は `prisma/schema.prisma`、派生物は `data-model.drawio`。
- **乖離の構造的防止**: 図を手書き同期に頼ると、スキーマ変更のたびに更新漏れが発生する。
  パーサ生成方式なら、図は常にスキーマから一意に導出され、初学者が参照する図と実装が一致する。
- **レビュー容易性**: スキーマ差分と図差分が同一 PR に揃うため、レビュアーは
  「このカラム/リレーション追加が図のどのエッジに対応するか」を 1 PR で確認できる。

## Examples

### ✅ 良い例
```bash
# schema.prisma に新カラム/リレーションを追加した後
bun run erd:generate        # docs/architecture/data-model.drawio を再生成
git add prisma/schema.prisma docs/architecture/data-model.drawio
git commit -m "feat(db): add X relation and regenerate ER diagram"
```

### ❌ 悪い例
```bash
# スキーマだけ変えて図を再生成しない（図が古いまま放置）
git add prisma/schema.prisma
git commit -m "feat(db): add X relation"
```

```text
draw.io GUI で data-model.drawio のボックスを直接動かして保存・コミット
→ 次回 `bun run erd:generate` で全消去される。レイアウト調整はスクリプト側で行う。
```

## Related
- `scripts/erd/generate-erd.ts`（生成器 = データ源）
- `specs/multi-vendor-ecommerce/03-data-model.md`（図リンクと再生成手順）
- `.claude/rules/02-tdd-step-commit.md`（生成物は SSOT から再生成する同型ルール）
- `.claude/steering/documentation-guide.md`（docs 配置・SSOT 規定）

## Owner / Last updated
- Owner: project team
- Last updated: 2026-05-29
