# Cart — design

専用CSS Moduleでストアの配色を適用する。導入部は深緑 `#0b100e`、ページはアイボリー `#f3f0e8`、文字と集計面は `#17251d`、CTAはゴールド `#d4ba83`。明るい背景上のリンクは `#75613b`。見出しはGeorgia、本文は既存Geist。見出しはh1（ページ）→h2（商品／集計／空状態）→h3（保証案内）。金額はdl/dt/ddで表す。

商品と集計は2列、760px以下では1列。1000px以下では画像と余白を縮める。商品名と配送内訳は折り返し、入力・操作に固有のアクセシブル名を与える。全選択はnative checkbox、削除／wishlist／数量はnative button。保証案内はカート内にスコープし、他画面の旧共有部品を変更しない。

`cart/page.tsx`（Server Component）が `src/queries/user.ts` の同期・保存・wishlistをaction propsとして渡す。Client ComponentからServer Actionsを直接importしない。Zustand/localStorageの既存カートを維持。明細は商品・variant・sizeの複合キー、選択は現カートに存在する明細に限定。各商品は送料の前回寄与分を差し引いて再集計し、unmount時に寄与分を除去する。

読み込みはrole=status、同期失敗はrole=alertと再読込ボタン。保存中はdisabled/aria-busyとrole=status。ストアの通知は `store-toaster.tsx` に集約し、react-hot-toastのライフサイクルと自動消去を保持する。独自描画でrole=status/aria-live=polite、閉じるボタン、成功／エラーアイコンを表示する。通知は最大440px、モバイルで画面幅−32px、長文を折り返し、reduced-motion時に遷移を無効化する。root layoutのRadix/Sonnerは変更しない。

検証: RTLでカート同期・明細・送料・保存成功／失敗・二重送信防止、Playwrightで1440/390/768px、空／商品入り／読み込み／在庫切れ／通知／保存中と失敗、mainと通知のaxe AA、focusと横あふれを確認する。action応答はmockし外部送信・購入は行わない。

[要件](requirements.md) / [計画](../../../plans/layout-design/cart-design-system-plan.md) / [検証記録](../design-system/PROGRESS.md#cart移行記録)
