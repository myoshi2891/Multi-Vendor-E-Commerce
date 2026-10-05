---
name: playwright-browser-verification
description: Multi-Vendor E-Commerce で画面・部品をブラウザー（Playwright・axe）で検証するときの手順。既存の playwright.design.config.ts に suite を 1 行足し、tests/browser/ に spec を置き、共通 fixture サーバーを使う。Playwright の config・fixture サーバーを新しく作りたくなったとき、デザイン移行の検証証跡を取るとき、`tests/e2e/` に spec を追加するか迷ったときに使う。
---

# ブラウザー検証（Playwright）手順

このリポジトリ専用。Playwright の config は **2 本だけ**にする。

| config | 対象 | 実行 |
|---|---|---|
| `playwright.config.ts` | `tests/e2e/`（本体 E2E。3 ブラウザ・本番ビルド・シード DB） | `bunx playwright test` |
| `playwright.design.config.ts` | `tests/browser/`（デザイン検証。Chromium・1 suite ずつ） | `DESIGN_SUITE=<suite> bun run test:design` |

## なぜ config を増やさないか

2026-10-04〜05 に、画面群ごとに config と `server.mjs` をコピーして 5 本増やした結果、次の問題が起きた（[plans/080](../../../plans/080-consolidate-playwright-design-harness.md)）。

- `tests/e2e/` に置いた専用 spec が本体 E2E にも拾われ、3 ブラウザ × 本番ビルドで二重実行された
- ほぼ同じ config と fixture サーバーのコピーが残った
- `webServer` の既定（SIGKILL で終了）により、fixture の tmp が削除されず溜まり続けた

Playwright の `webServer` は config 単位でしか指定できない。そのため、本体と分ける必要があるのは事実だが、**suite の切り替えは 1 本の design config の中で環境変数を使って行う**。

## 1. どちらで検証するか決める

- **本体 E2E（`tests/e2e/`）**: 実際の DB・認証・購入フローを通す回帰テスト。CI と同じ 3 ブラウザで回す価値がある場合のみ。
- **design suite（`tests/browser/`）**: 1440 / 768 / 390px、focus、axe、スクリーンショットなどの見た目と状態の検証。
  - `kind: "fixture"`: production の表示部品を esbuild でまとめ、Next / SDK / Server Action を adapter に差し替える。DB・Clerk 不要。状態（pending・error・empty・長文）を自由に作れる。
  - `kind: "route"`: dev サーバーで実ルートを開く。公開ページや未認証リダイレクトの確認用。

迷ったら fixture にする。認証後の実ルートは fixture では証明できないため、PROGRESS には「保留」と解除条件を残す。

## 2. suite を追加する

1. `playwright.design.config.ts` の `DESIGN_SUITES` に 1 行追加する（`testMatch`・`port`・`kind`・`command`）。
   - **port**: 表に無い番号を選ぶ（現在 3107 / 3109 / 3110 / 3121 / 3122）。本体 E2E の 3000 は使わない。
   - route 型で別の dev サーバーと並行起動する場合は `NEXT_DEV_DIST_DIR=.next/<suite>` で distDir を分ける（`seven-public` 参照）。
2. spec は `tests/browser/<suite>-design.spec.ts` に置く。**`tests/e2e/` には置かない**（本体に拾われる）。
3. fixture 型の場合は `tests/fixtures/<suite>/preview.tsx` と、次の形の `server.mjs` だけを作る。

```js
import { startFixtureServer } from "../shared/fixture-server.mjs";

await startFixtureServer({
    name: "<suite>",
    entry: "tests/fixtures/<suite>/preview.tsx",
    port: 31xx, // DESIGN_SUITES と一致させる
    title: "<Suite> design fixture",
    mocks: {
        // next/link・next/image は shared 側の既定値がある。必要な adapter だけを書く
        "next/navigation": `export function useRouter(){return {push(){},refresh(){}}}`,
    },
    // 必要な場合だけ: loader（画像の dataurl 等）/ define（公開キー等）
});
```

4. スクリーンショットは `info.outputPath("<name>.png")` に保存する（`test-results/design/<suite>/` に suite ごとに分かれる）。`test-results/` 直下へのハードコードは禁止。
5. `bun run check:playwright` を実行して構成違反が無いことを確認する（CI の Lint ジョブでも実行される）。

## 3. 実行と記録

- `DESIGN_SUITE=<suite> bun run test:design`（一覧だけ見るときは `-- --list`）
- `DESIGN_SUITE` が未指定・不正値の場合は、有効な suite 一覧付きのエラーで止まる。
- ローカルの listen や tsx IPC が sandbox で EPERM になるのは環境エラーで、TDD の Red ではない。
- `NEXT_DEV_DIST_DIR` を使う route suite（`seven-public`）を実行すると、`next dev` が `tsconfig.json` の `include` に `.next/<suite>/…/types` を自動で追記する。これはテスト実行の副作用なので `git checkout -- tsconfig.json` で戻し、コミットしない。
- 証跡は [進捗ノート](../../../docs/design/design-system/PROGRESS.md) に記録し、ハーネスの使い方を変えた場合は [TESTING_DESIGN.md](../../../docs/testing/TESTING_DESIGN.md) を更新する。

## 禁止

- ルートに `playwright.<name>.config.ts` を新しく作る
- `tests/e2e/` に design config 専用の spec を置く
- 既存の `server.mjs` をコピーして fixture サーバーを作る
- `.coderabbit.yaml` 等でレビュー対象から外して、構成の問題を隠す
