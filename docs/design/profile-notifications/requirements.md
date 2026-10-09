# Profile notifications — 要件

DS-PAGE-067 / DS-COMP-239。認証済み顧客が既存通知を読む画面のP2残存表示統一（2026-10-09）。

- account aliasesのアイボリー面/罫線/文字/意味色/可視focus、serif h1、長文折り返し、44px以上の操作。
- 取得成功/失敗どちらも名前付きsectionとNotifications h1を表示。失敗は汎用alertと、正規化した既存cursorを保持するReload notificationsリンク。内部エラー詳細は表示しない。
- 通知タイトル/本文/UTC日時/リンクとRead/Unreadを表示。一括既読pendingはaria-busy/disabledと常設statusで告知、成功をstatus、失敗をalertで示し、未読を保持して再試行できる。
- リンクありは遷移を妨げず既読化、リンクなしは成功後に既読表示へ変更し失敗時は未読で再操作可能。空でもnextCursorがあればOlder notificationsを表示。
- API/DB/認可/メール/配信/既読化の永続化方式は変更しない。
- 1440/768/390px、Tab/Enter、axe AA、pending/error/retry/empty/long text/cursorをRTLと補助ブラウザーで確認。認証後実ルートは専用test DB不在で保留。

[保存計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[検証証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。基盤契約は[通知基盤設計](../notification-foundation/design.md)と[plan 086](../../../plans/086-implement-notification-foundation.md)を参照。
