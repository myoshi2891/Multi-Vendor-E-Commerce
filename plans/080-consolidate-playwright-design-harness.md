# Playwright ハーネスのリファクタリングと再発防止（ルール・AGENTS.md・スキル）

## Context

ルートに Playwright config が 6 本ある（本体 1 + デザイン検証 5）。調査で次の 3 つの問題が見つかった。

1. **二重実行バグ**: `tests/e2e/{priority-public,seven-public}-design.spec.ts` は専用 config（Chromium・dev サーバー前提）用に書かれている。しかし本体 `playwright.config.ts`（`testDir: ./tests/e2e`）にも拾われ、3 ブラウザ × 本番ビルドでも実行されている。
2. **config 重複**: 補助 config 5 本は、testDir / testMatch / port / command / outputDir / timeout 以外が同じ内容のコピー。
3. **fixture サーバー重複**: `tests/fixtures/{commerce,priority,seven}/server.mjs`（約 100 行 × 3）は、mock・port・title・tmp 名・一部 esbuild オプション以外が同じ。

### 根本原因（git log で確認）

5 本は 2026-10-04〜05 の 2 日間に、デザイン移行の 5 コミットで 1 本ずつ追加された（`bc4be297` → `515611ec` → `c3b7eaa8` → `c4724e29` → `2283980b`）。ユーザーの認識では Codex による実装。原因は次の 4 つ。

- **A. 手順の空白**: `AGENTS.md` → `design-system-workflow` §3 には「Playwright・axe 等で確認」としか書かれていない。どの config を使うか、spec をどこに置くか、サーバーをどう立てるかの規定がない。そのため、エージェントは画面群ごとに「動く最小構成」を新規作成した（直前のファイルをコピーした）。
- **B. 配置規約の欠如**: `tests/e2e/` は本体 config が丸ごと拾うディレクトリだが、そのことがどこにも書かれていない。そのため、専用 config 用の spec がそこへ置かれた。
- **C. Playwright 仕様の落とし穴**: `webServer` は config 単位で、project 単位では選べない。これを避けるには config を分けるしかないと判断され、分割が正当化された。
- **D. 機械的ガードの欠如**: 増殖を検出する仕組みがなかった。後から `.coderabbit.yaml` でレビュー対象外にしており（`97d97342`）、症状を隠す方向に動いていた。

→ 対策は「1 本の拡張点（suite 登録）」「配置で構造的に分離」「手順をスキル化して AGENTS.md から誘導」「CI チェックで機械的に強制」の 4 層で行う。

## 実装手順

### 0. 計画保存（規約）
- `plans/080-consolidate-playwright-design-harness.md` に本計画を保存する。

### 1. ベースライン採取（削除前）
- 本体と補助 5 config の `--list | tail -1` の結果をスクラッチパッドに保存する。

### 2. spec の構造分離（原因 B）
- `git mv tests/e2e/{priority-public,seven-public}-design.spec.ts tests/browser/`
- `tests/browser/` を「デザイン検証専用（design config からのみ実行）」に統一する。本体 testDir の外に出るので、testIgnore のような命名依存の除外は不要になる。Jest も既に `/tests/browser/` を除外済み。

### 3. 補助 config の統合 — 新規 `playwright.design.config.ts`（原因 C）
- `DESIGN_SUITES`（`as const satisfies Record<string, DesignSuite>`）: commerce:3107、priority:3110、seven:3121（fixture）／priority-public:3109、seven-public:3122（dev 実ルート。seven-public は `NEXT_DEV_DIST_DIR=.next/seven-public`、url `/seller/apply`、timeout 90000）。commerce のみ `screenshot: "only-on-failure"`。
- `testDir` は全 suite 共通で `./tests/browser`。
- 共通設定: workers 1、retries 0、chromium、reducedMotion、trace retain-on-failure、reuseExistingServer false、webServer timeout 60000。
- `outputDir: test-results/design/<suite>`
- `DESIGN_SUITE` を `trim()` し、型ガード `isDesignSuiteName` で検証する。未設定・不正値の場合は、suite 一覧付きのメッセージで `throw` する。
- ファイル冒頭コメントに「`webServer` は config 単位のため本体と分離／suite 追加はこの表に 1 行足す」と明記する。
- `package.json`: `"test:design": "playwright test -c playwright.design.config.ts"` を追加する。
- 旧 5 config を削除する。

