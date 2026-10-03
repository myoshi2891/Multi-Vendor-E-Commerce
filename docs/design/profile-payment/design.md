# Profile Payment — 設計

[要件](requirements.md)、[保存計画](../../../plans/layout-design/profile-payment-design-system-plan.md)。

- `/profile/payment/page.tsx` はforce-dynamic Server Componentのまま、初回queryのみtry/catchで囲み、汎用失敗状態と `getUserPaymentsForDisplay` をPropsでPaymentsTableへ渡す。
- `src/queries/profile.ts` の表示用facadeは既存getUserPaymentsへ委譲し、id/paymentIntentId/paymentMethod/amount/status/orderId/updatedAtのみ投影。amountはtoNumberSafeでnumberへ、updatedAtはISO文字列へ。注文/user/currency/createdAt等をClientへ渡さない。
- 所有者、方法（paypal→PayPal、credit-card→Stripe）、作成日に対する4期間、支払いID/決済IDのcase-insensitive検索、10件ページ、updatedAt降順を維持。StripeもPayPalも保存単位はドル、表示時の/100は行わない。
- Clientに直接action importはない。初期resultを表示しmount fetchを廃止。単一load関数と同期ref/fieldset disabledで要求を直列化し、取得中/失敗は旧結果を隠す。失敗後は条件を保つ再試行。
- 方法native buttonとaria-pressed、label付きselectとsearch form。旧3秒遅延/3文字しきい値からSearch/Enterでの送信へ変更。draft入力と適用済みsearchを分け、方法/期間変更で未送信draftを適用しない。全解除はdraftとすべての適用条件を戻す。
- PaymentsHeadingを通常/route loadingで共有。本文限定payments.module.cssは既存ordersの配色/余白/focusパターンを採用し、先行orders CSSを変更しない。#17251d、#faf8f2、#75613b、#536356、#c9c7b8とaccount共通枠。
- 支払いごとのol/liカード、h2は支払いID、timeで更新日、dlで決済ID/方法/状態。状態は既存値を表示し色だけに依存しない。詳細リンクは支払いIDを含むアクセシブル名で区別する。
- 1000px以下で見出し導線/検索期間を縦にし、480px以下で金額/詳細項目を縦に折り返す。長いIDはoverflow-wrap:anywhere、gridはminmax(0,1fr)。44px以上の操作領域、focus-visible、静的スケルトン。

検証は既存Clerkテスト顧客の作成/認証/後処理、初期空の実query。通常データ/遅延/失敗/再試行はaction応答mock。支払いDB作成、実決済、返金、seed、DB初期化、providerへの送信を行わない。
