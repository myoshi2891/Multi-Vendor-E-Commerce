# 販売者8画面のデザイン再監査・残存適用

2026-10-16。ユーザー承認済み。既存の適用・受け入れ履歴を保持する。

## 対象と順序

| Step | ID | 画面 | 受け入れ対象 |
|---|---|---|---|
| 1 | DS-PAGE-058 | 店舗概要 | KPI・チャート・長文・金額・空状態 |
| 2 | DS-PAGE-062 | 商品一覧 | 検索・行操作・Dialog・局所スクロール |
| 3 | DS-PAGE-055 | 在庫 | 数量・しきい値・警告・保存状態 |
| 4 | DS-PAGE-057 | 注文 | 状態選択・保存・支払状態・詳細Dialog |
| 5 | DS-PAGE-056 | メッセージ | 未読・選択・戻る・失敗・入力保持 |
| 6 | DS-PAGE-061 | 商品登録 | 動的項目・validation・画像・Portal |
| 7 | DS-PAGE-064 | 配送 | 既定値・国別表・編集・focus復帰 |
| 8 | DS-PAGE-063 | 店舗設定 | 画像・連絡先・featured・保存状態 |

## 実装と受け入れ

SellerShell/SellerPageとseller tokensを再利用し、深緑・アイボリー・ゴールド、書体、面、罫線、意味色、focusを統一する。Portalも明示的にopt-inする。API/DB/認可/計算/payload/URLは変更しない。ClientのServer Action直接importを追加しない。

各Stepで先行RTL/browser Red→最小Green→Refactor→回帰→文書同期→Green commit。既存合格は回帰確認と記録し、環境失敗や既存実装にRedを創作しない。

1440/768/390px × light/dark、必要なナビ/message境界幅。主要操作44px、overflow、折返し、局所scroll、keyboard/Escape/focus復帰、reduced-motion、axe AA違反0と画像目視。該当する通常/空/取得失敗/pending/save error/retry/success、二重送信防止・入力保持を確認する。

既存seven/six/seller-eight-route suiteと共通fixtureを拡張し、config/serverは新設しない。各画面で関連Jest/browser・lint・tsc・diff check。最終に関連suite全体・全体Jest/coverage・check:playwright・coverage dashboard生成。

実routeは既存専用テスト環境を利用して表示・操作部品・SDK描画を確認する。実保存・外部送信・upload・DB初期化は対象外。必須未実施は保留とし理由と解除条件をQAへ記録する。

## 文書・コミット

計画1→画面8→最終統合1の基本10commit。共有基盤は最初に必要とする画面へ含める。seller-ui-migration/seller-dashboardと関連SDDを確認・更新し、変更不要なら理由を残す。採用計画・design PROGRESS・TEST_IMPLEMENTATION_PLAN・QA_HANDOFFを同期する。統計は全体実測後QAを正本としてdocs PROGRESS/COVERAGE_REPORT/dashboardへ同期。push/PR/deployは対象外。

## チェック

- [x] 計画保存
- [x] Step 1 店舗概要
- [x] Step 2 商品一覧
- [x] Step 3 在庫
- [x] Step 4 注文
- [x] Step 5 メッセージ
- [x] Step 6 商品登録
- [x] Step 7 配送
- [x] Step 8 店舗設定
- [x] 最終統合・仕様/QA同期
- [ ] 今回の認証後実route/実SDK受け入れ（専用DB列不足で保留）

[移行元](design-system-adoption-plan.md) / [進捗](../../docs/design/design-system/PROGRESS.md)


## 再現コマンド

- `DESIGN_SUITE=seven DESIGN_BROWSER_CHANNEL=chrome bun run test:design`
- `DESIGN_SUITE=six DESIGN_BROWSER_CHANNEL=chrome bun run test:design`
- `bun run test -- --runInBand --coverage`
- `bun run lint` / `bunx tsc --noEmit` / `bun run check:playwright`
- `bun run coverage:dashboard` / `git diff --check`

実routeは既存専用DBをDATABASE_URL/DIRECT_URL/E2E_DATABASE_URLへ同値指定し、既存販売者/店舗情報のJSONをDESIGN_SELLER_ROUTEに渡す。`DESIGN_SUITE=seller-eight-route DESIGN_BROWSER_CHANNEL=chrome bun run test:design -- --grep 'DS-PAGE-'`で表示48件だけ選択する。prepare-seller-routeの書き込み準備は実行しない。今回beforeAllでStore.returnWindowDays列不足を検出して中断し受け入れ保留。Nextが追加したtsconfig includeだけを除去し、DBは変更していない。

## 段階コミット

- ce09228d 計画
- 8c83ffcf 店舗概要
- 21961710 商品一覧
- c158a39b 在庫
- caa3e34b 注文
- e51f2134 メッセージ
- 9bfdf58d 商品登録
- 6ceafd91 配送
- a2dce114 店舗設定
- 最終統合は本コミット（Git履歴参照）。


## 最終結果

補助ブラウザーseven85/85・six74/74、計159/159（部分実行は重複加算しない）。3幅/light/dark、ナビ767px/message1000px境界、focus/44px/overflow/意味色/axe AAを確認。全体Jest3280 passed/3283 total（3 skipped）、335 suites（334 passed/1 skipped）、127 snapshots。Statements88.4%（11493/13001）／Branches79.09%（7130/9014）／Functions85.13%（2273/2670）／Lines88.94%（10455/11754）。型0・lint0 errors/既存8 warnings・harness/diff/local links成功。dashboard418 files/412 lcov/18 of 80 cells、セル状態不変。

今回の認証後実route/実SDK描画は専用DBのStore.returnWindowDays列不足で保留。既存販売者/店舗の読み取り後、route beforeAllで不整合を検出し中断。後続画面未実施。DB変更・seed・アカウント作成・実保存・送信・uploadなし。Nextのtsconfig副作用のみ復元。過去の受け入れ履歴と台帳件数は保持。解除条件と次着手の正本はQA_HANDOFFのDS-SELLER-REAUDIT-ROUTES。Integration/本体3-browser E2Eは今回未再実行。

**2026-10-16 解除（同日追補）**: 原因は専用DB `multivendor_e2e` のマイグレーション適用漏れ（27/28、`20261015042255_add_return_requests` のみ未適用。dev DB へのみ適用されていた）で、構造ずれではない。追加のみのSQLを `bunx prisma migrate deploy` で適用し（seedなし、既存の店舗6・ユーザー7・注文14件は不変）、`prepare-seller-route.ts`（冪等）後に suite `seller-eight-route` の表示 **48/48**（8画面×3幅×light/dark、axe AA・overflow・pageerror・スクショ）。[計画](pending-three-real-route-acceptance-plan.md)。
