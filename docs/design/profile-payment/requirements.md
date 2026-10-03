# Profile Payment — 要件

対象: `/profile/payment`（DS-PAGE-030）、PaymentsTable / PaymentTableHeader（DS-COMP-082/083）。[保存計画](../../../plans/layout-design/profile-payment-design-system-plan.md)、[設計](design.md)、[タスク](tasks.md)、[進捗](PROGRESS.md)。

| ID | 受け入れ条件 | 検証 |
|---|---|---|
| PP-1 | account共通の深緑/アイボリー/濃いゴールド、GeorgiaのMy payments h1、日本語リードとサポート導線。 | RTL / Chromium |
| PP-2 | 支払いID、最終更新日、決済ID、方法、金額、状態、既存 `/order/{orderId}` 導線を保持。Stripe/PayPalともドル建て小数2桁、/100しない。長い支払い/決済IDを折り返す。 | RTL / Chromium |
| PP-3 | View all / PayPal / Credit cardのnative button、aria-pressedで選択、4期間のlabel付きselect。 | RTL / Chromium |
| PP-4 | 支払いID/決済ID検索はSearch/Enterで適用、空文字送信で解除。条件変更はpage=1、全解除は方法/期間/検索すべて。ページ変更は適用条件を保持。 | RTL / Chromium |
| PP-5 | 前/次ページ、境界方向disabled、1ページ以下でページャ非表示。現在ページと表示件数のみ表示し、総支払額/総件数を推測しない。 | RTL / Chromium |
| PP-6 | 空はNo payments yet、条件付き空はNo matching paymentsと解除案内、/browse導線。初回/再取得失敗は汎用alertと条件を保つTry again、例外詳細と古い結果は表示しない。 | RTL / Chromium |
| PP-7 | 取得中はstatus/aria-busy/静的スケルトン、操作ロック/ページャ非表示。二重要求を防ぎ、成功した初期表示をmount時に再取得しない。route loadingも同じh1。 | RTL / Chromium |
| PP-8 | 1440/390/768pxで横溢れなし、focus/Enter、axe AA違反0（contrast除外なし）。 | Chromium |
| PP-9 | Server ComponentからqueriesのactionをPropsで渡す。amount number / updatedAt ISOの最小データを返し、所有者制約・認証失敗時DB未実行を維持。Clientの直接action importなし。 | query / RTL |

対象外: 支払い実行/返金、DB/schema/認可変更、注文詳細、他profile本文。ページ内条件はClient stateで保持し、再読込時は初期条件へ戻る。通貨の変更は今回行わず、既存USD表示を保持する。
