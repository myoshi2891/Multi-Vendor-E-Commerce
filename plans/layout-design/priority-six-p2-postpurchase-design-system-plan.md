# P2購入後6画面のデザインシステム統一

2026-10-10。ユーザー承認済み計画。既存適用を維持し、残存表示を共通トークンへ接続する。

## 対象・依存関係

| Step | ID | 画面 | 対応 |
|---|---|---|---|
| 1 | DS-PAGE-028 | /profile/orders | 検索、条件、カード、ページング、状態 |
| 2 | DS-PAGE-030 | /profile/payment | 検索、明細、ページング、状態 |
| 3 | DS-PAGE-021 | /profile/addresses | カード、フォーム、独立Dialog |
| 4 | DS-PAGE-031 | /profile/reviews | 検索、評価、カード、写真 |
| 5 | DS-PAGE-026 | /profile/messages | 会話、吹き出し、送信、状態 |
| 6 | DS-PAGE-029 | /profile | 会員情報、ショートカット、注文概要 |

既存purchase-themeとaccount aliases、priority fixtureサーバーを再利用。注文filter route DS-PAGE-027は回帰対象。共有枠の他子画面も回帰する。

対象外: API/DB/認可/金額計算/検索条件/URL/ポーリングの仕様変更、販売者表示、購入・外部送信、アカウント作成・削除、push。

## 受け入れ条件・TDD

- 固定ブランド色を役割別トークンへ接続。主操作はgold/ink、リンクは濃いgold、focusと意味色を維持。
- 本番部品をfixtureで描画し、トークン注入後のcomputed style追従をブラウザーで先行Red確認。環境失敗をRedにしない。
- 1440/768/390pxでoverflowなし、見出し・ラベル・44px操作領域、focus/keyboard、axe AA（contrast含む）、画像目視。
- 通常/空/取得失敗/再試行/取得中、検索・条件・ページングを確認。住所のvalidation/pending/error/success/focus復帰、メッセージの長文/選択/送信失敗draft保持を回帰。
- Dialogにthemeを合成しPortalでも追従。message aliasesは購入者scopeのみ。
- Red→Green→Refactorと関連RTLを画面別に実施。既存機能の成功は回帰証跡として記録。

## 検証・文書・コミット

計画commit→画面別6commit（実装・テスト・仕様・進捗）→最終検証commit。失敗テストだけをcommitしない。

既存playwright.design.config.tsにpostpurchase suite、tests/browserにspecを追加。priority serverのentry分岐を拡張し、新config/serverは作らない。

既存E2E認証helper/保存状態を調査。使える顧客状態があれば実routeを確認。作成・削除を必要とするhelperは自動実行せず、不可なら理由・解除条件をQAに記録し補助検証と区別する。

最終: 全体Jest、lint、tsc --noEmit、check:playwright、6画面と既存子画面回帰、文書リンク、diff --check。全体統計は実測のみ。

関連docs/design/profile-*のrequirements/design/tasks/PROGRESS、SDD要件/品質/テスト、導入計画、design-system PROGRESS、QA_HANDOFF、TEST_IMPLEMENTATION_PLAN、docs/PROGRESSを同期。DB/architecture変更不要の根拠も残す。必須未検証があれば全画面を検証済みにしない。

## 完了チェック

- [x] Step 1 注文一覧
- [x] Step 2 支払い履歴
- [x] Step 3 配送先
- [x] Step 4 レビュー
- [x] Step 5 メッセージ
- [ ] Step 6 概要
- [ ] 最終検証・文書同期
