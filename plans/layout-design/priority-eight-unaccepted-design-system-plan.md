# 受け入れ未完了の優先8画面へのデザインシステム適用

2026-10-16。ユーザー承認済み。既存実装と過去の検証履歴を再利用する。

## 対象と順序

| Step | ID | 画面 | 受け入れ対象 |
|---|---|---|---|
| 1 | DS-PAGE-022 | フォロー店舗 | カード・ページング・解除操作・表示状態 |
| 2 | DS-PAGE-024 | 閲覧履歴 | カード・ページング・再試行・表示状態 |
| 3 | DS-PAGE-017 | ホーム | ヘッダー・商品表示・motion操作 |
| 4 | DS-PAGE-001 | サインイン | ブランド・実Clerk・入力・エラー |
| 5 | DS-PAGE-002 | サインアップ | ブランド・実Clerk・入力・エラー |
| 6 | DS-PAGE-010 | Contact | 入力検証・pending/error/retry/success |
| 7 | DS-PAGE-005 | About | 見出し・本文・画像・リンク・アンカー |
| 8 | DS-PAGE-004 | 出店申請 | 入力・upload adapter・申請状態・Portal |

## 実装・受け入れ条件

既存の深緑・アイボリー・ゴールドtokensを再利用し、残存表示のみ改善する。1440/768/390pxと必要な境界幅でoverflow/折返し・44px操作・focus・keyboard・Dialog復帰・axe AA・画像目視を確認。該当する通常/空/失敗/retry/pending/success、フォームの二重送信防止・入力保持、home reduced-motionを確認する。

新しい不具合は先行RTL/browserで期待したRed→最小実装Green→整理と回帰。既存合格条件は回帰確認として記録しRedを創作しない。既存design config・共有fixtureサーバー・suiteを拡張する。公開実routeと既存テスト顧客の認証後実route、実Clerk表示は別記録する。外部送信・アカウント作成・実upload・DB初期化は対象外。API/DB/認可/業務契約の変更なし。

## 検証・文書・コミット

各画面で関連RTL/browserと共有caller回帰、lint/tscを実施。最終に全体Jest/coverage、check:playwright、文書リンク/形式/台帳整合・diffチェック。QA_HANDOFFを統計の正本とし、実測のみdocs PROGRESS/COVERAGE_REPORT/coverage dashboardへ同期。

計画1、各画面8、最終統合1の10コミットを基本とし各画面はGreenでコミット。各Stepで関連requirements/design/tasks・SDD testing・移行元計画・design PROGRESS・TEST_IMPLEMENTATION_PLANを同期。仕様変更不要なら理由を記録する。未確認は理由と解除条件をQAへ集約し、必須検証未完の画面は検証済みにしない。

## チェック

- [x] 計画保存
- [x] Step 1 フォロー店舗
- [x] Step 2 閲覧履歴
- [x] Step 3 ホーム
- [x] Step 4 サインイン
- [x] Step 5 サインアップ
- [x] Step 6 Contact
- [x] Step 7 About
- [x] Step 8 出店申請
- [x] 最終統合・文書同期

[移行元計画](design-system-adoption-plan.md) / [進捗](../../docs/design/design-system/PROGRESS.md)

## 最終結果

3277 passed / 3280 total、3 skipped、127 snapshots passed、335 スイート（334 passed／1 skipped、failed 0）。Statements88.39%（11492/13001）／Branches79.04%（7122/9010）／Functions85.13%（2273/2670）／Lines88.94%（10455/11754）。補助47/47（following10・history13・home9・Contact6・About3・apply6）、公開実route9/9、認証実SDK10/10（5幅×2画面）、認証後read-only3/3（各3幅）、申請guest3/3。計72/72。 型0・lint0 errors/既存8 warnings・harness成功。follow実データ/更新と出店申請実SDK/保存は別保留。詳細は[QA](../../docs/testing/QA_HANDOFF.md#2026-10-16-受け入れ未完了8画面最新)。

## 再実行

既存design config・Chrome channelを利用。実routeは既存専用DBへDATABASE_URL/DIRECT_URLを同値で指定し、認証後は既存顧客のcustomerEmailを含むJSONをDESIGN_PURCHASE_ROUTE、既存variant ID配列JSONをDESIGN_HISTORY_IDSへ渡す。準備は読み取りのみで、prepare-purchase-route.tsの書き込み準備は実行しない。

- `DESIGN_SUITE=priority DESIGN_BROWSER_CHANNEL=chrome bun run test:design -- --grep 'following|history|storefront eight (contact|about)'`（32ケース）
- `DESIGN_SUITE=purchase DESIGN_BROWSER_CHANNEL=chrome bun run test:design -- --grep home`（9ケース）
- `DESIGN_SUITE=seven DESIGN_BROWSER_CHANNEL=chrome bun run test:design -- --grep apply`（6ケース）
- `DESIGN_SUITE=priority-public DESIGN_BROWSER_CHANNEL=chrome bun run test:design -- --grep 'pending eight sign-|storefront eight public (/|/contact|/about) [0-9]'`（19ケース）
- `DESIGN_SUITE=purchase-route DESIGN_BROWSER_CHANNEL=chrome bun run test:design -- --grep 'pending eight read-only'`（3ケース・各3幅、上記顧客/履歴JSON環境変数が必要）
- `DESIGN_SUITE=seven-public DESIGN_BROWSER_CHANNEL=chrome bun run test:design -- --grep 'seller application actual guest'`（3ケース）
- `bun run test -- --runInBand --coverage`、`bun run lint`、`bunx tsc --noEmit`、`bun run check:playwright`、`bun run coverage:dashboard`。

各実ルートsuiteは逐次実行し、終了処理完了を確認してから次を開始する。Nextのtsconfig副作用だけを復元する。

## 段階コミット

- `fd29014d` docs(design): plan eight pending storefront acceptances
- `04975a7e` fix(design): retain follow action keyboard focus after requests
- `ca23f107` test(design): accept history rendering and retained retry state
- `04420ac9` docs(design): accept homepage tokens motion and responsive states
- `50231be3` fix(design): apply storefront tokens and accessible auth targets
- `2b3db651` test(design): accept Clerk signup and auth layout boundaries
- `c684789d` docs(design): accept contact form states and responsive layout
- `0f8e7ae1` docs(design): accept about page editorial navigation and layout
- `a7c1e065` test(design): accept seller application states and ready controls
- 最終統合: 本コミット（仕様/QA/台帳/coverage同期・全入力境界回帰）。
