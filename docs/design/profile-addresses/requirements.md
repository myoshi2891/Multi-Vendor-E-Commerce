# Profile Addresses — 要件

対象: `/profile/addresses`（DS-PAGE-021）、AddressContainer（DS-COMP-084）。[保存計画](../../../plans/layout-design/profile-addresses-design-system-plan.md)、[設計](design.md)、[タスク](tasks.md)、[進捗](PROGRESS.md)。

| ID | 受け入れ条件 | 検証 |
|---|---|---|
| PA-1 | account共通の深緑/アイボリー/ゴールド、GeorgiaのMy shipping addresses h1、日本語リード、サポート導線。 | RTL / Chromium |
| PA-2 | 氏名/電話/住所2行/市州/国/郵便番号/既定をカードで表示。長い値を省略せず折り返す。 | RTL / Chromium |
| PA-3 | 空から追加、native Edit/Make default操作。編集は既存値・国・既定を復元。単なるカードクリックでは書き込まない。 | RTL / Chromium |
| PA-4 | RHFと既存ShippingAddressSchema制約、label付き入力、DB対応国のnative select。未入力/不正値は保存しない。国なしの場合は追加不可。 | RTL / query / Chromium |
| PA-5 | 保存中は二重送信、入力/Cancel/閉じる/外側/Escapeをロック。スクロール可能なdialog自体をキーボードで操作可能にする。失敗は汎用alert、入力を保持して再試行。成功は一覧とstatusを更新して閉じる。 | RTL / Chromium |
| PA-6 | 既定変更のpending/失敗/再試行、成功時は既定表示を最大1件にする。既存所有者transactionを再利用。 | RTL / query / Chromium |
| PA-7 | 初期取得失敗、再読込中、再試行とroute loading。初期データをmount時に重複取得しない。 | RTL / Chromium |
| PA-8 | 1440/390/768pxで横溢れなし、focus/Tab/Enter/Escape/focus復帰、axe AA違反0（contrast除外なし）。 | Chromium |
| PA-9 | Server Componentから3actionをPropsで渡し、Client直接importなし。user/timestamps等を投影から除外。UUID/フォーム検証、所有者where、認可失敗/他人IDで書き込みなし。createdAtを新フォームで上書きしない。 | query / RTL |

対象外: 削除の追加、checkout/共有旧住所部品の移行、DBモデル/認可ポリシー/配送/購入変更。フォーム制約は既存仕様を保持（氏名は英字、住所2行目のみ任意）。


## 購入後6画面の共通表示（2026-10-10）

[保存計画](../../../plans/layout-design/priority-six-p2-postpurchase-design-system-plan.md)。共通purchaseトークンで面・文字・罫線・選択・focus・操作寸法を表示し、主操作はgold/inkとする。既存機能要件・URL・所有者制約は維持する。独立Portalはテーマを明示し、意味色は色だけに依存させない。
