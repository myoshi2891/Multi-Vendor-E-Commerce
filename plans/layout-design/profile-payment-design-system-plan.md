# Profile payment デザインシステム移行

- 日付: 2026-10-03。ユーザーの「注文履歴と同様に対応」依頼を承認範囲として実施。
- 対象: DS-PAGE-030 `/profile/payment`、DS-COMP-082 PaymentsTable / DS-COMP-083 PaymentTableHeader。
- 変更: 既存account枠の深緑・アイボリー・ゴールド・セリフ見出し、折り返す支払いカード、nativeフィルター/検索/期間/前後ページ、空/条件付き空/取得中/初回取得失敗/再取得失敗/再試行、route loading。
- サーバー境界: Server ComponentからqueriesのactionをPropsで渡す。表示用facadeでamountをnumber、updatedAtをISO文字列へ変換し、不要な注文/user/currency等をClientへ渡さない。既存getUserPaymentsの入出力・認可・DBクエリは維持。
- 対象外: 支払い実行/返金/決済provider呼び出し、DB/schema/認可変更、注文詳細、他profile本文、先行orders実装の改変。
- 依存: 共通profile layout、既存getUserPayments（所有者、3方法、4期間、ID/intent検索、10件ページ、updatedAt降順）。

## 受け入れ条件

- 支払いID、最終更新日、決済ID、方法、金額、状態、既存 `/order/{orderId}` 導線を保持。Stripe/PayPalともドル建てで2桁表示、/100を行わない。
- My payments h1、サポート導線、空のコレクション導線。1440/390/768pxで長い支払い/決済IDを折り返し、横溢れなし、focus/Enter、axe AA違反0（contrast除外なし）。
- 3方法のnative buttonとaria-pressed、4期間、Search/Enterで検索・空文字送信で解除、条件変更はpage=1、全解除は期間も戻す。ページ変更は適用済み条件を保持。
- 取得中は操作をロックして旧結果/ページャを隠し、二重要求を抑止。失敗は汎用alertで条件を保持し再試行、例外詳細を公開しない。成功した初期結果をmount時に再取得しない。
- Clientの直接action importなし。Serializableな最小表示データ、所有者制約、認証失敗時DB未実行を確認。

## TDDと検証

1. 既存money回帰を保ち、実際のnative操作で見出し/空/検索/期間/全解除/ページング/取得中/再試行の先行RTLを追加しRedを測定。旧無効値を使うmock header/pagination、consoleログだけのテストは新UXに同期。
2. Chromium390px見出しRed、その後1440/390/768pxと全状態/axe/focus/Enter、未認証転送。実Clerkテストsessionと既存localhost:3000、通常データ/遅延/失敗はaction応答mock、実決済なし。
3. Refactor後、payments/orders/profile query/sidebarの関連Jest、lint/tsc、画像目視、diff/リンク/台帳照合。

## 同期対象

- docs/design/profile-payment/{requirements,design,tasks,PROGRESS}.md。
- SDD requirements/architecture/interfaces/workflows/testing。overview/data-model/qualityは確認して変更不要の理由を残す。
- 移行計画/進捗、QA_HANDOFF、TEST_IMPLEMENTATION_PLAN、docs/PROGRESS、coverage dashboard。全体Jest/coverage率は未測定の値を推測更新しない。


## 完了記録（2026-10-03）

- [x] 先行Red、Green、Refactorと関連Jest93/93（4 suites）。
- [x] Chromium5/5、1440/390/768px、全状態/focus/axe、画像目視。
- [x] lint/tsc、仕様/台帳/QA同期、文書リンク整合。

[証跡](../../docs/design/design-system/PROGRESS.md#profile-payment移行記録)。通常データはmock、実決済/全ブラウザー/全E2E/全体coverage未実行。未コミット。
