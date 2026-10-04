# Followed stores — 設計

force-dynamic Server routeからgetUserFollowedStoresを呼び、取得try/catch外でcanonical redirectを行う。followStoreをfollowAction Propsとして渡す。FollowingContainer内の専用FollowingCardはuseRef lock + pendingで多重要求を防ぐ。旧共有StoreCard/旧Paginationを変更せず、DiscoveryHeading/Paginationを再利用する。mutation/所有権判定は既存queriesに委譲。local stateは返却booleanを使い件数を補正する。

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)
