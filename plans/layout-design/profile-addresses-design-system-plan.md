# Profile addresses デザインシステム移行

- 日付: 2026-10-03。ユーザーの「注文/支払い履歴と同様に対応」依頼を承認範囲として実施。
- 対象: DS-PAGE-021 `/profile/addresses`、DS-COMP-084 AddressContainer。専用カード/フォーム/ダイアログ/loadingとprofile用query facade。
- 既存機能: 住所一覧、追加、編集、既定住所変更。checkoutでの配送先選択は今回の管理画面では操作ではなく既定の表示と変更として提供する。
- 表示: accountの深緑/アイボリー/ゴールド/Georgia、折り返す住所カード、常時表示のnative操作、レスポンシブなRadix dialog、label付き入力、DBに存在する国だけのnative select、空/取得中/失敗/保存中/成功/再試行。
- サーバー境界: src/queries/user.tsのprofile用load/save/default窓口をServer ComponentからPropsで渡す。表示データは住所項目と国id/name/codeのみ。新save入力はsrc/lib/schemas.tsの既存ShippingAddressSchemaを再利用しid(UUID optional)を加える。既存upsertの所有者transaction/既定唯一性を維持し、入力timestampsを任意型にして新窓口が既存createdAtを上書きしない。
- default窓口はrequireUserとid validation、所有者whereで既存住所を読み、既存upsertへ委譲。認可失敗/他人のidで書き込みをしない。
- 対象外: 削除機能の追加、checkout/共有旧address部品のデザイン移行、DB/schema/マイグレーション、購入/配送/認可ポリシーの変更。

## 受け入れ条件

- My shipping addresses h1と日本語リード、空から追加、既存氏名/電話/住所2行/市州/国/郵便番号/既定表示を保持。長い値を省略せず折り返す。
- 1440/390/768pxで本文/ダイアログ/入力エラーに横溢れなし、focus/Tab/Enter/Escape・focus復帰、axe AA違反0（contrast除外なし）。
- 追加と編集は既存Zod/RHF制約を維持。編集では既存値/国/既定を復元。supported countryだけを選択でき、未選択/未入力/不正値は保存しない。
- 保存中は入力/保存/キャンセル/閉じる/外側/ESCをロックし二重要求を防ぐ。失敗は汎用alert、入力を保持して再試行。成功はdialogを閉じ、住所一覧と既定表示、statusを更新する。
- 既定変更はpendingロックと汎用失敗/再試行、成功で最大1件だけ既定表示。単なる表示/カードクリックで保存しない。
- 初回取得失敗の再読込とroute loading、DB国リスト取得失敗を扱う。Client直接action importなし、ユーザー/内部timestampsをClientへ渡さない。

## TDD・検証

1. 先行RTLで見出し/空、追加/編集/入力validation/保存中/失敗/成功/既定変更をRed確認。ブラウザー390pxの見出しRed。
2. query窓口の所有者where、ガード/他人id失敗時に書き込みなし、投影と保存validation/タイムスタンプ保持をテスト。既存user queryの所有者transactionと既定唯一性は回帰確認。
3. Chromium3幅、空/通常/長い住所/ダイアログ/validation/保存中/失敗/成功/編集/既定、focus/Enter/Escape/axe。実Clerk test session、初期空は実query、住所保存/既定/通常fixtureはaction mock。住所DBを書き換えず購入しない。
4. Refactor後の関連Jest、lint、tsc、画像目視、既存profile E2Eのselector整合確認。旧sharedフォーム/checkoutは回帰確認し専用移行と区別。

## 文書同期

- docs/design/profile-addresses/{requirements,design,tasks,PROGRESS}.md、SDD requirements/architecture/interfaces/workflows/testing。
- overview/data-model/qualityは確認し変更不要の根拠を記録。移行計画/台帳、QA_HANDOFF/テスト計画/全体進捗、coverage dashboard。
- 全体Jest/coverage率は再測定したときのみ更新。コミットは明示依頼時のみ。
