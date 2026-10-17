# 購入導線優先10画面の再監査・残存デザイン適用

日付: 2026-10-18。ユーザー承認: Implement the plan。段階コミットも依頼済み。

## 対象と受け入れ条件

既存68画面の検証履歴を保持し、今回の再監査を別記録する。

|Step|ID|画面|重点|
|---|---|---|---|
|1|DS-PAGE-006|商品一覧|filter/sort/ページング/URL保持|
|2|DS-PAGE-037|店舗詳細|長文/商品/空状態|
|3|DS-PAGE-019|商品詳細|画像Dialog/選択/review/在庫|
|4|DS-PAGE-007|カート|数量/削除/送料/失敗保持|
|5|DS-PAGE-008|Checkout|住所Portal/coupon/pending/retry|
|6|DS-PAGE-003|注文詳細|決済状態/返品/PDFエラー|
|7|DS-PAGE-009|比較|局所scroll/削除/focus復帰|
|8|DS-PAGE-033|Wishlist|保存variant/商品操作/ページング|
|9|DS-PAGE-028|注文一覧|状態/filter/注文導線|
|10|DS-PAGE-030|支払履歴|通常/空/失敗/状態通知|

## 実装境界・依存関係

既存purchase themeとaccount表示、共通fixture/route suiteを再利用。面/文字/罫線/focus/原則44px操作を確認。API/DB/認可/金額/在庫/決済契約は変更しない。共有部品はcaller互換性を保持。購入確定/決済送信/外部投稿/DB初期化は対象外。既存未コミット3ファイルの差分を保持し今回分だけcommitする。

## TDDと検証

不整合は期待する理由の先行Red→Green→Refactor。差分なしは既存実装の回帰確認でRedを創作しない。既存purchase/commerce/priority/postpurchase suiteを使用しconfig/serverを新設しない。1440/768/390pxと必要な境界幅、通常/空/長文/pending/error/retry/success、focus/keyboard/axe AA/overflow/画像目視。各段階で関連test/lint/型、最終で全体Jest+coverage/check:playwright/diff/link確認。実routeが実施できない場合は理由/解除条件を記録し今回の受け入れを保留する。

## 文書と段階コミット

計画保存→画面別10段階→最終統合。画面別にtest/修正/仕様と証跡をcommit。採用計画・デザイン進捗・関連requirements/design/tasks・SDD品質/testing・QA_HANDOFF・TEST_IMPLEMENTATION_PLANを同期。仕様変更不要は参照と理由を記録。全体統計は実測のみQAから同期しcoverage測定時dashboardも更新。

## 実施状況

- [x] 計画保存。
- [x] Step 1: 商品一覧のfixture回帰・文書同期。今回の認証後実routeは最終欄で別判定。
- [ ] Step 2: 店舗詳細。
- [ ] Step 3: 商品詳細。
- [ ] Step 4: カート。
- [ ] Step 5: Checkout。
- [ ] Step 6: 注文詳細。
- [ ] Step 7: 比較。
- [ ] Step 8: Wishlist。
- [ ] Step 9: 注文一覧。
- [ ] Step 10: 支払履歴。
- [ ] 最終統合・文書同期。
