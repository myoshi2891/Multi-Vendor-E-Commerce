# P2優先6画面・残存表示のデザイン統一

- 日付: 2026-10-09。ユーザーがP2残存部品優先を選択し、計画の実装・段階的コミットを承認。
- 正本: [採用計画](design-system-adoption-plan.md)／[進捗](../../docs/design/design-system/PROGRESS.md)。

## 対象・依存関係

既存store限定purchase themeを共通基盤に使い、profileのaccount変数へ接続してから6画面を順番に移行する。

| Step | ID | 対象 | 受け入れ条件 |
|---|---|---|---|
| 1 | DS-PAGE-009 | 比較 | ブランドtokens、価格・最大4件・削除/全消去・empty/loading/error/retry保持、局所スクロールとfocus |
| 2 | DS-PAGE-033 | Wishlist | 見出し/件数/空/失敗、番号操作44×44px、URL/current/境界と商品操作保持 |
| 3 | DS-PAGE-022 | フォロー店舗 | 店舗カード・状態色・44×44pxページャー、pending/error/retry/success・URL保持 |
| 4 | DS-PAGE-024 | 閲覧履歴 | 商品一覧・空/loading/error/retry・ページャーを統一、保存順/不正storage/古い応答/URL保持 |
| 5 | DS-PAGE-067 | 通知 | 未読/既読・空/失敗・一括既読pendingの読み上げ、取得失敗でも見出し、cursor/リンク保持 |
| 6 | DS-PAGE-032 | 設定 | 設定枠/Clerk appearance/input/focusをtokens化、hashとセキュリティ機能保持 |

## 境界

- API/Server Action契約、DB/認可/価格/永続化、管理者属性3画面、購入処理は変更しない。
- 既存本体と適用済み商品カードを維持。ClientからServer Actionを直接importしない。
- profileのtoken接続により他のaccount子画面も回帰確認。dashboardには波及させない。

## TDD・検証・コミット

- 計画→基盤→6画面→最終同期の9段階。各実装単位でRed（期待理由の失敗）→Green→Refactor→検証→仕様同期。Red証跡を残し、実装コミットは関連test/lint/tsc通過後に行う。
- 表示は既存priority/seven suite・共通fixture serverを拡張。新しいconfig/serverは作らずspecをtests/browserに置く。
- 1440/768/390pxと境界幅、通常/空/長文/disabled/pending/error/success、Tab/Enter/focus、overflow、reduced motion、axe AA、画像目視。
- 操作/状態は既存RTLを拡張。既存条件の追加確認は回帰検証と記録し、Redを創作しない。
- 最終: 全体Jest+coverage、lint、tsc、check:playwright、diff --check、文書リンク/台帳ID整合。
- 認証後実ルート/Clerkは専用test DBとテスト認証の有無を再確認し、不在なら理由/解除条件付き保留。fixture成功だけで全画面を検証済みにしない。購入/アカウント削除/DB初期化は行わない。

## 文書同期

採用計画・デザイン進捗、6画面要件/設計/タスク/進捗、SDD requirements/quality/testing、QA_HANDOFF・TEST_IMPLEMENTATION_PLANを同期。overview/architecture/data-model/interfacesは契約不変のため変更不要の理由を記録。全体統計/coverageは実測のみ、QA_HANDOFFを正本としてCOVERAGE_REPORT/docs PROGRESSへ同期しdashboardはコマンドで生成。

## 実施チェック

- [x] 計画保存・対象選定。
- [x] 共通基盤。
- [x] Step 1 比較。
- [ ] Step 2 Wishlist。
- [ ] Step 3 フォロー店舗。
- [ ] Step 4 閲覧履歴。
- [ ] Step 5 通知。
- [ ] Step 6 設定。
- [ ] 最終統合検証・仕様/QA同期。
- [ ] 認証後実ルート/実Clerk受け入れ（環境不在時は保留）。
