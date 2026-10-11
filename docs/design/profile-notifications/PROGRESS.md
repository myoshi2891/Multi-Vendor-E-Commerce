# Profile notifications — 進捗

2026-10-09: P2残存表示を実装し、TDDと補助ブラウザーを確認。既存plan 086の基盤機能は維持。認証後実ルート/データ取得の受け入れは専用E2E_DATABASE_URL不在で保留。解除条件は専用schema-current DBとClerkテスト認証を接続し、実routeの3幅/操作/状態を確認すること。購入・メール送信・DB初期化は検証目的では行わない。

[保存計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[検証証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。基盤契約は[通知基盤設計](../notification-foundation/design.md)と[plan 086](../../../plans/086-implement-notification-foundation.md)を参照。


## P2残存表示・Step 7 通知（2026-10-11）

既存本体の回帰/受け入れ追加でありRedは創作しない。通知関連RTL11/11、priority通知6/6（3幅、pending/error/retry/read/unread/リンクなし/cursor/長文・axe AA）。既存専用DBのClerk顧客で実route1/1内3幅（空状態・見出し/配色/overflow/focus/axe）を確認。通知0件のため実通知あり/既読永続化は未確認・保留。解除条件は既存テスト顧客に通知が存在する環境。今回データ追加なし。単独再実行で認証後2テスト2/2、初回一度のSyntaxErrorは再現せず、フィルターで抑制していない。型0、lint0 errors/既存8 warnings。

[保存計画](../../../plans/layout-design/priority-eight-p2-support-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#p2サポート通知等8画面移行記録)。API・DB・認可・入力/URL/業務契約は保持。
