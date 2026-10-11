# Order detail — requirements

- 更新: 2026-10-04。実装済み、認証後実ルート検証は保留。
- 対象: `/order/[orderId]`、DS-PAGE-003。既存owner-scoped `getOrder`、欠落時のhome転送を維持する。
- 深緑の見出し、アイボリーの明細、ゴールドの操作、serif見出し。固定幅3カラム／固定高scrollを撤去しPC2カラム・800px以下1カラムへ変更する。
- 注文ID、状態、配送先、支払情報、店舗別商品・配送期間・coupon・小計・送料・総額を保持。長文は折返し、商品画像未取得は既存placeholder。
- 総額カードは1つ。支払い領域は従来どおり paymentStatus=Pending または orderStatus=Failed の場合のみ表示する。
- 戻るは `/profile/orders`。未実装のキャンセルはdisabledと理由表示、キャンセルAPIは追加しない。
- Export／Printの内容とPDF装飾を保持。header/PDFへ渡す投影データはnumber金額／ISO作成日などplain valuesのみ。生成はdynamic import、準備中は操作ロック、失敗はalertと再操作。
- Stripe appearanceをsupported APIで設定。初期化／送信中／失敗／再試行を通知し、処理中の再送信とPayPal併用を防ぐ。PayPalブランド表示はSDK側を保持、script読み込み失敗はretry、取引失敗はalert。
- 決済action・金額／通貨・所有者検証・状態遷移は既存のまま。第三者SDKの実描画・実決済をfixture検証済みと扱わない。

[設計](design.md) / [タスク](tasks.md) / [保存計画](../../../plans/layout-design/checkout-order-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#checkout-order移行記録)

## 残存部品の購入theme（2026-10-08）

[6画面受け入れ](../purchase-residual/requirements.md)。共有購入面はpurchase-themeのstore専用tokensを使用。page/Portal rootsに明示適用し固定light schemeを維持。住所フォームは継承tokensを使い、account callerでは従来のfallback値を維持する。注文/住所/coupon/pending/失敗後retryの契約は変更しない。

## ストア向け状態タグ（2026-10-08）

注文全体・店舗group・商品item・支払いのタグは任意`variant="store"`を指定。state値/ラベル/アイコンを保持し、warning/success/danger/info/neutralの意味を持つ可読色と角丸なしの罫線を使用する。明暗祖先に依存せず固定light面でAAを満たす。指定なしの管理画面等は従来表示を維持する。


## 優先8画面受け入れ（2026-10-11）

パンくず導線は44×44px以上、keyboard focusは3:1以上。請求書生成失敗は暗いhero上の可読danger色とalertで通知し、Export/Printを再操作できる。生成中の二重操作防止、PDF内容、支払条件と単一合計を保持。
