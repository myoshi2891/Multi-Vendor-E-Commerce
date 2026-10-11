# P1・P2優先8画面のデザインシステム適用・受け入れ

- 日付: 2026-10-11。ユーザー承認: 提示計画の実装・段階的コミット。既存環境のみ使用。
- 正本: [採用計画](design-system-adoption-plan.md)／[進捗](../../docs/design/design-system/PROGRESS.md)。

## 対象・依存関係・受け入れ条件

本体適用済みの画面の残存表示・共通操作・未完了の受け入れを対象とする。store限定purchase themeを先行し、既存表示と機能の実績を保持する。

| Step | ID | 画面 | 受け入れ条件 |
|---|---|---|---|
| 1 | DS-PAGE-006 | /browse | フィルター・商品操作・ページャの表示/focus、検索条件・URL・並び順保持 |
| 2 | DS-PAGE-037 | /store/[storeUrl] | 店舗情報・商品カード・空状態・長文・並び替え |
| 3 | DS-PAGE-019 | /product/[productSlug]/[variantSlug] | 選択・レビュー・共有・購入操作、価格・在庫制約保持 |
| 4 | DS-PAGE-007 | /cart | 残る固定色のtokens化、選択・数量・削除・送料・失敗後保持 |
| 5 | DS-PAGE-008 | /checkout | 住所・クーポン・概要・Portal、pending lock・入力保持・focus復帰 |
| 6 | DS-PAGE-003 | /order/[orderId] | 注文/決済状態・支払操作、単一合計と支払条件保持 |
| 7 | DS-PAGE-009 | /compare | 最大4件・削除/全消去・retry、局所scroll・focus |
| 8 | DS-PAGE-033 | /profile/wishlist/[page] | 件数・商品操作・ページャ・空/失敗、URL/current保持 |

## 境界・インターフェース

- 面・文字・罫線・focus・意味色を既存purchase-themeに集約しroot/Portalへ明示適用。dashboard/旧callerへ波及させない。
- 独立操作は44×44px以上を基本としcheckbox/radioはlabelを含む領域。意味を持つ成功/警告/危険色は維持。
- 必要な共通部品変更は任意の表示指定で既定動作を維持。変更対象ClientのServer ActionはPropsまたは既存API経由。
- API/DB schema/認可/金額/注文決済の業務仕様/PDF装飾は対象外。既存専用環境のみ利用し、DB初期化・顧客作成・実購入/決済送信なし。

## TDD・検証・コミット

- 計画→共通基盤→8画面→最終統合を基本11コミット。各StepはRed（要件違反の期待した失敗）→Green→Refactor→関連検証→文書同期→コミット。
- 実装済みの条件は回帰確認と記録する。不要な変更やRed証跡を作らない。
- RTL: 選択/URL/数量・金額/重複防止/pending/error/retry/success。CSS文字列をなぞるだけのテストを追加しない。
- 既存purchase/commerce/priority/purchase-public suiteと共通fixture serverを拡張。specはtests/browser、新config/serverを作らない。
- 1440/768/390px、通常/空/長文/pending/error/success、Tab/Enter/Escape/focus復帰、overflow/reduced-motion、axe AA、画像目視。
- 各Stepで関連Jest・lint・tsc。最後に全体Jest+coverage・lint・tsc・check:playwright・diff --check・文書リンク/台帳整合。
- 既存DB/認証/SDKの実ルートが確認できなければ理由と解除条件を残し保留。fixture成功で全画面を検証済みにしない。

## 文書同期

採用計画/デザイン進捗、購入残存/compare/wishlist/cart/checkout/order-detailの関連要件・設計・タスク、SDD requirements/quality/testing、QA_HANDOFF/TEST_IMPLEMENTATION_PLANを同期。仕様変更不要の文書は理由とリンクを記録。全体統計は実測のみ正本QAから同期し、coverage測定時はCOVERAGE_REPORT/全体PROGRESS/dashboardも同期する。

## 実施チェック

- [x] 計画保存・対象選定。
- [x] 共通基盤。
- [x] Step 1 商品一覧。
- [x] Step 2 店舗詳細。
- [x] Step 3 商品詳細。
- [x] Step 4 カート。
- [x] Step 5 Checkout。
- [x] Step 6 注文詳細。
- [x] Step 7 比較。
- [x] Step 8 Wishlist。
- [x] 最終統合検証・文書同期。
- [x] 既存環境の実ルート受け入れ（未検証は理由付き保留）。2026-10-11 追加承認で専用DB・Clerk テスト顧客を使い解除。Stripe Elements 描画のみキー期限切れで保留（[記録](../../docs/design/design-system/PROGRESS.md#保留分の実ルート受け入れ2026-10-11)）。


## 最終結果

8ステップ実装/回帰・仕様同期済み。全体Jest3139/3142（3skip）・324suites・127snapshots、補助Chrome131/131、公開実11成功/6skip。実ルート受け入れの未確認範囲と解除条件は[QA](../../docs/testing/QA_HANDOFF.md#ds-purchase-eight-browser)。既存環境のみの範囲で検証し、保留をfixture成功へ読み替えない。
