# TDD & Step-by-Step Commit Discipline

## Scope
- すべてのテスト追加・修正作業（`src/**/*.test.ts`、`tests/component/**/*.test.tsx`、`tests/e2e/**/*.spec.ts`、`prisma/seed/__tests__/**`）
- テスト数 / スイート数 / スナップショット数のいずれかが変動する変更全般
- 関連ドキュメント (`docs/testing/*.md`、`docs/PROGRESS.md`、`docs/coverage-dashboard.html`、`specs/multi-vendor-ecommerce/07-testing.md`) の同期作業

## Rules

### MUST
- 新規ロジック実装は **Red → Green → Refactor** を辿ること。各フェーズで `git commit` を打ち、ハッシュ単位で巻き戻し可能にする。
- 既存コードへのテスト**補完のみ**の作業（例: スナップショット生成テスト）でも、**1 テストファイル（または 1 Tier / 1 機能）ごとに 1 commit** を基本単位とする。
- テスト追加・修正で `Tests:` 総数・スイート数・スナップショット数のいずれかが変わった場合、`spec-sync-after-test` skill を必ず起動する（手動で同等手順を踏む場合は Step 1〜7 をすべて実行）。
- `spec-sync-after-test` 実行時は `bun run coverage:dashboard` で `docs/coverage-dashboard.html` を再生成し、同じ commit に含める。
- コミットは**論理的に独立した単位**で分けること: 「テストコード」「ダッシュボード再生成」「テスト統計の同期」「rule / skill 整備」は別 commit。
- 各コミットは**単独でビルド可能・型チェック可能**な状態を維持すること（`bunx tsc --noEmit` がそのコミット時点でも通る）。

### NEVER
- 複数のテストファイル + ドキュメントを**中間コミットなしで 1 つのコミットにまとめる**こと。
- `docs/coverage-dashboard.html` を手動編集して commit する（生成物なので必ず `bun run coverage:dashboard` 経由）。
- テストが Red のまま実装に進む。最低 1 件の意図的な failure を確認してから Green に移ること（snapshot test 等で Red 不要な場合を除く）。
- `git commit --amend` で過去のコミットに無関係な変更を追加する（独立コミットに分けるべき）。
- `test-complete` を実行せずに commit する（lint / tsc / test の 3 点が通っていない状態のコミット禁止）。

## Rationale
- **レビュー容易性**: 9 ファイル + 5 docs を 1 commit にまとめると、レビュアーは全体 diff を一気に見るしかなくなる。1 commit = 1 論理単位なら、レビューも `git revert` も粒度が揃う。
- **CI 切り分け**: テスト失敗時にどの commit が原因か `git bisect` で機械的に追える。
- **再発防止**: `spec-sync-after-test` skill が存在し dashboard 再生成手順も書かれていたにも関わらず、過去セッション（2026-05-23 / B1 実装）でこの skill が呼ばれず `docs/coverage-dashboard.html` の更新が漏れた。常時 rule にすることで手順書 → 実行への接続を強制する。
- **`spec-sync-after-test` SKILL.md** が「テスト数を実行せず推測で更新」を禁じている前提と整合する。

## Examples

### ✅ 良い例（B1: shadcn/ui Snapshot 9 プリミティブの場合）
```
test(ui): add button snapshot tests (B1 Tier 1)
test(ui): add badge/card/input/label/textarea/skeleton snapshots (B1 Tier 2)
test(ui): add dialog/select portal snapshots (B1 Tier 1)
chore(test): replace placeholder classes with real tailwind utilities
docs: regenerate coverage-dashboard.html after B1 tests
docs(testing): sync B1 stats in TEST_IMPLEMENTATION_PLAN/QA_HANDOFF/COVERAGE_REPORT/PROGRESS
```
→ 各 commit は単独で意味があり、テストファイルとそのスナップショットがペアでコミットされ、ドキュメント同期とダッシュボード再生成は分離。

### ❌ 悪い例
```
test(ui): add B1 shadcn snapshots + docs sync
```
→ 9 テストファイル + 40 snapshot + 5 docs + lint 修正 + ダッシュボード未生成、を 1 commit にまとめる。レビュー不能、`git bisect` 不能、`git revert` で不要な変更まで巻き戻る。

### ❌ 悪い例
```
test(ui): add all primitive snapshots (no docs update yet)
```
→ コミット後 `docs/coverage-dashboard.html` が古いまま放置。`spec-sync-after-test` を起動していない。「あとでまとめて同期」が次回セッションへの引き継ぎ漏れの原因になる。

## Related
- `.claude/skills/test-gen/SKILL.md` Step 5〜7（コミット粒度と spec-sync 起動）
- `.claude/skills/test-complete/SKILL.md`（コミット前の lint/tsc/test チェック）
- `.claude/skills/spec-sync-after-test/SKILL.md` Step 6〜7（dashboard 再生成 + 関連 docs 同期コミット）
- `.claude/workflows/submit-pr.md`（PR 提出ワークフロー）
- `.claude/steering/documentation-guide.md`（docs 配置ルール）

## Owner / Last updated
- Owner: project team
- Last updated: 2026-05-23
