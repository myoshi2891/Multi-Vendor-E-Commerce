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
- [ ] Step 5 サインアップ
- [ ] Step 6 Contact
- [ ] Step 7 About
- [ ] Step 8 出店申請
- [ ] 最終統合・文書同期

[移行元計画](design-system-adoption-plan.md) / [進捗](../../docs/design/design-system/PROGRESS.md)
