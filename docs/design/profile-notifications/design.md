# Profile notifications — 設計

Server Componentは既存queryを呼び、成功時にAction PropsでNotificationListを描画。失敗時にはNotificationsUnavailableを使う。両者の見出しはnotification-list内のNotificationHeadingへ集約する。cursorは既存parserで一度だけ正規化しkey/query/reloadへ利用。

Clientは既存Refによる一括既読の重複防止と非楽観/楽観の個別既読化を保持。notice状態は一括既読のpending/成功だけを告知し、一覧とは独立した常設role=statusを更新する。SDK/Server Actionの直接importは追加しない。

CSS Moduleはprofile shellのaccount aliasesを継承し、通知一覧にpanel、操作にfocus、通知状態に文字ラベルを用いる。基盤の通知モデル・配送イベント・メール設計は本変更で更新しない。

[保存計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[検証証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。基盤契約は[通知基盤設計](../notification-foundation/design.md)と[plan 086](../../../plans/086-implement-notification-foundation.md)を参照。
