# View history — 要件

DS-PAGE-024。認証済み顧客がlocalStorage productHistoryのvariant ID順で閲覧済み商品を再訪する。既存editorial商品カードの詳細/wishlist/compareを維持。新デザインはaccountのアイボリー/深緑/ゴールド、serif見出し、responsive grid、可視focus。loadingをstatus、失敗を汎用alertと再試行で通知。不正JSON/非配列/非string配列/未保存は空、storageアクセス不可は再試行可能な失敗。URLページングは最大7番号とcurrent indication。取得の順序/ページサイズ/範囲補正を維持。履歴の削除や新DB永続化は追加しない。

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)
