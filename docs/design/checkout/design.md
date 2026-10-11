# Checkout — design

- 2026-10-04。ページ専用の `commerce.module.css`（DS-COMP-204）を購入導線へ適用。global token・UI primitive・dashboardを一括変更しない。
- Serverページはapproved facadeからactionをimportし、型付きPropsでClientへ注入。Clientにruntimeのquery importはない。型は `src/lib/commerce-actions.ts`。
- Checkoutはrefresh queueを維持、住所は既存profileのsave/default facadeと検証済みAddressFormを再利用し、初回取得の住所をlocal listとして管理。保存後の所有者query失敗もretry可能にし、再取得後にfocusを戻す。旧住所form/list/card・共有旧Modalの全体移行とは分ける。
- 注文明細・住所・集計はServer描画。Client header用 `serializeOrderInvoice` は既存PDFに必要な項目だけ投影しDecimalを境界でnumberへ変換する。PDFの内容と装飾は保持。
- Stripe/PayPalのactionは4つをorderページから渡す。providerごとの処理中stateで他方式をロック。StripeのappearanceとPayPalのscript reducerはインストール済み型に合わせる。
- Supplementalブラウザーはproduction部品・CSSをbundleし、NextナビゲーションとSDKだけをadapterへ差し替える。DB・Clerk・実決済は呼ばない。実ルートの認可は既存queryのRTL回帰まで確認し、認証後E2Eとは区別する。

[要件](requirements.md) / [タスク](tasks.md) / [証跡](../design-system/PROGRESS.md#checkout-order移行記録)

## 購入tokensの継承（2026-10-08）

commerceのpageとRadix Portal dialogにpurchase-themeをcompose。共用AddressFormのCSSはpurchase tokensと従来値のfallbackを使用し、checkoutの保存buttonだけgold/inkへ統一。profile側のmarkup/Props/既定配色は保持。[受け入れ](../purchase-residual/requirements.md)。

### 入力境界の役割（2026-10-11）

control-lineを#877957とし、coupon inputとcheckout dialog内の有効input/selectに明示適用。共有AddressFormのaccount表示とinvalidのdanger境界を保持。overlay/image/暗い罫線も既存purchase役割へ接続する。
