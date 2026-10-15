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
- [x] Step 3 属性一覧。
- [x] Step 4 属性作成。
- [x] Step 5 属性選択肢。
- [x] Step 6 クーポン一覧。
- [x] Step 7 クーポン作成。
- [x] Step 8 オファータグ一覧。
- [x] 最終統合・文書同期。

今回8画面は実装・仕様同期・認証後の非保存受け入れを完了。台帳を検証済みへ更新し、過去の検証履歴は保持する。

### Step 1 DS-PAGE-043 カテゴリ一覧

Red: MasterDialog作成trigger高さ40pxで6件失敗。Green/Refactor: triggerへcontrol、独立Portalへcontrolsを接続。新6件+親select/reduced-motion1件7/7、既存一覧6/6、関連RTL29/29、型成功、lint0 errors/既存8 warnings。画像aria-hidden proxy入力への検査失敗はテスト対象誤りでRedに含めず除外。390px dark画像確認。既存取得/保存/削除/URL/親候補を保持。

### Step 2 DS-PAGE-042 カテゴリ作成

Red: standalone入力高さ40pxで6件失敗。Green/Refactor: CategoryFormへcontrols、Featured labelへcontrolを適用。p4新旧カテゴリ作成12/12、関連RTL31/31、型成功、lint0 errors/既存8 warnings。3幅/light/dark、親Root/候補・label操作・画像button・入力境界/focus・validation/保存失敗/retry・axe、390px dark画像目視。既存payload/slug/親深さ/Featured/作成遷移を保持。

### Step 3 DS-PAGE-041 属性一覧

Red: メニュー角丸6px（期待3px）で6件失敗、続いて展開時aria-hidden-focusを6件検出。Green/Refactor: styles.popoverとmodal=falseを属性行メニューへ適用。p4新旧属性一覧12/12、関連RTL38/38、型成功、lint0 errors/既存8 warnings。light/dark・3幅・面/影/角丸・menu item44px・focus/Escape・編集/失敗保持/retry・axe、390px dark画像確認。key/scope/archive/convert/URL契約を保持。

### Step 4 DS-PAGE-040 属性作成

Red: 保存成功statusが通常文字色でbrand-success不一致、6件失敗。Green/Refactor: 共通SaveFeedbackへsuccess意味色を接続。p4新旧属性作成12/12、関連RTL22/22、型成功、lint0 errors/既存8 warnings。boolean label44px・ENUM選択・送信/validation/失敗保持/retry・axeと390px dark画像確認。最初の誤ったsubmit名による中断はRedに含めない。カテゴリ/型/scope/key/payload/遷移は不変。

### Step 5 DS-PAGE-039 属性選択肢

Red: 行メニュー角丸6pxで6件失敗。Green/Refactor: 属性一覧と同じpopover/non-modalを選択肢行へ明示。p4新旧選択肢12/12、関連RTLは2ファイルをrunTestsByPathで確認、型成功、lint0 errors/既存8 warnings。3幅/light/dark・menu/編集Portal・Value disabled/Label境界/focus・追加/失敗保持/retry・archive/empty・axe、390px dark画像確認。definitionId/value/label/状態契約は不変。

### Step 6 DS-PAGE-045 クーポン一覧

Red: Activate/Deactivate button高さ40pxで6件失敗。Green/Refactor: ToggleCouponへcontrolを明示。p4新旧一覧12/12、関連RTL38/38、型成功、lint0 errors/既存8 warnings。3幅/light/dark・pending lock・error/retry・同一couponId payload・success意味色・編集/削除/空/取得失敗・axe、390px dark画像確認。scope/期間/有効化/Decimal表示投影と既存Action契約を保持。

### Step 7 DS-PAGE-044 クーポン作成

Red: 独立scope select高さ37pxで6件失敗。Green/Refactor: CouponFormへcontrols、Active labelへcontrolと共有controlの最小幅44px、native checkbox accentをprimaryへ接続。p4新旧作成12/12、関連RTL23/23、型成功、lint0 errors/既存8 warnings。scope切替/Store ID・日時/割引/Active label操作・境界/focus・保存失敗/retry・axeを確認。3幅/light/dark、scope/storeId/isActive/payloadと既存refreshを保持。

### Step 8 DS-PAGE-047 オファータグ一覧

既存実装回帰（新規Redなし）: 共有MasterDialog/SaveFeedbackの適用を確認。p4新旧一覧+対象外独立作成18/18、関連RTL15/15、型成功、lint0 errors/既存8 warnings。3幅/light/dark・取得失敗/retry44px・入力境界/focus・編集/削除/値保持/成功・axe、390px dark画像確認。追加の固有改修なし。name/url/作成と編集のID/遷移を保持。

## 最終結果

全体Jest3168 passed / 3171 total（3 skipped）、327スイート（326 passed／1 skipped）、127 snapshots。Statements88.26%（10969/12428）／Branches78.63%（6785/8628）／Functions84.66%（2147/2536）／Lines88.79%（9988/11248）。dashboard408 files / 405 lcov / 18 of 80 cells。補助ブラウザーp4 104/104＋p3 73/73、認証後実ルート48/48（1440/768/390px × light/dark）。

実ルートは既存専用DBと既存Clerk管理者を読み取り利用し、表示・検索・編集データ取得・メニュー/ダイアログ開閉・Escape focus復帰・44px/境界3:1・theme・overflow・全体axe AAを確認。実保存・削除・archive/restore・型変換・有効化・画像uploadは範囲外で、失敗/retry/pending/successはfixture/RTLで検証。アカウント作成・seed・DB初期化なし。DS-PAGE-046独立オファータグ作成は共有回帰のみ。

コミット順: 81d205aa（計画）→26c4097b→6534136e→b1f4052f→561c22ef→78911e27→8ba2a0a1→a3da744d→f71b318e（画面別8件）→最終統合コミット。
