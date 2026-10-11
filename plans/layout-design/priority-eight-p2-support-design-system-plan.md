# P2サポート・通知等8画面のデザインシステム適用

- 日付: 2026-10-11。提示計画の実装・段階コミットをユーザー承認済み。
- 正本: [採用計画](design-system-adoption-plan.md)／[進捗](../../docs/design/design-system/PROGRESS.md)。
- 本体適用済み画面の残存表示を統一する。既存の検証履歴と今回の受け入れを区別する。

## 対象・受け入れ条件

| Step | ID | URL | 受け入れ条件 |
|---|---|---|---|
| 1 | DS-PAGE-038 | /track-order | 共通色・入力境界・focus、store状態タグ、pending/missing/error/retry/success、既存照合保持 |
| 2 | DS-PAGE-011 | /customer-service | 共通色・hover/focus、既存5導線・説明・長文保持 |
| 3 | DS-PAGE-036 | /returns-exchange | policy/form/error/receipt、UUID検証・pending lock・失敗後入力保持 |
| 4 | DS-PAGE-012 | /dispute | purchase表示、DISPUTE/UUID・再試行・受付保持 |
| 5 | DS-PAGE-035 | /report-problem | purchase表示、分類・注文番号不要・受付保持 |
| 6 | DS-PAGE-016 | /offers | 一覧/loading/empty/error、順序・件数・browse URL保持 |
| 7 | DS-PAGE-067 | /profile/notifications | 実route・未読/focus/cursor、既読pending/error/retry、共通tokens |
| 8 | DS-PAGE-032 | /profile/settings | 実Clerk・Portal/hash、狭幅/focus/44px/reduced-motion |

## 依存関係・境界

既存store限定purchase-themeを先行。DesignPageの任意appearance="purchase"は既定表示を維持しLegalを回帰。SupportFormは既存brand opt-inだけ変更。面/文字/罫線/入力境界/focus/意味色、serif、独立操作44×44px以上を確認。Client ActionはProps経由。
API/DB schema/認可/分類/照合/通知永続化/Clerk公式UIは変更しない。既存専用DB・テスト顧客のみ再利用し通知既読化だけ許容。データ追加・初期化・外部申請送信・設定実保存/削除・購入/決済なし。push/PRなし。

## TDD・検証・コミット

- 計画保存→共通表示→Step1〜8の画面別変更→各仕様/進捗同期→最終統合同期を段階コミット。
- 新要件は先行RTL/ブラウザーRed→最小Green→Refactor→関連再検証。既存条件は回帰確認と記録しRedを創作しない。
- Redは理由と実測を記録。コミット時は関連テスト/lint/tsc成功。独立したテスト補完と文書同期は分割。
- priority/priority-public/seven fixture・specを拡張。認証後routeはpurchase-routeに今回だけ選択可能なテストを追加。config/fixture server新設なし、specはtests/browser。
- 1440/768/390px＋必要な境界、通常/空/長文/pending/error/retry/success、Tab/Enter/Escape/focus復帰、overflow/reduced-motion、axe AA（contrast除外なし）・画像目視。
- 公開フォーム送信はレスポンス差し替え。実SDK/実route未確認は理由と解除条件を残し保留。
- 各Step関連Jest/lint/tsc、最終全体Jest+coverage、関連browser回帰、check:playwright、diff --check、文書リンク/台帳整合。

## 文書同期

採用計画/デザイン進捗、track-order/support-forms/offers/profile-notifications/profile-settingsの要件・設計・タスク・進捗、SDD、QA_HANDOFF、TEST_IMPLEMENTATION_PLANを更新。customer-service/returnsは既存仕様リンクと変更不要/変更点を記録。全体統計は実測したQAを正本としてtesting/COVERAGE_REPORT/全体PROGRESSへ同期。coverage dashboardは再生成。未検証をfixture成功で完了へ読み替えない。

## 実施チェック

- [x] 計画保存・対象選定。
- [x] 共通表示。
- [x] Step 1 配送追跡。
- [x] Step 2 サポート窓口。
- [x] Step 3 返品交換。
- [x] Step 4 紛争申請。
- [ ] Step 5 問題報告。
- [ ] Step 6 オファー。
- [ ] Step 7 通知。
- [ ] Step 8 設定。
- [ ] 最終統合検証・文書同期。
