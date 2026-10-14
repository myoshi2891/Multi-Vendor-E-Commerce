# 管理マスタ優先8画面の残存デザイン移行

- 日付: 2026-10-14。ユーザー承認: 管理マスタ8画面の提示計画を実装、段階的コミット。
- 正本: [採用計画](design-system-adoption-plan.md)／[進捗](../../docs/design/design-system/PROGRESS.md)。

## 対象・依存関係・受け入れ条件

| Step | ID | 対象 | 重点確認 |
|---|---|---|---|
| 1 | DS-PAGE-043 | /dashboard/admin/categories | 検索・作成/編集Dialog・削除 |
| 2 | DS-PAGE-042 | /dashboard/admin/categories/new | 親・画像操作・入力/保存 |
| 3 | DS-PAGE-041 | /dashboard/admin/attributes | 行Menu・編集Portal・archive/restore |
| 4 | DS-PAGE-040 | /dashboard/admin/attributes/new | カテゴリ・型・scope・多値・状態 |
| 5 | DS-PAGE-039 | /dashboard/admin/attributes/[id]/options | ENUM選択肢追加/編集・状態操作 |
| 6 | DS-PAGE-045 | /dashboard/admin/coupons | 編集・Activate/Deactivate・削除 |
| 7 | DS-PAGE-044 | /dashboard/admin/coupons/new | scope/store・割引・日時・保存 |
| 8 | DS-PAGE-047 | /dashboard/admin/offer-tags | 検索・作成/編集Dialog・削除 |

カテゴリ→属性→割引→オファーの順。DS-PAGE-046独立オファータグ作成は共有フォーム回帰対象で8画面に数えない。既存本体適用と検証履歴を保持し残存差分のみ改修。差分なしは既存実装回帰と記録。

## 実装・境界

既存管理者Shell/SellerPage、seller.module.cssのlight/dark tokens、44px controls、Portalスタイルを再利用。MasterDialogのtrigger/入力/取得retry/保存、カテゴリ画像操作、クーポン/オファー操作、属性Menu/編集Portalと状態表示を統一する。checkbox/switchはlabel込み、focus/入力境界は実面に対して3:1以上。共有callerの既定動作を保持する。

API/DB/認可/ActionのI/O・カテゴリ階層/slug・属性key/value/型変換・クーポン計算・既存URLは変更しない。ClientのActionは既存typed Props経由を維持。

## TDD・検証

各画面で先行RTL/browserのRed→Green→Refactor→関連検証→文書同期→コミット。環境失敗と後追加回帰をRedに数えない。RTLはvalidation/payload/同期pending guard/input/dismiss lock/入力保持/retry/success/遷移/focusを検証。CSSソース文字列だけのテストを追加しない。

既存p4 suite/specと共通fixtureを拡張しconfig/serverは新設しない。1440/768/390px×light/dark、通常/空/長文/取得失敗/validation/pending/error/success、Tab/Enter/Escape・focus復帰・Portal・局所scroll・overflow・reduced-motion・axe AA・画像目視。

各Stepで関連Jest/lint/型。最終はp4全体、関連P3/販売者フォーム、全体Jest+coverage、check:playwright、diffと文書リンク整合。既存専用DB/Clerk管理者が利用可能な場合のみ非保存実route受け入れ。実保存/削除/型変換/upload/DB初期化は行わず、不足環境は実装/補助検証と別に保留を記録する。

## 文書・コミット

計画1＋画面別8＋最終統合1を基本10コミット。共有変更は最初の関連Stepに含め後続callerを回帰。採用計画・デザイン進捗・admin-dashboard要件/設計/tasks/進捗・category-tree/attributes関連仕様・SDD品質/testingを同期。変更不要の仕様は理由とリンク。

QA_HANDOFF/TEST_IMPLEMENTATION_PLAN/全体PROGRESSを更新。全体統計/coverage/dashboardは実測のみ同期、過去履歴と台帳IDを保持。

## 実施状況

- [x] 計画保存・対象選定。
- [x] Step 1 カテゴリ一覧。
- [x] Step 2 カテゴリ作成。
- [ ] Step 3 属性一覧。
- [ ] Step 4 属性作成。
- [ ] Step 5 属性選択肢。
- [ ] Step 6 クーポン一覧。
- [ ] Step 7 クーポン作成。
- [ ] Step 8 オファータグ一覧。
- [ ] 最終統合・文書同期。

今回8画面は対応中。既存台帳の画面全体状態は保持し、今回の結果を別記録する。

### Step 1 DS-PAGE-043 カテゴリ一覧

Red: MasterDialog作成trigger高さ40pxで6件失敗。Green/Refactor: triggerへcontrol、独立Portalへcontrolsを接続。新6件+親select/reduced-motion1件7/7、既存一覧6/6、関連RTL29/29、型成功、lint0 errors/既存8 warnings。画像aria-hidden proxy入力への検査失敗はテスト対象誤りでRedに含めず除外。390px dark画像確認。既存取得/保存/削除/URL/親候補を保持。

### Step 2 DS-PAGE-042 カテゴリ作成

Red: standalone入力高さ40pxで6件失敗。Green/Refactor: CategoryFormへcontrols、Featured labelへcontrolを適用。p4新旧カテゴリ作成12/12、関連RTL31/31、型成功、lint0 errors/既存8 warnings。3幅/light/dark、親Root/候補・label操作・画像button・入力境界/focus・validation/保存失敗/retry・axe、390px dark画像目視。既存payload/slug/親深さ/Featured/作成遷移を保持。
