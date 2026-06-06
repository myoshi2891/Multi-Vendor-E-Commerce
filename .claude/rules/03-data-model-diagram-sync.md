# Data Model Diagram Sync

## Scope
- `prisma/schema.prisma`（モデル・enum・リレーション・`@@unique`・`onDelete` 等）の変更全般
- ER 図の生成物 `docs/architecture/data-model.drawio`
- 生成スクリプト `scripts/erd/generate-erd.ts`
- レイアウト override サイドカー `scripts/erd/layout-overrides.json`（**配置・配線の SSOT**）
- 還流ツール `scripts/erd/extract-overrides.ts`（draw.io 手調整 → サイドカー）
- 関連仕様書 `specs/multi-vendor-ecommerce/03-data-model.md` の図リンク
- 視覚調整の運用スキル `.claude/skills/erd-diagram-adjust/SKILL.md`

## Rules

### MUST
- `prisma/schema.prisma` を変更したら、**同一 PR 内で** `bun run erd:generate` を実行し、
  再生成された `docs/architecture/data-model.drawio` をコミットすること。
- 新規モデルを追加した場合は `scripts/erd/generate-erd.ts` の `PAGES` 定義（各ページの `models` および `cells`）にモデル名を追記し、
  再生成時に **stderr の orphan WARNING がゼロ**（全モデルが分類済み）であることを確認すること。
- 図の見た目・分類・記法を変えたい場合は、`scripts/erd/generate-erd.ts`（=データ源）を編集してから
  `bun run erd:generate` で再生成すること。
- `data-model.drawio` を変更するコミットには、対応する `schema.prisma` 変更・
  `generate-erd.ts` 変更・`layout-overrides.json` 変更のいずれかが **同一コミットに含まれている**
  こと（生成のみの差分は単独でも可）。
- **線の重なり（ボックス突き抜け）等のレイアウト調整**は、`scripts/erd/layout-overrides.json`
  （配置・配線の SSOT）で行うこと。draw.io で視覚調整した結果は `bun run erd:extract` で
  サイドカーへ還流し、`bun run erd:generate` の再実行で**決定論的に再現**されることを確認する
  （手順は [`.claude/skills/erd-diagram-adjust/SKILL.md`](../skills/erd-diagram-adjust/SKILL.md)）。

### NEVER
- `docs/architecture/data-model.drawio` を draw.io GUI / エディタで手編集した結果を**そのまま
  コミット**する（生成物のため。次回再生成で必ず上書き・消失する）。視覚調整は必ず
  `layout-overrides.json` 経由で行い、`.drawio` は常に `bun run erd:generate` の出力に保つこと。
- `scripts/erd/generate-erd.ts`（生成器）を介さずに、スキーマと図を個別に更新する
  （ドリフトの直接原因になる）。
- `scripts/erd/layout-overrides.json` に**コメントを書く**（生成器は厳格 `JSON.parse` のため
  パースに失敗し、override が無効化される）。
- スキーマを変更したのに図を再生成せずに PR を出す。

## Rationale
- **生成物は手編集しない原則**: 本リポジトリは「SSOT から派生物を再生成する」運用を採っている
  （テスト統計の SSOT = `QA_HANDOFF.md`、ダッシュボードは `render-html.ts` から
  `bun run coverage:dashboard` で再生成 ― [`02-tdd-step-commit.md`](02-tdd-step-commit.md)）。
  データモデル図も同型で、**構造の SSOT** は `prisma/schema.prisma`、派生物は `data-model.drawio`。
- **レイアウトもソース化する**: 「線がボックスを避ける」等の視覚調整は本質的に人手判断だが、
  `.drawio` を直接手編集すると再生成で消える。そこで**配置・配線の SSOT** を
  `scripts/erd/layout-overrides.json` に分離し、生成器がこれを読んで再適用する。`.drawio` は
  2 ソース（スキーマ＋サイドカー）からの純粋な派生物のままで、「生成物は手編集しない原則」を
  破らずに手調整を恒久化できる（`bun run erd:extract` が draw.io 調整をサイドカーへ機械還流する）。
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
draw.io GUI で data-model.drawio のボックス/線を動かして、その .drawio を直接コミット
→ 次回 `bun run erd:generate` で全消去される。
   正: draw.io で調整 → `bun run erd:extract` でサイドカーへ還流 → `bun run erd:generate` で再生成。
```

### ✅ 良い例（レイアウト調整）

```bash
# data-model.drawio を draw.io で開き、突き抜けた線をガターへ寄せて保存（スクラッチ）
bun run erd:extract         # 調整を scripts/erd/layout-overrides.json へ還流
bun run erd:generate        # サイドカーから .drawio を決定論的に再構築
git add scripts/erd/layout-overrides.json docs/architecture/data-model.drawio
git commit -m "docs(erd): reroute edges via gutters and regenerate ER diagram"
```

## Related
- `scripts/erd/generate-erd.ts`（生成器 = 構造＋レイアウトの消費）
- `scripts/erd/layout-overrides.json`（配置・配線の SSOT）
- `scripts/erd/extract-overrides.ts`（draw.io 調整 → サイドカー還流）
- `.claude/skills/erd-diagram-adjust/SKILL.md`（再生成 → 視覚調整の運用手順）
- `specs/multi-vendor-ecommerce/03-data-model.md`（図リンクと再生成手順）
- `.claude/rules/02-tdd-step-commit.md`（生成物は SSOT から再生成する同型ルール）
- `.claude/steering/documentation-guide.md`（docs 配置・SSOT 規定）

## Owner / Last updated
- Owner: project team
- Last updated: 2026-06-03
