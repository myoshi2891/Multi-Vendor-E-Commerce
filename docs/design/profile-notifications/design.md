# Profile notifications — 設計

Server Componentは既存queryを呼び、成功時にAction PropsでNotificationListを描画。失敗時にはNotificationsUnavailableを使う。両者の見出しはnotification-list内のNotificationHeadingへ集約する。cursorは既存parserで一度だけ正規化しkey/query/reloadへ利用。

Clientは既存Refによる一括既読の重複防止と非楽観/楽観の個別既読化を保持。notice状態は一括既読のpending/成功だけを告知し、一覧とは独立した常設role=statusを更新する。SDK/Server Actionの直接importは追加しない。

CSS Moduleはprofile shellのaccount aliasesを継承し、通知一覧にpanel、操作にfocus、通知状態に文字ラベルを用いる。基盤の通知モデル・配送イベント・メール設計は本変更で更新しない。

[保存計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[検証証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。基盤契約は[通知基盤設計](../notification-foundation/design.md)と[plan 086](../../../plans/086-implement-notification-foundation.md)を参照。


## P2残存表示・Step 7 通知（2026-10-11）

既存本体の回帰/受け入れ追加でありRedは創作しない。通知関連RTL11/11、priority通知6/6（3幅、pending/error/retry/read/unread/リンクなし/cursor/長文・axe AA）。既存専用DBのClerk顧客で実route1/1内3幅（空状態・見出し/配色/overflow/focus/axe）を確認。通知0件のため実通知あり/既読永続化は未確認・保留。解除条件は既存テスト顧客に通知が存在する環境。今回データ追加なし。単独再実行で認証後2テスト2/2、初回一度のSyntaxErrorは再現せず、フィルターで抑制していない。型0、lint0 errors/既存8 warnings。

[保存計画](../../../plans/layout-design/priority-eight-p2-support-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#p2サポート通知等8画面移行記録)。API・DB・認可・入力/URL/業務契約は保持。
