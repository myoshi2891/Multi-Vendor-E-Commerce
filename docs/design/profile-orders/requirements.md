# Profile Orders — 要件

対象: `/profile/orders`（DS-PAGE-028）と `/profile/orders/[filter]`（DS-PAGE-027）、OrdersTable / OrderTableHeader（DS-COMP-080/081）。[保存計画](../../../plans/layout-design/profile-orders-design-system-plan.md)、[設計](design.md)、[タスク](tasks.md)、[進捗](PROGRESS.md)。

| ID | 受け入れ条件 | 検証 |
|---|---|---|
| PO-1 | 共通アカウント枠のアイボリー、深緑、濃いゴールド、GeorgiaのMy orders h1・日本語リード・サポート導線。 | RTL / Chromium |
| PO-2 | 注文ID、日付、商品画像最大5枚、明細数、支払/配送状態、USD金額2桁、既存 `/order/{id}` 詳細リンクを保持。長いIDを折り返す。 | RTL / Chromium |
| PO-3 | View all / To pay / To ship / Shipped / Deliveredをnative button、選択状態をaria-pressedで示す。既存filter routeの初期選択を保持し、不正route filterは全件へfallback。 | RTL / Chromium |
| PO-4 | ID/商品名/店舗名検索はSearchまたはEnterで適用。空文字送信で検索解除。4期間を保持。条件変更はpage=1へ戻し、全解除は状態/期間/検索すべてを戻す。 | RTL / Chromium |
| PO-5 | 前/次ページは条件を保持、境界方向はdisabled、1ページ以下でページャ非表示。現ページと現在表示件数のみ表示する。 | RTL / Chromium |
| PO-6 | 空はNo orders yet、条件付き空はNo matching ordersと解除案内、/browse導線。初回/再取得失敗は汎用alert、条件を維持して再試行。例外詳細と古い条件の結果を表示しない。 | RTL / Chromium |
| PO-7 | 取得中はstatus/aria-busy、静的スケルトン、フィルター/検索/期間をロック、ページャを隠す。初期表示の重複取得と二重送信を防ぐ。route loadingも同じ見出しを表示。 | RTL / Chromium |
| PO-8 | 1440/390/768pxで横溢れなし、キーボードfocus/Enter、axe AA違反0（contrast除外なし）。 | Chromium |
| PO-9 | ClientはServer Actionを直接importせず、Server ComponentがPropsで渡す。金額number・日付ISO文字列、表示に不要なフィールドを省いたデータを返す。所有者絞り込み維持。 | query / RTL |

対象外: 注文詳細、購入/決済/配送更新、DB/schema/認可条件、共有status部品、他profile本文。ページ内の条件はClient state（URLと同期せず、再読込でrouteの初期条件へ戻る）。
