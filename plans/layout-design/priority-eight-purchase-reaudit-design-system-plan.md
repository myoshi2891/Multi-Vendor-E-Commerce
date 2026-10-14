# P1・P2優先8画面の再監査・残存デザイン適用

- 日付: 2026-10-14。承認: ユーザーの「Implement the plan」と段階的コミット依頼。
- 正本: [採用計画](design-system-adoption-plan.md)／[進捗](../../docs/design/design-system/PROGRESS.md)。既存適用・実ルート検証履歴を保持する。

## 対象・依存関係・受け入れ条件

| Step | ID | 画面 | 重点確認 |
|---|---|---|---|
| 1 | DS-PAGE-006 | /browse | フィルター・並び替え・カード・ページャ、URL条件保持 |
| 2 | DS-PAGE-037 | /store/[storeUrl] | 店舗情報・商品一覧・長文・空状態 |
| 3 | DS-PAGE-019 | /product/[productSlug]/[variantSlug] | ギャラリー・選択・レビュー・共有・在庫制約 |
| 4 | DS-PAGE-007 | /cart | 数量・削除・送料・通知・失敗時保持 |
| 5 | DS-PAGE-008 | /checkout | 住所・クーポン・Portal・pending・retry |
| 6 | DS-PAGE-003 | /order/[orderId] | 注文/決済状態・支払操作・エラー |
| 7 | DS-PAGE-009 | /compare | 比較表・局所scroll・削除・focus復帰 |
| 8 | DS-PAGE-033 | /profile/wishlist/[page] | 保存バリアント・商品操作・ページング・空状態 |

本体と展開部品の実表示を監査する。既存store限定purchase themeを使用し面・文字・罫線・focusを統一する。操作は原則44×44px（checkbox/radioはラベルを含む）。意味色と既定callerの互換性を保持する。差分なしの対象は回帰確認として記録し、不要な実装やRedを作らない。

## 境界・インターフェース

API/DB schema/認可/金額/在庫/決済条件は変更しない。共有部品の追加表示指定は任意。ClientのActionはPropsまたは既存API経由。既存専用環境のみ使用し、DB初期化・実購入・決済送信・外部投稿はしない。

## TDD・検証

新規差分は先行RTL/ブラウザーテストで期待したRed→Green→Refactor。環境障害はRedに数えない。既存実装には回帰確認を記録。

既存purchase/commerce/priority/purchase-public/purchase-route suiteと共通fixtureを拡張し新config/serverを作らない。1440/768/390pxと必要な境界幅、通常/空/長文/loading/pending/error/success、Tab/Enter/Escape・focus復帰・横溢れ・reduced-motion・axe AA・画像目視を検証。

各段階で関連テスト・lint・型検査。最終に全体Jest+coverage、check:playwright、diff --check、文書リンク整合。環境で実行できない必須確認は理由/解除条件を記録し、fixture成功で今回の実route受け入れを代用しない。

## 文書・コミット

計画→必要な共通基盤→画面別8段階→最終統合。各画面はテスト/実装/検証/仕様同期をまとめてコミット。差分なしは回帰確認と監査記録をコミット。

採用計画・デザイン進捗、関連画面のrequirements/design/tasks、SDD品質/テスト仕様、QA_HANDOFF、TEST_IMPLEMENTATION_PLANを同期。仕様変更不要の場合はリンクと理由。全体統計は実測のみQAから同期し、coverage測定時はCOVERAGE_REPORT/全体PROGRESS/dashboardも同期。

## 実施状況

- [x] 計画保存・対象選定。
- [x] Step 1 商品一覧。
- [x] Step 2 店舗詳細。
- [x] Step 3 商品詳細。
- [ ] Step 4 カート。
- [ ] Step 5 Checkout。
- [ ] Step 6 注文詳細。
- [ ] Step 7 比較。
- [ ] Step 8 Wishlist。
- [ ] 最終統合・文書同期。

## 証跡

今回の8画面は対応中。既存画面台帳の判定・過去の受け入れ記録を維持し、今回の結果を追加する。

### Step 1 DS-PAGE-006 商品一覧

Red: sort境界contrast1.85:1で3幅失敗。Green/Refactor: purchaseのreaudit browseとfilter/sort6/6、browse RTL22/22、型成功、lint0 errors/既存8 warnings。境界/hover/Portal選択面を既存purchase tokensへ統一し、複数size/search/URLとfocus復帰を保持。初回listen EPERMと変更後ラベルに対する旧テストlocatorの失敗は製品Redに含めない。

### Step 2 DS-PAGE-037 店舗詳細

既存実装回帰（新規Redなし）: 共通sort修正を店舗でも確認。purchase店舗10/10（1440/850/768/390px、長文/空/カード操作、境界contrast・Portal checked・Escape/focus・URL保持・axe・overflow）、RTL23/23。390px画像目視。型/lintは最終再実行へ継続。店舗固有の追加改修なし。

### Step 3 DS-PAGE-019 商品詳細

Red: 拡大画像を開いてもtriggerにfocusが残る（browser3幅、RTL1件）。Green/Refactor: Radix Dialogへ置換しPortalにtheme/overlayを明示、初期focus・trap・Escape/Close復帰を追加。商品browser12/12、overlay追加後3/3再確認、関連RTL64/64（最終swiper13/13）、型成功、lint0 errors/既存8 warnings。画像選択/alt/在庫/共有契約は保持。
