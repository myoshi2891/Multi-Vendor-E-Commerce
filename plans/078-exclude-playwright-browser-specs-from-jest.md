# 078: Playwright の `tests/browser/` を Jest の収集対象から外す（OI-15）

## Context

`bc4be297` で追加された `tests/browser/commerce-design.spec.ts` は、専用設定 `playwright.commerce.config.ts`（`testDir: "./tests/browser"`）から実行する Playwright spec である。ところが `jest.config.js` の `testPathIgnorePatterns` は `/tests/e2e/` と `/tests/integration/` しか除外していない。そのため `bun run test` がこの spec を収集し、`Playwright Test needs to be invoked via 'npx playwright test'` で suite fail する。**CI の unit test ジョブが exit code 1 で落ちる**（テスト本体はすべて pass）。

## 方針

- `jest.config.js` の `testPathIgnorePatterns` に `"/tests/browser/"` を追加する（`/tests/e2e/` と同じ扱い）。
- `tests/browser/` の実行経路（`playwright.commerce.config.ts`）は変えない。
- テストは追加しない（Red 不要）。設定変更のみで、現在の suite fail が Red の証跡に当たる。修正後に `bun run test` が 0 failed suite になることを検証とする。

## 受け入れ条件

- `bun run test` → `Test Suites: 0 failed`。スイート数は 1 減る（Playwright spec が分母から外れる）。
- `bunx playwright test -c playwright.commerce.config.ts --list` で spec が引き続き列挙される。
- QA_HANDOFF の OI-15 を解消扱いにし、統計を実測値で同期する。
