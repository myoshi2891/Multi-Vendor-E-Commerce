# Playwright Harness Layout

## Scope
- ルートの `playwright*.config.ts`
- `tests/e2e/`（本体 E2E）、`tests/browser/`（デザイン検証）
- `tests/fixtures/*/server.mjs`、`tests/fixtures/shared/fixture-server.mjs`
- `scripts/check-playwright-harness.mjs`

手順の正本は [playwright-browser-verification](../../.agent/skills/playwright-browser-verification/SKILL.md)。このルールは守るべき不変条件だけを定める。

## Rules

### MUST
- Playwright の config は `playwright.config.ts`（本体）と `playwright.design.config.ts`（デザイン検証）の 2 本に限る。
- 新しいブラウザー検証は `playwright.design.config.ts` の `DESIGN_SUITES` に 1 行追加し、spec を `tests/browser/` に置く。
- fixture サーバーは `tests/fixtures/shared/fixture-server.mjs` の `startFixtureServer` を使い、suite 固有の mock・port だけを渡す。
- design suite のスクリーンショットは `testInfo.outputPath()` に保存する。
- ハーネスを変更したら `bun run check:playwright` を通す（CI の Lint ジョブでも実行される）。

### NEVER
- ルートに `playwright.<name>.config.ts` を新設する。
- design config 専用の spec を `tests/e2e/` に置く（本体 config が丸ごと拾い、3 ブラウザ × 本番ビルドでも実行される）。
- 既存の `server.mjs` をコピーして fixture サーバーを作る。
- design config の `webServer` から `gracefulShutdown` を外す（SIGKILL 終了になり、fixture の tmp が削除されない）。
- `.coderabbit.yaml` の除外設定などで、構成の重複をレビューから隠す。

## Rationale
- 2026-10-04〜05 に、デザイン移行の 5 コミット（`bc4be297` / `515611ec` / `c3b7eaa8` / `c4724e29` / `2283980b`）で、画面群ごとに config と `server.mjs` をコピーして増やした。その結果、config が 6 本になり、`tests/e2e/` に置いた 2 本（16 件）が本体 E2E でも 3 ブラウザ分（48 件）重複して実行されていた。
- 原因: (A) `design-system-workflow` には「Playwright で確認」としか書かれておらず、置き場所と config の決め方が無かった。(B) `tests/e2e/` を本体が丸ごと拾うことが文書化されていなかった。(C) `webServer` は config 単位なので「分けるしかない」と判断された。(D) 機械的なガードが無く、後から `.coderabbit.yaml` でレビュー対象外にされた。
- 対策: 拡張点を `DESIGN_SUITES` の 1 か所に絞る。spec の配置で本体と構造的に分ける。手順をスキル化して `AGENTS.md` から誘導する。`check:playwright` で CI から強制する（[plans/080](../../plans/080-consolidate-playwright-design-harness.md)）。
- ファイル名では判定しない: `tests/e2e/` には本体用の `*-design.spec.ts` も正当に存在するため、ガードは「design config の testDir が `./tests/browser` に固定されていること」で担保する。

## Examples

### ✅ 許可
```ts
// playwright.design.config.ts
const DESIGN_SUITES = {
    // ...
    wishlist: { testMatch: "wishlist-design.spec.ts", port: 3123, kind: "fixture", command: "node tests/fixtures/wishlist/server.mjs" },
} as const satisfies Record<string, DesignSuite>;
```
```bash
DESIGN_SUITE=wishlist bun run test:design
```

### ❌ 禁止
```text
playwright.wishlist.config.ts を新設し、tests/e2e/wishlist-public-design.spec.ts を testMatch で指す
→ check:playwright が fail する。本体 E2E でも 3 ブラウザ分が二重に実行される。
```

## Owner / Last updated
- Owner: project team
- Last updated: 2026-10-05
