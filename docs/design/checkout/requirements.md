# Checkout — requirements

- 更新: 2026-10-04。実装済み、認証後実ルート検証は保留。
- 対象: `/checkout`、DS-PAGE-008。既存cart・配送先・国cookieの取得と転送を維持する。
- 深緑の導入、アイボリーの入力・商品面、ゴールドの操作、serif見出し。PCは明細／集計の2カラム、800px以下は1カラム。1440／768／390pxで横あふれなし。
- 商品名・size・quantity・単価・送料・クーポン対象店舗・小計・税0・総額を保持し、長文を折り返す。
- 配送先はラベル付きnative radio、追加／編集／既定変更はbutton。既定住所を初期選択し、住所保存後は所有者queryで再取得して保存した住所を選択する。
- フォームは全住所項目と既存Zodを保持。DB-supported国を選択する。Radix dialogはEscape／focus trap／復帰／小画面内scroll。送信中はdismiss不可、失敗時は入力保持。
- 送料再取得のDB書込みは直列化し、古い応答で表示を更新しない。取得中／失敗／住所更新中／coupon送信中は注文をロックする。失敗にはinline alertと再試行を用意する。
- クーポンのvalidation・対象店舗・割引計算を保持。ラベル／入力エラー／pending／失敗を示し二重送信を防ぐ。
- 注文成功後は遷移完了まで再注文を防止し、cart後処理の失敗でも遷移を維持する。空bagは操作不可とcollectionリンク、住所なしは追加案内。
- 国／保証の装飾はopt-in。既存保証文言を保持しprivacy／termsは `/legal` の実リンク。DB・認可・購入計算・在庫・決済を変更しない。

[設計](design.md) / [タスク](tasks.md) / [保存計画](../../../plans/layout-design/checkout-order-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#checkout-order移行記録)