### 4. fixture サーバー共通化 — 新規 `tests/fixtures/shared/fixture-server.mjs`
- `startFixtureServer({ name, entry, port, title, mocks, loader?, define? })` を作る。中身は `seven/server.mjs` の処理（esbuild・tailwind・配信・SIGTERM/SIGINT での tmp 削除）を関数化したもの。
- 共通 mock（`next/link`・`next/image`）は既定値として持つ。onResolve の filter は `Object.keys(mocks)` をエスケープして生成する。
- 各 `tests/fixtures/<suite>/server.mjs` は固有の mock・port・オプションだけを渡す薄い入口にする（パスと port は不変）。

### 5. スクリーンショット出力先の統一
- `tests/browser/{commerce,seven}-design.spec.ts` のハードコード `test-results/*.png` を `info.outputPath(...)` に置換する（他 3 本は既に outputPath 方式）。suite ごとの outputDir に収まる。

### 6. 機械的ガード（原因 D）— 新規 `scripts/check-playwright-harness.mjs` + CI
- 次の 4 点を検査し、違反があれば一覧を出して exit 1 にする:
  - ルートの `playwright*.config.ts` が `playwright.config.ts` と `playwright.design.config.ts` の 2 本だけであること
  - `tests/browser/*.spec.ts` がすべて `DESIGN_SUITES` のどれかの testMatch に対応すること（未登録 spec を検出）
  - design config の `testDir` が `./tests/browser` 1 つに固定されていること（※当初案の「`tests/e2e/` に `*-design.spec.ts` が無い」は誤り。本体用の `*-design.spec.ts` が 15 本正当に存在し、実装時に誤検知したため差し替えた）
  - `tests/fixtures/*/server.mjs` が `startFixtureServer` を import していること
- 依存を追加しないため、`DESIGN_SUITES` の testMatch はファイルを正規表現で抽出する。
- `package.json`: `"check:playwright": "node scripts/check-playwright-harness.mjs"` を追加し、`.github/workflows/ci.yml` の Lint ジョブに 1 ステップ追加する（追加依存なし、SHA ピン対象の外部 Action なし）。

### 7. ルール化 — 新規 `.claude/rules/05-playwright-harness.md`（`00-readme` 形式）
- **MUST**: 新しいブラウザ検証は `DESIGN_SUITES` に 1 行追加して行う。spec は `tests/browser/` に置く。fixture サーバーは `startFixtureServer` を使う。スクリーンショットは `info.outputPath`。追加後に `bun run check:playwright` を実行する。
- **NEVER**: ルートに `playwright.*.config.ts` を新設する。専用 config 用 spec を `tests/e2e/` に置く。`server.mjs` をコピーして作る。レビュー対象外設定（`.coderabbit.yaml`）で増殖を隠す。
- **Rationale**: 上記の根本原因 A〜D と該当コミット。
- Examples（許可／禁止）、Owner、Last updated を記載する。

### 8. エージェント導線（Codex 向け）
- **新規スキル** `.agent/skills/playwright-browser-verification/SKILL.md`: 判断フロー（fixture か実ルートか）、suite 追加手順、空き port の決め方（DESIGN_SUITES の表を見る）、mock の書き方、実行コマンド、`check:playwright`、証跡の記録先（PROGRESS / TESTING_DESIGN）、禁止事項。手順の正本はこのスキルに一本化し、ルールからはリンクのみ張る。
- `AGENTS.md`: 「ブラウザー（Playwright）で検証する場合は [playwright-browser-verification] を読む。config・fixture サーバーを新規作成しない」の 1 段落を追加する。
- `.agent/skills/design-system-workflow/SKILL.md` §3: Playwright の行にスキルへのリンクを追加する。
- `.agent/rules/core.md` のエージェント行動方針に 1 行追加する。
- `.claude/rules/04-design-system-workflow.md` と `CLAUDE.md` のコマンド欄に `DESIGN_SUITE=<suite> bun run test:design` を 1 行追加する。

