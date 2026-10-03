# Profile orders デザインシステム移行

- 日付: 2026-10-02。ユーザーの画面移行・TDD・仕様同期依頼を承認範囲として実施。
- 対象: DS-PAGE-028 `/profile/orders`、同じ本文を使う DS-PAGE-027 `/profile/orders/[filter]`、DS-COMP-080/081。
- 変更: profile共通枠の深緑・アイボリー・ゴールド・セリフ見出し、折り返す注文カード、nativeフィルター・検索・期間・ページング、空・取得失敗/再試行・取得中表示。検索はフォーム送信で適用、全解除は期間も戻す。
- サーバー境界: Server ComponentからqueriesのactionをPropsで渡す。表示用query facadeで金額をnumberに変換し、不要な注文/商品/店舗フィールドをClientへ渡さない。
- 対象外: 注文詳細、購入/支払/配送更新、DB/schema/認可条件、他profile本文、共有status部品そのもの。
- 依存: profile共通layout、既存getUserOrdersの所有者絞り込み・5状態/4期間・検索・10件ページング。

## 受け入れ条件

- 既存注文ID・日付・画像最大5件・明細数・支払/配送状態・金額・詳細URLを保持する。
- 1440/390/768pxで横溢れなし、見出し・ラベル・focus・キーボード操作・axe AA（contrast除外なし）。
- 5状態/4期間、検索の送信/空文字解除、条件変更時page=1、全解除、前後ページが操作可能。取得中は操作をロックし二重送信を防ぐ。
- 失敗時に古い条件の注文を表示せず、条件を保つ再試行を提供。初回取得失敗とroute loadingもブランド表示。
- ClientのServer Action直接importなし、表示用データはシリアライズ可能。

## TDD・検証

1. RTL: アクセシブルな見出し/空、検索/期間/全解除、ページング/取得中/再試行を先行追加し、要件によるRedを測定。既存金額テストは回帰。
2. Playwright: 実Clerkテストsessionと既存localhostサーバー、action応答mockで注文状態を再現（注文作成/購入なし）。PC/mobile/境界、空/通常/長いID/失敗/取得中、focus/Enter/axeを確認。
3. Refactor後関連Jest、lint、tsc、ブラウザー、画像目視、diffと文書リンク整合を確認。

## 同期対象

- docs/design/profile-orders/{requirements,design,tasks,PROGRESS}.md 新設。
- specs/multi-vendor-ecommerce/01-requirements.md / 02-architecture.md / 04-interfaces.md / 05-workflows.md / 07-testing.md。
- 00-overview / 03-data-model / 06-quality は確認し変更不要の根拠を記録。
- デザイン移行計画/進捗、QA_HANDOFF、TEST_IMPLEMENTATION_PLAN、docs/PROGRESS。全体coverage/成功数は再測定時のみ更新。


## 完了記録（2026-10-03）

- [x] 先行Red、Green、Refactorと関連Jest81/81。
- [x] Chromium5/5、1440/390/768px、全状態とfocus/axe、画像目視。
- [x] lint/tsc、仕様/台帳/QA同期、文書リンク整合。

[実施証跡](../../docs/design/design-system/PROGRESS.md#profile-orders移行記録)。通常注文はaction mock、全ブラウザー/全E2E/全体coverage未実行。未コミット。
