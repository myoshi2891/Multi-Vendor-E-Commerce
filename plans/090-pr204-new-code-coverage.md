# 090. PR #204 の New Code カバレッジ回復

## 背景

SonarCloud の PR #204（dev → main）で Coverage on New Code が 62.3%。
P3 デザイン移行で `design === "seller"` 分岐を追加した 4 コンポーネントに未カバーが集中している。

| ファイル | Sonar | 原因 |
|---|---|---|
| `src/components/dashboard/admin/sales-chart.tsx` | 22.2%（行 5 / 条件 16） | `AreaChart` を空 div にモックしており、`valueFormatter` / `customTooltip`（`SalesTooltip`）が実行されない |
| `src/components/dashboard/admin/recent-stores.tsx` | 条件 2 | `design="seller"` の描画テストが無い |
| `src/components/shared/theme-toggle.tsx` | 条件 1 | メニューを開くテストが無く `DropdownMenuContent` の className 分岐が未評価 |
| `src/components/dashboard/forms/click-to-add.tsx` | 条件 2 | フォーカス復帰の optional chain（入力欄の無い行）が未検証 |

## 対象

テスト追加のみ（本番コードは変更しない）。既存実装への回帰テストのため Red フェーズは発生しない。

- `tests/component/dashboard/admin/sales-chart.test.tsx`: `AreaChart` モックで props を捕捉し、seller 分岐・`formatRevenue`・`SalesTooltip` の各分岐を検証
- `tests/component/dashboard/admin/recent-stores.test.tsx`: seller で `data-store-state` が付き、既定では付かないこと
- `src/components/shared/theme-toggle.test.tsx`: メニューを開いて Light / Dark / System の `setTheme` 呼び出しを検証（seller / 既定）
- `tests/component/dashboard/click-to-add-design.test.tsx`: 入力欄の無い行を削除しても例外にならないこと

## 受け入れ条件

- 4 ファイルの New Code 行がすべてカバーされ、条件の未カバーは `container.current?.`（マウント中は常に非 null の防御的分岐）1 件のみ
- `bun run lint` / `bunx tsc --noEmit` / `bun run test` が通る

## 検証方法

- 対象テストを `--coverage --collectCoverageFrom=<4 ファイル>` で実行し、分岐カバレッジを確認
- テスト件数の変動を `spec-sync-after-test` で同期
