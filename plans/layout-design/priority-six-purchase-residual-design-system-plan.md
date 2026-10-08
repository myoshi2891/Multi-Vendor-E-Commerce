# 購入導線6画面・残存部品のデザイン移行

- 日付: 2026-10-08
- 承認: ユーザーが「購入導線の残存部品を優先」を選択し、提示計画の実装と段階的コミットを依頼。
- 正本: [採用計画](design-system-adoption-plan.md)、[進捗](../../docs/design/design-system/PROGRESS.md)。

## 対象・依存関係

ストア限定の共通トークンを先行し、既存本体を維持して以下の順で残存部品を移行する。

| Step | ID | 対象 | 変更と受け入れ条件 |
|---|---|---|---|
| 1 | DS-PAGE-006 | /browse | filters/cards/focusを統一。カードvariantはhoverとfocusで選択、URL保持、操作44px以上 |
| 2 | DS-PAGE-037 | /store/[storeUrl] | 共有部品、hero/count/empty/linkをtokens化。長文・空・商品あり・sortのURL保持 |
| 3 | DS-PAGE-019 | /product/[productSlug]/[variantSlug] | review select44px以上、card/formの面とfocus統一、既存rating/photo/sort/paging保持 |
| 4 | DS-PAGE-007 | /cart | tokens化、選択label/bulk remove/retryの操作領域44px以上、数量・送料・失敗保持 |
| 5 | DS-PAGE-008 | /checkout | address/coupon/items/summaryとPortalフォームをtokens化。選択・保存・pending lock/focus保持 |
| 6 | DS-PAGE-003 | /order/[orderId] | opt-in状態タグと購入面を統一。意味・文言・single total/payment条件保持 |

## 境界・インターフェース

- 背景/面/文字/罫線/装飾用gold/文字用gold/focus/意味を持つ状態色をCSS Moduleで共有。各root/Portalに明示適用しdashboardに波及させない。
- 状態タグに任意store表示variantを追加し、既定callerは維持する。新しいClientからServer Actionの直接importを追加しない。
- DB/API/認可/金額/在庫/注文・決済状態遷移、管理者属性3画面、PDF装飾、SDK独自描画は対象外。

## TDD・コミット・検証

- 計画→共通tokens→6画面→最終統合の9コミット。各実装単位は先行Red→Green→Refactor→検証→文書同期。コミットは通過状態。
- RTLはfocusによるvariant選択、URL/filters、cart、address/coupon、決済・注文ロックと再試行を検証。CSS文字列をなぞるテストは追加しない。
- 既存purchase/commerce/purchase-public suiteとfixture serverを拡張。1440/768/390px、通常/空/長文/選択/disabled/pending/error/success、Tab/Enter/Escape/focus復帰、Portal、reduced motion、overflow、axe AA、画像目視。
- 各Stepで関連Jest/lint/tsc、最後に全体Jest/check:playwright/diff --check/文書リンク・ID整合。
- 専用test DB/Clerk/SDK不在時は実受け入れを保留し解除条件を記録。fixture成功で全画面を検証済みにしない。
- 同期対象: 採用計画/デザイン進捗、6画面横断受け入れ仕様、cart/checkout/order-detail仕様、SDD requirements/architecture/interfaces/testing、QA_HANDOFF/TEST_IMPLEMENTATION_PLAN。全体統計・coverageは実測のみ。
- overview/data-modelは商品・DB契約不変のため変更不要。COVERAGE_REPORTはセル状態変化時、dashboardはcoverage実測更新時に同期。

## 実施チェック

- [x] 計画保存・対象選定。
- [x] 共通tokensの先行検証・実装・文書同期。
- [x] Step 1 商品一覧。
- [x] Step 2 店舗詳細。
- [x] Step 3 商品詳細。
- [x] Step 4 cart。
- [ ] Step 5 checkout。
- [ ] Step 6 注文詳細。
- [ ] 最終統合検証・仕様/QA同期。
- [ ] 専用DB・Clerkによる実ルート/SDK受け入れ（環境が揃わなければ保留）。
