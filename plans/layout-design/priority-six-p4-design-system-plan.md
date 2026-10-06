# P4優先6画面のデザインシステム移行

- 承認: 2026-10-06、会話で対象・自己レビュー・段階コミットを承認済み。
- 正本: [移行台帳](design-system-adoption-plan.md)、[証跡](../../docs/design/design-system/PROGRESS.md#p4優先6画面移行記録)。

## 対象と順序

| Step | ID | URL | 実装・補助検証・文書同期 |
|---|---|---|---|
| 1 | DS-PAGE-043 | /dashboard/admin/categories | [ ] |
| 2 | DS-PAGE-042 | /dashboard/admin/categories/new | [ ] |
| 3 | DS-PAGE-045 | /dashboard/admin/coupons | [ ] |
| 4 | DS-PAGE-044 | /dashboard/admin/coupons/new | [ ] |
| 5 | DS-PAGE-047 | /dashboard/admin/offer-tags | [ ] |
| 6 | DS-PAGE-046 | /dashboard/admin/offer-tags/new | [ ] |

未適用9画面はP4。商品分類・割引・オファーを優先し、属性3画面と既存保留22画面は今回の移行対象外。DB・認可・計算・業務ルール・既存URLは変更しない。

## 変更・依存関係

既存SellerPage/Shellの管理者利用、seller.module.cssのscoped light/darkトークン、DataTable、Dialog、ConfirmDeleteを再利用する。カテゴリ・管理者クーポン・オファータグのフォームと一覧列をAction Props経由にし、関連呼び出し元も同期する。共有部品の他scopeは回帰確認し、一括完了にしない。

## 受け入れ条件・先行テスト

- 各画面に名前付きsection/h1/form。一覧検索・空・取得失敗/retry、作成・編集・削除確認を操作できる。
- 入力validation、同期pending guard、入力/close lock、失敗時値保持・retry・成功status、更新IDと作成後の既存遷移をRTLで先に検証する。
- カテゴリpre-order/親候補/サブツリー深さ/slug/画像/featured、coupon scope/storeId/割引/日時、offer name/urlの既存契約を維持する。
- ブラウザーの先行テストで画面見出し、色/文字、狭幅overflow、focusを確認し、期待する失敗をRed証跡として残す。環境エラーと後追加回帰テストはRedに数えない。

## 検証・コミット

計画コミット後、6画面それぞれRed→Green→Refactor→関連テスト・文書同期→コミット。既存P3 fixture/serverを拡張し、新config/serverは作らない。P4 suiteを既存design configへ登録し、tests/browser/にspecを置く。

1440/768/390px × light/dark、通常/空/長文/validation/pending/error/retry/success、メニューとPortal、Tab/Enter/Escape・focus復帰、axe AA（contrast除外なし）、スクリーンショット目視。対象×部品×状態×証跡チェック表で自己レビューする。既存P3管理者とseller couponの回帰、最終全体Jest・lint・tsc・check:playwright・buildを実施する。

## 文書と実検証の保留

移行台帳・デザイン進捗・admin-dashboard要件/設計/tasks/進捗・SDD requirements/architecture/interfaces/workflows/quality/testing・QA_HANDOFF・TEST_IMPLEMENTATION_PLAN・docs/PROGRESSを同期する。変更不要の仕様も理由を記録する。全体統計・coverageは実測時のみ同期。

専用test DBとClerk管理者環境が利用可能なら認証後実ルートを確認する。不足時は実装あり・補助検証済み・認証後/実Cloudinary保留とし解除条件を記録する。fixtureの成功を実ルート成功にしない。検証目的の既存DB初期化・外部送信は行わない。
