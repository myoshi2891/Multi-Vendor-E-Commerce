# Followed stores — 設計

force-dynamic Server routeからgetUserFollowedStoresを呼び、取得try/catch外でcanonical redirectを行う。followStoreをfollowAction Propsとして渡す。FollowingContainer内の専用FollowingCardはuseRef lock + pendingで多重要求を防ぐ。旧共有StoreCard/旧Paginationを変更せず、DiscoveryHeading/Paginationを再利用する。mutation/所有権判定は既存queriesに委譲。local stateは返却booleanを使い件数を補正する。

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)


### 最終判定（2026-10-05）

実装あり・補助ブラウザー検証済み・認証後実ルート検証保留。2画面の補助Chromium6/6、1440/768/390px・keyboard/focus・URL/back・axe AA contrast・長文・pending/error/retry/emptyを確認。PC/mobile画像目視。公開実ルートの未認証転送と、alias/範囲補正のRTL回帰も確認。専用test DB不在。解除条件: 専用DB/アプリ接続先一致の環境で認証後の実画面と操作を検証しtest-userを後処理。[QA](../../testing/QA_HANDOFF.md#ds-account-discovery-browser)。

## P2残存表示統一（2026-10-09）

店舗カード・文字・選択・feedback意味色・focusをaccount aliasesへ接続。DiscoveryPaginationの番号操作は44×44px以上とし、URL/current/disabledを維持。共通利用元の閲覧履歴も回帰検証する。follow/unfollowの件数・重複防止・失敗保持・成功通知の契約は不変。

[計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。
