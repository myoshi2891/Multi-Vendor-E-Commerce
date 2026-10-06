# 購入導線6画面の共通ヘッダー受け入れ

- [承認計画](../../../plans/layout-design/priority-six-purchase-design-system-plan.md)
- [実施証跡](../design-system/PROGRESS.md#購入導線優先6画面移行記録)

## 共通要件

6画面にproduction HeaderFrameを適用し、アカウント/検索/メニューは同時に1つだけ開く。外側クリック、Escapeのfocus復帰、リンク/submit後の閉鎖を維持。明るいpanelには濃い文字/濃いgold、操作44px、overflow局所化を適用。候補はnative links、検索状態はstatus/alert、countryはkeyboard/selected/expandedと失敗保持/retryを備える。English/USDは固定表示。API/DB/業務契約は既存のまま。

## 画面別受け入れ

| ID | 表示・操作 | 受け入れ範囲 |
|---|---|---|
| DS-PAGE-017 home | 既存3章/collection導線/reduced motionと新header | RTL20/20、fixture3幅/axe、実route3幅（商品取得失敗状態）。商品ありはtest DB待ち |
| DS-PAGE-006 browse | filter/sort/query/paging/候補。sortはnon-modal、44px、reduced motionとAA contrast | RTL63/63、fixture3幅/axe。実routeはtest DB待ち |
| DS-PAGE-019 product | size/quantity/stock/reviews/配送。quantity/filter44px、review paging named nav/selected/focus、size待ちstatus | RTL69/69、fixture3幅/axe。実route/SDKはtest DB待ち |
| DS-PAGE-037 store | 長文identity/sort/products/empty、44pxリンク/card、件数/emptyのAA contrast | RTL38/38、fixture6件/3幅/axe。実routeはtest DB待ち |
| DS-PAGE-007 cart | quantity/delete/sync/checkout引継ぎ、item/通知close44px | RTL52/52、fixture3幅＋retry/sync、実empty route3幅/axe |
| DS-PAGE-008 checkout | address/dialog/coupon/pending/retry | 検証継続 |

第三者UIとDB dependent実routeはfixture結果から完了にしない。
