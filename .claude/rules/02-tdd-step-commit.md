# TDD & Step-by-Step Commit Discipline

## Scope
- すべてのテスト追加・修正作業（`src/**/*.test.ts`、`tests/component/**/*.test.tsx`、`tests/e2e/**/*.spec.ts`、`prisma/seed/__tests__/**`）
- テスト数 / スイート数 / スナップショット数のいずれかが変動する変更全般
- 関連ドキュメント (`docs/testing/*.md`、`docs/PROGRESS.md`、`docs/coverage-dashboard.html`、`specs/multi-vendor-ecommerce/07-testing.md`) の同期作業
- カバレッジダッシュボードのデータソース (`scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` 配列等) の編集および付随する `docs/coverage-dashboard.html` 再生成
- **Tierの定義**: 本リポジトリにおけるテスト実装時の難易度や依存関係の分類。
  - **Tier 1 (独立したテスト)**: 単一のファイルやモジュールでテストが自己完結し、他への依存が少ないもの（例: 単一UIコンポーネントの基本表示テスト）。
  - **Tier 2 (まとまった機能/コンポーネント群)**: 複数の関連するUIコンポーネントや、密接に連携するロジック群で、変更の粒度が極めて小さく、相互依存が強いもの。

## Rules

### MUST
- 新規ロジック実装は **Red → Green → Refactor** を辿ること。各フェーズで `git commit` を打ち、ハッシュ単位で巻き戻し可能にする。
- 既存コードへのテスト**補完のみ**の作業（例: スナップショット生成テスト）でも、**1 テストファイルごとに 1 commit** を基本単位とする。
  - ただし、「1 Tier / 1 機能」として複数のテストファイルを1つのコミットにまとめる（例: `B1 Tier 2`）のが妥当なのは、**以下の条件をすべて満たす場合**に限る：
    1. **同一のカテゴリ / ドメイン**（例: shadcn/ui プリミティブ）に属する
    2. 同梱するテストファイル数が **最大 3 ファイル** である
    3. **変更量の合計が 200 行未満**（テストコード + スナップショットファイルの合計）
    4. テスト対象間に **「相互依存が強く」** 同時にコミットすべき技術的根拠がある
       - ※「相互依存が強く」とは、**インポートの 50% 以上を共有している**、または**同一の SUT (System Under Test) / モジュールを参照している**状態を指す。
  - 上記のいずれかの閾値（3ファイル、または合計200行）を超える場合は、**原則としてコミットを分離しなければならない**。やむを得ず同一コミットにする場合は、PR（プルリクエスト）の説明文にどの基準をどう満たしたかの理由を明記し、明示的なレビュアー承認チェックボックス（`- [ ] レビュアーによる閾値超過の同梱コミット承認`）を追加すること。
  - ※グルーピングの目的は、論理的単位をまとめることであり、**各開発フェーズ（テスト追加、リファクタリング、ドキュメントなど）を正しく分割せず、巨大な変更を一括でコミットすることを防ぐこと**である。
- テスト追加・修正で `Tests:` 総数・スイート数・スナップショット数のいずれかが変わった場合、`spec-sync-after-test` skill を必ず起動する（手動で同等手順を踏む場合は Step 1〜8 をすべて実行）。
- `spec-sync-after-test` 実行時は `bun run coverage:dashboard` で `docs/coverage-dashboard.html` を再生成し、テスト統計の同期ドキュメント（**`QA_HANDOFF.md` (SSOT)**, `07-testing.md`, `COVERAGE_REPORT.md`, `PROGRESS.md`）と**同じ commit に含めて一括同期すること**。SSOT は `QA_HANDOFF.md`（[`documentation-guide.md`](../steering/documentation-guide.md) 規定）なので、他ファイルはここから値を伝播させる。
- **`scripts/coverage-dashboard/render-html.ts` を編集した場合は、同一コミット内で `bun run coverage:dashboard` を実行して `docs/coverage-dashboard.html` を再生成する。** `NEXT_ACTIONS` 配列を編集した場合は、加えて [`QA_HANDOFF.md`](../../docs/testing/QA_HANDOFF.md) の「次回着手用 依頼プロンプト」セクションと同期すること（両者は二重 SSOT であり、片方だけ更新すると drift する）。
- コミットは**論理的に独立した単位**で分けること: 「テストコード」「ドキュメント同期（ダッシュボード再生成およびテスト統計含む）」「rule / skill 整備」は別 commit。
- 各コミットは**単独でビルド可能・型チェック可能**な状態を維持すること（`bunx tsc --noEmit` がそのコミット時点でも通る）。

