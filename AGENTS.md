# プロジェクト開発ルール

このリポジトリで作業を開始するときは、[既存の基本ルール](.agent/rules/core.md)を読む。
コード実装は、対象・受け入れ条件・検証方法を `plans/` の計画書に保存してから開始する。承認済みの計画とユーザーの指示は再利用し、承認済み範囲の作業について再承認を要求しない。

画面・レイアウト・デザインシステム・表示部品を変更する場合は、[design-system-workflow](.agent/skills/design-system-workflow/SKILL.md)を読み、その手順に従う。TDD、実装後の検証、関連仕様書と進捗ノートの更新までを完了条件とする。

ブラウザー（Playwright・axe）で検証する場合は、[playwright-browser-verification](.agent/skills/playwright-browser-verification/SKILL.md)を読む。Playwright の config と fixture サーバーは新規作成せず、`playwright.design.config.ts` に suite を追加し、spec は `tests/browser/` に置く。

文書のみの変更はリンク・形式・内容の整合を検証する。コミットはユーザーから明示的な依頼がある場合に行う。

- Owner: project team
- Last updated: 2026-10-05
