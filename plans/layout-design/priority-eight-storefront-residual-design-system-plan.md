# 優先8画面・ストアフロント残存デザイン適用

2026-10-12。ユーザー承認済み。既存の本体適用・検証履歴を保持して残存表示を改善する。

## 対象・順序

| Step | ID | 画面 | 変更・受け入れ |
|---|---|---|---|
| 1 | DS-PAGE-022 | フォロー店舗 | カードリンク・focus・hover・ページャー、pending/失敗保持/成功通知 |
| 2 | DS-PAGE-024 | 閲覧履歴 | retry・カード・ページャー、loading/empty/error/保存順/範囲補正 |
| 3 | DS-PAGE-017 | ホーム | 既存purchase tokens、CTA/retry/focus、motion回帰 |
| 4 | DS-PAGE-010 | Contact | tokens・パンくず・アンカー・ブランドフォーム・受付結果 |
| 5 | DS-PAGE-014 | FAQ | tokens・目次・パンくず・窓口リンク |
| 6 | DS-PAGE-018 | 製品サポート | tokens・目次・窓口・長文 |
| 7 | DS-PAGE-005 | About | tokens・パンくず・アンカー・CTA |
| 8 | DS-PAGE-004 | 出店申請 | tokens・説明summary・段階操作・完了リンク・フォーム状態 |

## 共通基盤・対象外

既存purchase-theme/account aliasesを再利用。深緑/アイボリー/ゴールドとserif見出しを保持し、明暗面のfocusを分ける。ページrootと必要なPortalに限定する。共有callerの回帰も確認する。URL/API/Server Action契約/DB/認可/本文/業務フローは変更しない。外部送信・申請送信・アップロード・新規機能・DB準備は行わない。

## TDD・検証

各対象の先行browserテストで44px操作領域、focus/必要な境界3:1、文字AA、1440/768/390pxのoverflow・折返し・keyboard/hoverを検証。新要件の期待したRedを記録し、最小実装→Refactor→再検証。既存合格条件は回帰として記録し架空のRedを作らない。操作・状態はRTL、表示はPlaywright/axeと画像目視。

priority/purchase/seven fixtureと既存route suiteを拡張。config/serverは新設しない。認証後は既存顧客/専用DBで読取のみの確認を試み、環境不足は理由と解除条件を記録。補助検証を実route合格へ読み替えない。

各実装コミット前に関連Jest/browser、lint、tsc。最終は全体Jest・共有caller・check:playwright・画像目視。統計は実測のみ。

## コミット・文書同期

ユーザー選択: Redは証跡を記録しGreenで画面別コミット。基本11コミット（計画、基盤、8画面、最終同期）。各画面のrequirements/design/tasks、移行計画、進捗ノートを同期。最終にspec-sync-after-testでQA_HANDOFF→07-testing/COVERAGE_REPORT/docs PROGRESSへ実測を転記しcoverage dashboardを再生成。既存coverageは再計測しない限り維持。仕様変更不要なSDDには確認理由を残す。必須検証が未完なら保留。

## チェック

- [x] 計画保存
- [x] 共通基盤
- [x] Step 1 フォロー店舗
- [x] Step 2 閲覧履歴
- [x] Step 3 ホーム
- [x] Step 4 Contact
- [x] Step 5 FAQ
- [x] Step 6 製品サポート
- [x] Step 7 About
- [ ] Step 8 出店申請
- [ ] 最終回帰・仕様・QA・統計同期

[移行計画](design-system-adoption-plan.md) / [進捗](../../docs/design/design-system/PROGRESS.md)