### NEVER
- 複数のテストファイル + ドキュメントを**中間コミットなしで 1 つのコミットにまとめる**こと。
- `docs/coverage-dashboard.html` を手動編集して commit する（生成物なので必ず `bun run coverage:dashboard` 経由）。データ更新は `scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` 等の SSOT 配列を編集する。
- テストが Red のまま実装に進む。最低 1 件の意図的な failure を確認してから Green に移ること（snapshot test 等で Red 不要な場合を除く）。
- `git commit --amend` で過去のコミットに無関係な変更を追加する（独立コミットに分けるべき）。
- `test-complete` を実行せずに commit する（lint / tsc / test の 3 点が通っていない状態のコミット禁止）。

## Rationale
- **レビュー容易性**: 9 ファイル + 5 docs を 1 commit にまとめると、レビュアーは全体 diff を一気に見るしかなくなる。1 commit = 1 論理単位なら、レビューも `git revert` も粒度が揃う。
- **CI 切り分け**: テスト失敗時にどの commit が原因か `git bisect` で機械的に追える。
- **再発防止**: `spec-sync-after-test` skill が存在し dashboard 再生成手順も書かれていたにも関わらず、過去セッション（2026-05-23 / B1 実装）でこの skill が呼ばれず `docs/coverage-dashboard.html` の更新が漏れた。常時 rule にすることで手順書 → 実行への接続を強制する。
- **`spec-sync-after-test` SKILL.md** が「テスト数を実行せず推測で更新」を禁じている前提と整合する。
- **QA_HANDOFF.md SSOT 明文化（2026-05-24）**: A4 シリーズで `documentation-guide.md` の「QA_HANDOFF.md = 統計の SSOT」規定にもかかわらず `spec-sync-after-test` skill が QA_HANDOFF.md を更新対象に含めておらず、手動で同期する事故が連続して発生したため、本ルール + skill 側両方に明示した。
- **`render-html.ts` SSOT 明文化（2026-05-24）**: A4 後の Next Actions 更新時に「HTML 直接編集禁止」ルールはあったが「ではどこを編集するか」が無く、`scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` 配列がデータ源であることが発掘ベースで判明したため明文化。さらに `QA_HANDOFF.md` の「依頼プロンプト」セクションとも同期義務を結び付けた。

## Examples

### ✅ 良い例：新基準に基づくコミット分割

```bash
test(ui): add badge/card/label snapshots (B1 Tier 2 - 3ファイル、計120行、shadcn/ui プリミティブで共通 utils を参照)
test(ui): add skeleton/textarea snapshots (B1 Tier 2 - 2ファイル、計80行、shadcn/ui プリミティブ)
test(ui): add modal provider async logic tests (1ファイル = 1 commit - 非同期処理を伴う独立したプロバイダー、Tier 1)
chore(test): replace placeholder classes with real tailwind utilities (テストコード修正ではないリファクタリング)
docs: regenerate coverage-dashboard.html and sync B1 stats (ダッシュボード生成 + 統計ドキュメント更新の独立コミット)
```

→ 各コミットは同一 Tier 内で「3ファイル以下」「200行未満」の基準を満たしており、テストコードとリファクタリング、ドキュメント同期が明確に別コミットに分かれている。

### ❌ 悪い例：3ファイルまたは200行の閾値超過を未承認で同梱

```bash
test(ui): add badge/card/input/label/textarea/skeleton snapshots (B1 Tier 2)
```

→ 6つのテストファイルとそれに伴うスナップショット（合計300行以上）を、PRでの理由記載およびレビュアーの承認なしに1つのコミットに同梱している。

### ❌ 悪い例：相互依存がない独立したテストの同梱

```bash
test(ui): add button/select/dialog snapshots (Tier 1 & Tier 2)
```

→ `button` と `select` と `dialog` は同一の SUT (System Under Test) を共有しておらず、インポートの共有率も 50% 未満であり、個別に独立してテスト可能なコンポーネントであるため、別々にコミットすべきである。

### ❌ 悪い例：複数フェーズの混在（最大の禁止事項）

```bash
test(ui): add B1 shadcn snapshots + docs sync
```

→ 9つのテストファイル + 40個のスナップショット + 5つのドキュメント更新 + Linter修正を、中間コミットなしで1つのコミットにまとめている。レビュー不能、`git bisect` 不能、`git revert` で不要な変更まで巻き戻る。

### ❌ 悪い例：docs同期を後回し

```bash
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