### 9. 既存参照の更新
- `jest.config.js` のコメント、`.coderabbit.yaml`（旧 2 エントリを削除。新 config はレビュー対象に戻す — 隠さない方針）、`docs/testing/TESTING_DESIGN.md`、`specs/multi-vendor-ecommerce/07-testing.md`: 新コマンド・新パスに更新する。
- `PROGRESS.md` と `QA_HANDOFF.md` の過去証跡は書き換えない。`QA_HANDOFF.md` には本変更の記録と旧→新コマンド対応を追記する（セッション終了時の規約）。

### 10. コミット
- 明示依頼時のみ行う。依頼があれば次の単位に分ける: ① spec 移動（fix）② design config 統合（refactor）③ fixture 共通化（refactor）④ screenshot 出力先（test）⑤ check スクリプト + CI（chore）⑥ rule / skill / AGENTS（docs）⑦ docs 同期（docs）。

## 重要ファイル
- 新規: `playwright.design.config.ts`、`tests/fixtures/shared/fixture-server.mjs`、`scripts/check-playwright-harness.mjs`、`.claude/rules/05-playwright-harness.md`、`.agent/skills/playwright-browser-verification/SKILL.md`
- 削除: `playwright.{commerce,priority-components,priority-public,seven,seven-public}.config.ts`
- 移動: `tests/e2e/*-public-design.spec.ts` → `tests/browser/`
- 更新: `tests/fixtures/*/server.mjs`、`tests/browser/{commerce,seven}-design.spec.ts`、`package.json`、`.github/workflows/ci.yml`、`AGENTS.md`、`.agent/rules/core.md`、`.agent/skills/design-system-workflow/SKILL.md`、`.claude/rules/04-*.md`、`CLAUDE.md`、`jest.config.js`、`.coderabbit.yaml`、`TESTING_DESIGN.md`、`07-testing.md`、`QA_HANDOFF.md`

## 検証
1. `bunx tsc --noEmit`、`bun run lint`、`bun run test`（Jest の件数は不変であること）
2. 本体 `bunx playwright test --list`: ベースラインから「public-design 2 spec の件数 × 3」だけ減っていること。`grep design` が空であること。
3. 5 suite の `DESIGN_SUITE=<s> bun run test:design -- --list` の件数がベースラインと一致すること。
4. fixture 3 suite（commerce / priority / seven）を実行して全件 pass すること。public 2 suite は DB に到達できれば実行し、できなければ `--list` のみ確認して「未実行」と報告する。
5. `DESIGN_SUITE` が未設定・不正値のとき、一覧付きエラーで即終了すること。
6. `bun run check:playwright` が pass すること。加えて、違反を一時的に作って fail することを確認する（ダミーの `playwright.tmp.config.ts` と、未登録の `tests/browser/x.spec.ts` を作成 → fail を確認 → 削除）。
7. 実行後に port 3107 / 3110 / 3121 のプロセスが残っていないこと、tmp ディレクトリが削除されていること。
8. 文書: 追加・更新したリンクがすべて解決すること（rule / skill / AGENTS / design-system-workflow）。

## 実施結果（2026-10-05、未コミット）

- 追加で発見・修正: Playwright の `webServer` は既定で SIGKILL 終了のため、fixture サーバーの tmp 削除ハンドラーが一度も動いていなかった（OS tmp に 37 ディレクトリが残存）。`gracefulShutdown: { signal: "SIGTERM", timeout: 5000 }` と `server.closeAllConnections()` で修正し、実行前後で tmp が増えないことを確認した。既存の残存分は削除していない。
- 本体 `--list`: 495 tests / 48 files → 447 / 46（public-design 48 件の二重実行を解消）。
- design 5 suite: `--list` 件数はベースラインと一致（11 / 6 / 42 / 11 / 5）。実行は 75/75 pass（public 2 suite も dev サーバーで実行）。
- `check:playwright`: 現状 pass。4 種類の違反を一時的に作り、すべて検出（exit 1）されることを確認した。
