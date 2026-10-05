# 新デザインシステム適用状況・移行計画

- 調査日: 2026-09-30
- 対象: 顧客向け画面、認証画面、出店者画面、管理者画面、共通・補助コンポーネント
- 調査基準: 未コミットの変更を含む現在のワークスペース。HEADだけを基準にしない。
- 文書状態: ソース調査完了／今後の移行と検証状況は[進捗ノート](../../docs/design/design-system/PROGRESS.md)を参照
- この文書の追加はアプリの実装、API変更、DB変更、コミットを伴わない。

## 1. 判断基準と調査範囲

### 1.1 新デザインの基準

ホーム、商品一覧、商品詳細、About、Contact、認証画面で導入した世界観を基準とする。

| 項目 | 基準 |
|---|---|
| 背景・文字 | 深緑 `#0b100e`、アイボリー `#f3f0e8` / `#f1eee4`、濃い文字 `#17251d` |
| 装飾・主操作 | ゴールド `#d4ba83`、明るい面のリンクは可読性を確保した濃いゴールド |
| 文字組み | セリフ体の見出し、本文・入力欄・業務表は読みやすいサンセリフ体 |
| レイアウト | 余白、細い罫線、控えめな装飾、スマートフォンでの読みやすさ |
| 操作 | 通常・選択・hover・focus・disabled・処理中・エラーを確認 |
| アクセシビリティ | キーボード操作、見出し構造、コントラスト、状態通知、動きを減らす設定 |

ブランド色・見出し・フォームの実装は複数のCSS Moduleに分散している。今後は共通トークンを整備するが、単に全画面へ背景色や赤系の置換を一括適用しない。

根拠: [src/app/globals.css](<../../src/app/globals.css>)、[tailwind.config.ts](<../../tailwind.config.ts>)、[src/components/store/home/luxury/luxury.module.css](<../../src/components/store/home/luxury/luxury.module.css>)、[src/components/store/product-page/product.module.css](<../../src/components/store/product-page/product.module.css>)。

### 1.2 判定の意味と限界

| 判定 | 意味 |
|---|---|
| 本体適用・周辺確認 | 新レイアウトやCSS Moduleを使用している。展開部品・共有部品・条件分岐まで完了したことは意味しない |
| 未適用 | ページ本体または主要コンテナが旧レイアウト・既定テーマを使用する |
| 転送専用 | 画面本体がなく、移行先と認証後の戻り先を回帰検証する |
| 仮実装 | 表示内容が仮の文字列のみ。機能整備をデザイン移行とは分ける |
| 利用確認 | 現在の画面からの使用を再確認し、移行・保管・削除候補を判断する |

今回の棚卸しはソースと参照関係による調査。全画面でのログイン、業務データ、決済、認証コード入力を使った実画面監査を完了したものではない。過去に確認した公開画面の結果と、今回のソース判定は区別する。

`bg-white` や `rounded-*` があるだけで未適用とは判定しない。親CSSの上書き、`editorial` 分岐、用途を確認する。成功・警告・危険の赤・緑、商品色、第三者サービスのブランド表示は機能上の意味を維持する。

### 1.3 優先順位

| 優先度 | 対象・理由 |
|---|---|
| P1 | 共通基盤と購入導線。多数の画面へ波及する部品と、購入完了に直接関わる画面 |
| P2 | マイページ、購入後サポート、比較・オファー、適用済み画面の残存部品 |
| P3 | 出店申請、出店者の日常業務、管理者の監視・概要、長文の静的ページ |
| P4 | 管理マスタ、印刷用PDF、現在の利用が未確認の旧部品 |

これは導入順序であり、障害やセキュリティの重大度ではない。アクセス実績による順位は未計測。購入への影響、共通利用、ユーザー操作頻度の想定、依存関係に基づく。

## 2. 全ページの台帳

### 2.1 件数

2026-09-30のcompare・FAQs・profile・wishlist移行により本体適用12・未適用46へ更新。2026-10-01のtrack-order・customer-service・returns-exchange・product-support移行により未適用42・検証済み4へ更新。2026-10-01のcart移行で未適用41・検証済み5へ更新。2026-10-03のorders移行で未適用39・検証済み7、payment移行で未適用38・検証済み8、addresses移行で未適用37・検証済み9、reviews移行で未適用36・検証済み10、messages移行で未適用35・検証済み11へ更新。2026-10-04のcheckout・注文詳細は実装済みだが認証後実ルートの検証保留2、未適用33へ更新（検証済み11は不変）。2026-10-05のoffers/dispute/report-problemは検証済み3追加、following/historyは実装済み・認証後実ルート検証保留2追加。現在は検証済み14・検証保留12・未適用20。検証範囲と証跡は[進捗ノート](../../docs/design/design-system/PROGRESS.md)を参照。

| 区分 | ページ定義 |
|---|---:|
| 顧客向け（store） | 34 |
| 認証（auth） | 2 |
| 全画面表示（fullscreen） | 2 |
| 出店者・管理者（dashboard） | 28 |
| **合計** | **66** |

| 判定 | 件数 |
|---|---:|
| 検証済み（2026-10-05） | 14 |
| 本体適用・周辺確認 | 12 |
| 本体適用・検証保留 | 12 |
| 未適用 | 20 |
| 仮実装 | 1 |
| 転送専用 | 7 |
| **合計** | **66** |

動的パラメーターとページングは「ページ定義」単位で数える。実データごとのURL数ではない。

### 2.2 全66ページ

| URL | 判定 | 優先度 | 根拠ファイル |
|---|---|---|---|
| `/sign-in` | 本体適用・周辺確認 | 周辺部品を監査 | [src/app/(auth)/sign-in/[[...sign-in]]/page.tsx](<../../src/app/(auth)/sign-in/[[...sign-in]]/page.tsx>) |
| `/sign-up` | 本体適用・周辺確認 | 周辺部品を監査 | [src/app/(auth)/sign-up/[[...sign-up]]/page.tsx](<../../src/app/(auth)/sign-up/[[...sign-up]]/page.tsx>) |
| `/order/[orderId]` | 本体適用・検証保留（2026-10-04） | P1 | [src/app/(fullscreen)/order/[orderId]/page.tsx](<../../src/app/(fullscreen)/order/[orderId]/page.tsx>) |
| `/seller/apply` | 本体適用・検証保留（2026-10-05） | P3 | [src/app/(fullscreen)/seller/apply/page.tsx](<../../src/app/(fullscreen)/seller/apply/page.tsx>) |
| `/about` | 本体適用・周辺確認 | 周辺部品を監査 | [src/app/(store)/about/page.tsx](<../../src/app/(store)/about/page.tsx>) |
| `/browse` | 本体適用・周辺確認 | 周辺部品を監査 | [src/app/(store)/browse/page.tsx](<../../src/app/(store)/browse/page.tsx>) |
| `/cart` | 検証済み（2026-10-01） | P1 | [src/app/(store)/cart/page.tsx](<../../src/app/(store)/cart/page.tsx>) |
| `/checkout` | 本体適用・検証保留（2026-10-04） | P1 | [src/app/(store)/checkout/page.tsx](<../../src/app/(store)/checkout/page.tsx>) |
| `/compare` | 本体適用・周辺確認 | P2 | [src/app/(store)/compare/page.tsx](<../../src/app/(store)/compare/page.tsx>) |
| `/contact` | 本体適用・周辺確認 | 周辺部品を監査 | [src/app/(store)/contact/page.tsx](<../../src/app/(store)/contact/page.tsx>) |
| `/customer-service` | 検証済み（2026-10-01） | P2 | [src/app/(store)/customer-service/page.tsx](<../../src/app/(store)/customer-service/page.tsx>) |
| `/dispute` | 検証済み（2026-10-05） | P2 | [src/app/(store)/dispute/page.tsx](<../../src/app/(store)/dispute/page.tsx>) |
| `/faq` | 転送専用 | 回帰検証 | [src/app/(store)/faq/page.tsx](<../../src/app/(store)/faq/page.tsx>) |
| `/faqs` | 本体適用・周辺確認 | P3 | [src/app/(store)/faqs/page.tsx](<../../src/app/(store)/faqs/page.tsx>) |
| `/legal` | 未適用 | P3 | [src/app/(store)/legal/page.tsx](<../../src/app/(store)/legal/page.tsx>) |
| `/offers` | 検証済み（2026-10-05） | P2 | [src/app/(store)/offers/page.tsx](<../../src/app/(store)/offers/page.tsx>) |
| `/` | 本体適用・周辺確認 | 周辺部品を監査 | [src/app/(store)/page.tsx](<../../src/app/(store)/page.tsx>) |
| `/product-support` | 検証済み（2026-10-01） | P3 | [src/app/(store)/product-support/page.tsx](<../../src/app/(store)/product-support/page.tsx>) |
| `/product/[productSlug]/[variantSlug]` | 本体適用・周辺確認 | 周辺部品を監査 | [src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx](<../../src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx>) |
| `/product/[productSlug]` | 転送専用 | 回帰検証 | [src/app/(store)/product/[productSlug]/page.tsx](<../../src/app/(store)/product/[productSlug]/page.tsx>) |
| `/profile/addresses` | 検証済み | P2 | [src/app/(store)/profile/addresses/page.tsx](<../../src/app/(store)/profile/addresses/page.tsx>) |
| `/profile/following/[page]` | 本体適用・検証保留（2026-10-05） | P2 | [src/app/(store)/profile/following/[page]/page.tsx](<../../src/app/(store)/profile/following/[page]/page.tsx>) |
| `/profile/following` | 転送専用 | 回帰検証 | [src/app/(store)/profile/following/page.tsx](<../../src/app/(store)/profile/following/page.tsx>) |
| `/profile/history/[page]` | 本体適用・検証保留（2026-10-05） | P2 | [src/app/(store)/profile/history/[page]/page.tsx](<../../src/app/(store)/profile/history/[page]/page.tsx>) |
| `/profile/history` | 転送専用 | 回帰検証 | [src/app/(store)/profile/history/page.tsx](<../../src/app/(store)/profile/history/page.tsx>) |
| `/profile/messages` | 検証済み | P2 | [src/app/(store)/profile/messages/page.tsx](<../../src/app/(store)/profile/messages/page.tsx>) |
| `/profile/orders/[filter]` | 検証済み | P2 | [src/app/(store)/profile/orders/[filter]/page.tsx](<../../src/app/(store)/profile/orders/[filter]/page.tsx>) |
| `/profile/orders` | 検証済み | P2 | [src/app/(store)/profile/orders/page.tsx](<../../src/app/(store)/profile/orders/page.tsx>) |
| `/profile` | 本体適用・周辺確認 | P2 | [src/app/(store)/profile/page.tsx](<../../src/app/(store)/profile/page.tsx>) |
| `/profile/payment` | 検証済み | P2 | [src/app/(store)/profile/payment/page.tsx](<../../src/app/(store)/profile/payment/page.tsx>) |
| `/profile/reviews` | 検証済み | P2 | [src/app/(store)/profile/reviews/page.tsx](<../../src/app/(store)/profile/reviews/page.tsx>) |
| `/profile/settings` | 本体適用・検証保留（2026-10-05） | P2 | [src/app/(store)/profile/settings/page.tsx](<../../src/app/(store)/profile/settings/page.tsx>) |
| `/profile/wishlist/[page]` | 本体適用・周辺確認 | P2 | [src/app/(store)/profile/wishlist/[page]/page.tsx](<../../src/app/(store)/profile/wishlist/[page]/page.tsx>) |
| `/profile/wishlist` | 転送専用 | 回帰検証 | [src/app/(store)/profile/wishlist/page.tsx](<../../src/app/(store)/profile/wishlist/page.tsx>) |
| `/report-problem` | 検証済み（2026-10-05） | P2 | [src/app/(store)/report-problem/page.tsx](<../../src/app/(store)/report-problem/page.tsx>) |
| `/returns-exchange` | 検証済み（2026-10-01） | P2 | [src/app/(store)/returns-exchange/page.tsx](<../../src/app/(store)/returns-exchange/page.tsx>) |
| `/store/[storeUrl]` | 本体適用・周辺確認 | 周辺部品を監査 | [src/app/(store)/store/[storeUrl]/page.tsx](<../../src/app/(store)/store/[storeUrl]/page.tsx>) |
| `/track-order` | 検証済み（2026-10-01） | P2 | [src/app/(store)/track-order/page.tsx](<../../src/app/(store)/track-order/page.tsx>) |
| `/dashboard/admin/attributes/[id]/options` | 未適用 | P4 | [src/app/dashboard/admin/attributes/[id]/options/page.tsx](<../../src/app/dashboard/admin/attributes/[id]/options/page.tsx>) |
| `/dashboard/admin/attributes/new` | 未適用 | P4 | [src/app/dashboard/admin/attributes/new/page.tsx](<../../src/app/dashboard/admin/attributes/new/page.tsx>) |
| `/dashboard/admin/attributes` | 未適用 | P4 | [src/app/dashboard/admin/attributes/page.tsx](<../../src/app/dashboard/admin/attributes/page.tsx>) |
| `/dashboard/admin/categories/new` | 未適用 | P4 | [src/app/dashboard/admin/categories/new/page.tsx](<../../src/app/dashboard/admin/categories/new/page.tsx>) |
| `/dashboard/admin/categories` | 未適用 | P4 | [src/app/dashboard/admin/categories/page.tsx](<../../src/app/dashboard/admin/categories/page.tsx>) |
| `/dashboard/admin/coupons/new` | 未適用 | P4 | [src/app/dashboard/admin/coupons/new/page.tsx](<../../src/app/dashboard/admin/coupons/new/page.tsx>) |
| `/dashboard/admin/coupons` | 未適用 | P4 | [src/app/dashboard/admin/coupons/page.tsx](<../../src/app/dashboard/admin/coupons/page.tsx>) |
| `/dashboard/admin/offer-tags/new` | 未適用 | P4 | [src/app/dashboard/admin/offer-tags/new/page.tsx](<../../src/app/dashboard/admin/offer-tags/new/page.tsx>) |
| `/dashboard/admin/offer-tags` | 未適用 | P4 | [src/app/dashboard/admin/offer-tags/page.tsx](<../../src/app/dashboard/admin/offer-tags/page.tsx>) |
| `/dashboard/admin/orders` | 未適用 | P3 | [src/app/dashboard/admin/orders/page.tsx](<../../src/app/dashboard/admin/orders/page.tsx>) |
| `/dashboard/admin` | 未適用 | P3 | [src/app/dashboard/admin/page.tsx](<../../src/app/dashboard/admin/page.tsx>) |
| `/dashboard/admin/stores` | 未適用 | P3 | [src/app/dashboard/admin/stores/page.tsx](<../../src/app/dashboard/admin/stores/page.tsx>) |
| `/dashboard` | 転送専用 | 回帰検証 | [src/app/dashboard/page.tsx](<../../src/app/dashboard/page.tsx>) |
| `/dashboard/seller` | 転送専用 | 回帰検証 | [src/app/dashboard/seller/page.tsx](<../../src/app/dashboard/seller/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/coupons/new` | 未適用 | P3 | [src/app/dashboard/seller/stores/[storeUrl]/coupons/new/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/coupons/new/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/coupons` | 未適用 | P3 | [src/app/dashboard/seller/stores/[storeUrl]/coupons/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/coupons/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/inventory` | 本体適用・検証保留（2026-10-05） | P3 | [src/app/dashboard/seller/stores/[storeUrl]/inventory/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/inventory/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/messages` | 本体適用・検証保留（2026-10-05） | P3 | [src/app/dashboard/seller/stores/[storeUrl]/messages/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/messages/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/orders` | 本体適用・検証保留（2026-10-05） | P3 | [src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]` | 本体適用・検証保留（2026-10-05） | P3 | [src/app/dashboard/seller/stores/[storeUrl]/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]` | 未適用 | P3 | [src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new` | 未適用 | P3 | [src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/products/new` | 本体適用・検証保留（2026-10-05） | P3 | [src/app/dashboard/seller/stores/[storeUrl]/products/new/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/products/new/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/products` | 本体適用・検証保留（2026-10-05） | P3 | [src/app/dashboard/seller/stores/[storeUrl]/products/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/products/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/settings` | 未適用 | P3 | [src/app/dashboard/seller/stores/[storeUrl]/settings/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/settings/page.tsx>) |
| `/dashboard/seller/stores/[storeUrl]/shipping` | 未適用 | P3 | [src/app/dashboard/seller/stores/[storeUrl]/shipping/page.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/shipping/page.tsx>) |
| `/dashboard/seller/stores/new` | 未適用 | P3 | [src/app/dashboard/seller/stores/new/page.tsx](<../../src/app/dashboard/seller/stores/new/page.tsx>) |
| `/dashboard/seller/stores` | 仮実装 | P3・機能課題別枠 | [src/app/dashboard/seller/stores/page.tsx](<../../src/app/dashboard/seller/stores/page.tsx>) |

### 2.3 特に留意する画面

- `/browse`、商品詳細、店舗詳細は主要デザインが適用済み。旧スタイルの文字列があっても、親CSSや`editorial`で適用される表示を二重に改修しない。
- `/profile/wishlist/[page]`、閲覧履歴、フォロー店舗、比較は通常カードや共通価格・ページャーなどを使用する。適用済みの一覧画面とは別に確認する。
- `/profile/settings` のClerk UserProfileは幅の調整のみ。サインイン・新規登録のテーマ設定が自動的に適用されたと扱わない。
- `/contact` はページ側CSSでSupportFormを装飾する。他のサポート画面や成功後のoutputまで共通デザインが適用されたかは個別に確認する。
- `/dashboard/seller/stores` は現在「SellerStoresPage」のみを返す。店舗一覧機能の整備は別課題として起票し、この計画だけで仕様を追加しない。
- `/faq`などの転送専用画面には新規UIを作らない。

## 3. コンポーネント単位の対応台帳

各行のチェックは検証・文書同期まで含む移行完了を表す。詳細状態と証跡の正本は[進捗ノート](../../docs/design/design-system/PROGRESS.md)。初期登録時点では部品単位の移行完了は未確認。グループの記述がファイル内の全要素に同じ残存スタイルがあることを意味するわけではない。呼び出し元、バリエーション、展開時、Portal内の実表示を実装前に確認する。

### ヘッダー展開部品（P1）

展開時に旧白背景・大きな角丸・赤系強調が残る。ヘッダー外枠と別に確認する。

- [ ] [src/components/store/layout/header/user-menu/user-menu.tsx](<../../src/components/store/layout/header/user-menu/user-menu.tsx>)
- [ ] [src/components/store/layout/header/search/search.tsx](<../../src/components/store/layout/header/search/search.tsx>)
- [ ] [src/components/store/layout/header/search/suggestions.tsx](<../../src/components/store/layout/header/search/suggestions.tsx>)
- [ ] [src/components/store/layout/header/country-lang-curr-selector.tsx](<../../src/components/store/layout/header/country-lang-curr-selector.tsx>)
- [ ] [src/components/shared/country-selector.tsx](<../../src/components/shared/country-selector.tsx>)

### 基本操作・フォーム（P1）

store/ui の旧赤系Buttonと角丸入力。共通UIはテーマ既定値のため、利用先の上書き・Portalを含めて確認。

- [ ] [src/components/store/ui/button.tsx](<../../src/components/store/ui/button.tsx>)
- [ ] [src/components/store/ui/input.tsx](<../../src/components/store/ui/input.tsx>)
- [ ] [src/components/store/ui/select.tsx](<../../src/components/store/ui/select.tsx>)
- [ ] [src/components/store/ui/textarea.tsx](<../../src/components/store/ui/textarea.tsx>)
- [ ] [src/components/ui/button.tsx](<../../src/components/ui/button.tsx>)
- [ ] [src/components/ui/input.tsx](<../../src/components/ui/input.tsx>)
- [ ] [src/components/ui/textarea.tsx](<../../src/components/ui/textarea.tsx>)
- [ ] [src/components/ui/select.tsx](<../../src/components/ui/select.tsx>)
- [ ] [src/components/ui/form.tsx](<../../src/components/ui/form.tsx>)
- [ ] [src/components/ui/label.tsx](<../../src/components/ui/label.tsx>)
- [ ] [src/components/ui/checkbox.tsx](<../../src/components/ui/checkbox.tsx>)
- [ ] [src/components/ui/radio-group.tsx](<../../src/components/ui/radio-group.tsx>)
- [ ] [src/components/ui/switch.tsx](<../../src/components/ui/switch.tsx>)

### モーダル・配送先（P1）

共通Modalに min-w-[800px]。住所操作は購入手続き・マイページへ波及。

- [ ] [src/components/store/shared/modal.tsx](<../../src/components/store/shared/modal.tsx>)
- [ ] [src/components/store/shared/shipping-addresses/shipping-addresses.tsx](<../../src/components/store/shared/shipping-addresses/shipping-addresses.tsx>)
- [ ] [src/components/store/shared/shipping-addresses/address-details.tsx](<../../src/components/store/shared/shipping-addresses/address-details.tsx>)
- [ ] [src/components/ui/dialog.tsx](<../../src/components/ui/dialog.tsx>)
- [ ] [src/components/ui/alert-dialog.tsx](<../../src/components/ui/alert-dialog.tsx>)
- [ ] [src/components/ui/drawer.tsx](<../../src/components/ui/drawer.tsx>)
- [ ] [src/components/ui/sheet.tsx](<../../src/components/ui/sheet.tsx>)

### カート・購入手続き（P1）

白・灰色面、赤系操作、固定幅380pxの合計欄などが残る。数量・金額・配送・注文処理を保護。

- [x] [src/components/store/cart-page/container.tsx](<../../src/components/store/cart-page/container.tsx>)
- [x] [src/components/store/cart-page/cart-header.tsx](<../../src/components/store/cart-page/cart-header.tsx>)
- [x] [src/components/store/cart-page/summary.tsx](<../../src/components/store/cart-page/summary.tsx>)
- [x] [src/components/store/cart-page/empty-cart.tsx](<../../src/components/store/cart-page/empty-cart.tsx>)
- [x] [src/components/store/cards/cart-product.tsx](<../../src/components/store/cards/cart-product.tsx>)
- [ ] [src/components/store/checkout-page/container.tsx](<../../src/components/store/checkout-page/container.tsx>)
- [ ] [src/components/store/cards/checkout-product.tsx](<../../src/components/store/cards/checkout-product.tsx>)
- [ ] [src/components/store/cards/place-order.tsx](<../../src/components/store/cards/place-order.tsx>)
- [ ] [src/components/store/forms/apply-coupon.tsx](<../../src/components/store/forms/apply-coupon.tsx>)
- [ ] [src/components/store/cards/fast-delivery.tsx](<../../src/components/store/cards/fast-delivery.tsx>)
- [ ] [src/components/store/product-page/returns-security-privacy-card.tsx](<../../src/components/store/product-page/returns-security-privacy-card.tsx>)
- [ ] [src/components/store/shared/country-note.tsx](<../../src/components/store/shared/country-note.tsx>)

### 注文・支払い（P1）

注文画面の旧青系リンク・白面。Stripe appearance 未設定、PayPal style 未設定。外部SDK内は対応可能範囲を確認。

- [ ] [src/components/store/order-page/header.tsx](<../../src/components/store/order-page/header.tsx>)
- [ ] [src/components/store/order-page/groups-container.tsx](<../../src/components/store/order-page/groups-container.tsx>)
- [ ] [src/components/store/order-page/group-table.tsx](<../../src/components/store/order-page/group-table.tsx>)
- [ ] [src/components/store/order-page/product-row.tsx](<../../src/components/store/order-page/product-row.tsx>)
- [ ] [src/components/store/order-page/payment.tsx](<../../src/components/store/order-page/payment.tsx>)
- [ ] [src/components/store/cards/order/info.tsx](<../../src/components/store/cards/order/info.tsx>)
- [ ] [src/components/store/cards/order/total.tsx](<../../src/components/store/cards/order/total.tsx>)
- [ ] [src/components/store/cards/order/user.tsx](<../../src/components/store/cards/order/user.tsx>)
- [ ] [src/components/store/cards/payment/stripe/stripe-wrapper.tsx](<../../src/components/store/cards/payment/stripe/stripe-wrapper.tsx>)
- [ ] [src/components/store/cards/payment/stripe/stripe-payment.tsx](<../../src/components/store/cards/payment/stripe/stripe-payment.tsx>)
- [ ] [src/components/store/cards/payment/paypal/paypal-wrapper.tsx](<../../src/components/store/cards/payment/paypal/paypal-wrapper.tsx>)
- [ ] [src/components/store/cards/payment/paypal/paypal-payment.tsx](<../../src/components/store/cards/payment/paypal/paypal-payment.tsx>)

### 商品・店舗カードと一覧（P2）

editorial 分岐は適用済み。通常表示は旧デザインが残るため、呼び出し元と両分岐を確認する。

- [ ] [src/components/store/cards/product/product-card.tsx](<../../src/components/store/cards/product/product-card.tsx>)
- [ ] [src/components/store/cards/product/swiper.tsx](<../../src/components/store/cards/product/swiper.tsx>)
- [ ] [src/components/store/cards/product/variant-switcher.tsx](<../../src/components/store/cards/product/variant-switcher.tsx>)
- [ ] [src/components/store/product-page/product-info/product-price.tsx](<../../src/components/store/product-page/product-info/product-price.tsx>)
- [ ] [src/components/store/cards/store-card.tsx](<../../src/components/store/cards/store-card.tsx>)
- [ ] [src/components/store/shared/product-list.tsx](<../../src/components/store/shared/product-list.tsx>)
- [x] [src/components/store/compare/compare-grid.tsx](<../../src/components/store/compare/compare-grid.tsx>)

### ページング・フィルター（P2）

共通Paginationに赤系が残る。browse側の親CSSで上書きされる表示を未適用と誤判定しない。

- [ ] [src/components/store/shared/pagination.tsx](<../../src/components/store/shared/pagination.tsx>)
- [ ] [src/components/store/browse-page/browse-pagination.tsx](<../../src/components/store/browse-page/browse-pagination.tsx>)
- [ ] [src/components/store/browse-page/filters/header.tsx](<../../src/components/store/browse-page/filters/header.tsx>)
- [ ] [src/components/store/browse-page/filters/category/category-filter.tsx](<../../src/components/store/browse-page/filters/category/category-filter.tsx>)
- [ ] [src/components/store/browse-page/filters/category/category-link.tsx](<../../src/components/store/browse-page/filters/category/category-link.tsx>)
- [ ] [src/components/store/browse-page/filters/offer/offer-filter.tsx](<../../src/components/store/browse-page/filters/offer/offer-filter.tsx>)
- [ ] [src/components/store/browse-page/filters/offer/offer-link.tsx](<../../src/components/store/browse-page/filters/offer/offer-link.tsx>)
- [ ] [src/components/store/browse-page/filters/size/size-filter.tsx](<../../src/components/store/browse-page/filters/size/size-filter.tsx>)
- [ ] [src/components/store/browse-page/filters/size/size-link.tsx](<../../src/components/store/browse-page/filters/size/size-link.tsx>)

### 商品詳細・レビューの残存確認（P2）

主要部分はproduct.module.css適用済み。通常表示、ページャー、投稿、画像、読み込み・在庫なしを追加確認。

- [ ] [src/components/store/shared/countdown.tsx](<../../src/components/store/shared/countdown.tsx>)
- [ ] [src/components/store/product-page/product-info/product-info.tsx](<../../src/components/store/product-page/product-info/product-info.tsx>)
- [ ] [src/components/store/product-page/product-info/product-watch.tsx](<../../src/components/store/product-page/product-info/product-watch.tsx>)
- [ ] [src/components/store/product-page/reviews/product-reviews.tsx](<../../src/components/store/product-page/reviews/product-reviews.tsx>)
- [ ] [src/components/store/product-page/reviews/filters.tsx](<../../src/components/store/product-page/reviews/filters.tsx>)
- [ ] [src/components/store/product-page/reviews/sort.tsx](<../../src/components/store/product-page/reviews/sort.tsx>)
- [ ] [src/components/store/cards/review.tsx](<../../src/components/store/cards/review.tsx>)
- [ ] [src/components/store/cards/product-rating.tsx](<../../src/components/store/cards/product-rating.tsx>)
- [ ] [src/components/store/cards/rating-statistics.tsx](<../../src/components/store/cards/rating-statistics.tsx>)
- [ ] [src/components/store/forms/review-details.tsx](<../../src/components/store/forms/review-details.tsx>)
- [ ] [src/components/store/shared/upload-images.tsx](<../../src/components/store/shared/upload-images.tsx>)

### マイページ（P2）

ProfileLayoutは灰色面。サイドバー・表・概要・空状態を一体で移行。

- [x] [src/components/store/layout/profile-sidebar/sidebar.tsx](<../../src/components/store/layout/profile-sidebar/sidebar.tsx>)
- [x] [src/components/store/profile/overview.tsx](<../../src/components/store/profile/overview.tsx>)
- [x] [src/components/store/profile/orders-overview.tsx](<../../src/components/store/profile/orders-overview.tsx>)
- [x] [src/components/store/profile/orders/orders-table.tsx](<../../src/components/store/profile/orders/orders-table.tsx>)
- [x] [src/components/store/profile/orders/order-table-header.tsx](<../../src/components/store/profile/orders/order-table-header.tsx>)
- [x] [src/components/store/profile/payments/payments-table.tsx](<../../src/components/store/profile/payments/payments-table.tsx>)
- [x] [src/components/store/profile/payments/payment-table-header.tsx](<../../src/components/store/profile/payments/payment-table-header.tsx>)
- [x] [src/components/store/profile/addresses/container.tsx](<../../src/components/store/profile/addresses/container.tsx>)
- [x] [src/components/store/profile/wishlist/container.tsx](<../../src/components/store/profile/wishlist/container.tsx>)
- [ ] [src/components/store/profile/following/container.tsx](<../../src/components/store/profile/following/container.tsx>)
- [x] [src/components/store/profile/reviews/reviews-container.tsx](<../../src/components/store/profile/reviews/reviews-container.tsx>)
- [x] [src/components/store/profile/reviews/reviews-header.tsx](<../../src/components/store/profile/reviews/reviews-header.tsx>)

### メッセージ共用部品（P2）

幅300pxの会話一覧・固定高520px・旧青系送信。購入者と出店者の両画面を検証する。

- [ ] [src/components/shared/messages/messages-layout.tsx](<../../src/components/shared/messages/messages-layout.tsx>)
- [x] [src/components/store/profile/messages/messages-container.tsx](<../../src/components/store/profile/messages/messages-container.tsx>)
- [ ] [src/components/store/profile/messages/conversation-thread.tsx](<../../src/components/store/profile/messages/conversation-thread.tsx>)
- [ ] [src/components/dashboard/seller/seller-messages-container.tsx](<../../src/components/dashboard/seller/seller-messages-container.tsx>)

### サポート・追跡（P2）

Contactの親CSSによる適用と、他のSupportForm呼び出し先を区別。受付完了・エラー・結果カードまで対応。

- [x] [src/components/store/support/support-form.tsx](<../../src/components/store/support/support-form.tsx>)
- [x] [src/components/store/track-order/track-order-form.tsx](<../../src/components/store/track-order/track-order-form.tsx>)
- [x] [src/components/store/track-order/track-order-result.tsx](<../../src/components/store/track-order/track-order-result.tsx>)

### 通知・状態・補助UI（P2）

ブランド表現の統一候補。成功・警告・危険・在庫・支払いの意味を示す色は維持。

- [ ] [src/components/shared/order-status.tsx](<../../src/components/shared/order-status.tsx>)
- [ ] [src/components/shared/payment-status.tsx](<../../src/components/shared/payment-status.tsx>)
- [ ] [src/components/shared/product-status.tsx](<../../src/components/shared/product-status.tsx>)
- [ ] [src/components/shared/store-status.tsx](<../../src/components/shared/store-status.tsx>)
- [ ] [src/components/ui/badge.tsx](<../../src/components/ui/badge.tsx>)
- [ ] [src/components/ui/alert.tsx](<../../src/components/ui/alert.tsx>)
- [ ] [src/components/ui/toast.tsx](<../../src/components/ui/toast.tsx>)
- [ ] [src/components/ui/toaster.tsx](<../../src/components/ui/toaster.tsx>)
- [ ] [src/components/ui/sonner.tsx](<../../src/components/ui/sonner.tsx>)
- [ ] [src/components/ui/skeleton.tsx](<../../src/components/ui/skeleton.tsx>)
- [ ] [src/components/ui/progress.tsx](<../../src/components/ui/progress.tsx>)
- [ ] [src/components/ui/tooltip.tsx](<../../src/components/ui/tooltip.tsx>)
- [ ] [src/components/ui/popover.tsx](<../../src/components/ui/popover.tsx>)
- [ ] [src/components/ui/dropdown-menu.tsx](<../../src/components/ui/dropdown-menu.tsx>)
- [ ] [src/components/ui/command.tsx](<../../src/components/ui/command.tsx>)
- [ ] [src/components/ui/accordion.tsx](<../../src/components/ui/accordion.tsx>)
- [ ] [src/components/ui/tabs.tsx](<../../src/components/ui/tabs.tsx>)

### 出店申請（P3）

MinimalHeaderはブランドロゴ使用済み。申請ページの青系面・各ステップ・進捗を移行。

- [ ] [src/components/store/layout/minimal-header/header.tsx](<../../src/components/store/layout/minimal-header/header.tsx>)
- [ ] [src/components/store/forms/apply-seller/apply-seller.tsx](<../../src/components/store/forms/apply-seller/apply-seller.tsx>)
- [ ] [src/components/store/forms/apply-seller/progress-bar.tsx](<../../src/components/store/forms/apply-seller/progress-bar.tsx>)
- [ ] [src/components/store/forms/apply-seller/instructions.tsx](<../../src/components/store/forms/apply-seller/instructions.tsx>)
- [ ] [src/components/store/forms/apply-seller/animated-container.tsx](<../../src/components/store/forms/apply-seller/animated-container.tsx>)
- [ ] [src/components/store/forms/apply-seller/steps/step-1/step-1.tsx](<../../src/components/store/forms/apply-seller/steps/step-1/step-1.tsx>)
- [ ] [src/components/store/forms/apply-seller/steps/step-1/user-details.tsx](<../../src/components/store/forms/apply-seller/steps/step-1/user-details.tsx>)
- [ ] [src/components/store/forms/apply-seller/steps/step-2/step-2.tsx](<../../src/components/store/forms/apply-seller/steps/step-2/step-2.tsx>)
- [ ] [src/components/store/forms/apply-seller/steps/step-3/step-3.tsx](<../../src/components/store/forms/apply-seller/steps/step-3/step-3.tsx>)
- [ ] [src/components/store/forms/apply-seller/steps/step-4/step-4.tsx](<../../src/components/store/forms/apply-seller/steps/step-4/step-4.tsx>)

### 静的コンテンツ（P3）

Aboutは独立の新レイアウト。共通StaticPageLayoutは旧見出し・本文・目次のまま。

- [ ] [src/components/store/static/static-page-layout.tsx](<../../src/components/store/static/static-page-layout.tsx>)

### ダッシュボード共通（P3）

ロゴは新ブランドを使用済み。固定幅300pxのSidebar、Header、店舗切替、表、モーダル、テーマを整備。

- [ ] [src/components/dashboard/header/Header.tsx](<../../src/components/dashboard/header/Header.tsx>)
- [ ] [src/components/dashboard/sidebar/sidebar.tsx](<../../src/components/dashboard/sidebar/sidebar.tsx>)
- [ ] [src/components/dashboard/sidebar/nav-admin.tsx](<../../src/components/dashboard/sidebar/nav-admin.tsx>)
- [ ] [src/components/dashboard/sidebar/nav-seller.tsx](<../../src/components/dashboard/sidebar/nav-seller.tsx>)
- [ ] [src/components/dashboard/sidebar/store-switcher.tsx](<../../src/components/dashboard/sidebar/store-switcher.tsx>)
- [ ] [src/components/dashboard/sidebar/user-info.tsx](<../../src/components/dashboard/sidebar/user-info.tsx>)
- [ ] [src/components/shared/theme-toggle.tsx](<../../src/components/shared/theme-toggle.tsx>)
- [ ] [src/components/ui/data-table.tsx](<../../src/components/ui/data-table.tsx>)
- [ ] [src/components/ui/table.tsx](<../../src/components/ui/table.tsx>)
- [ ] [src/components/dashboard/shared/custom-modal.tsx](<../../src/components/dashboard/shared/custom-modal.tsx>)
- [ ] [src/components/dashboard/shared/order-table-cells.tsx](<../../src/components/dashboard/shared/order-table-cells.tsx>)

### 業務概要・在庫操作（P3）

既定テーマの統計・グラフ・表と旧操作色を移行。金額・状態表示・在庫更新の意味は維持。

- [ ] [src/components/dashboard/admin/stats-cards.tsx](<../../src/components/dashboard/admin/stats-cards.tsx>)
- [ ] [src/components/dashboard/admin/sales-chart.tsx](<../../src/components/dashboard/admin/sales-chart.tsx>)
- [ ] [src/components/dashboard/admin/recent-orders.tsx](<../../src/components/dashboard/admin/recent-orders.tsx>)
- [ ] [src/components/dashboard/admin/recent-stores.tsx](<../../src/components/dashboard/admin/recent-stores.tsx>)
- [ ] [src/components/dashboard/seller/store-stats-cards.tsx](<../../src/components/dashboard/seller/store-stats-cards.tsx>)
- [ ] [src/components/dashboard/seller/store-recent-orders.tsx](<../../src/components/dashboard/seller/store-recent-orders.tsx>)
- [ ] [src/components/dashboard/seller/store-top-products.tsx](<../../src/components/dashboard/seller/store-top-products.tsx>)
- [ ] [src/components/dashboard/seller/inventory-alert-summary.tsx](<../../src/components/dashboard/seller/inventory-alert-summary.tsx>)
- [ ] [src/components/dashboard/seller/low-stock-threshold-form.tsx](<../../src/components/dashboard/seller/low-stock-threshold-form.tsx>)
- [ ] [src/components/dashboard/seller/inventory-quantity-cell.tsx](<../../src/components/dashboard/seller/inventory-quantity-cell.tsx>)
- [ ] [src/components/dashboard/seller/stock-status-badge.tsx](<../../src/components/dashboard/seller/stock-status-badge.tsx>)

### 業務フォーム・編集部品（P3/P4）

利用先の波に合わせて適用。商品・店舗・配送をP3、管理マスタをP4とする。

- [ ] [src/components/dashboard/forms/store-details.tsx](<../../src/components/dashboard/forms/store-details.tsx>)
- [ ] [src/components/dashboard/forms/product-details.tsx](<../../src/components/dashboard/forms/product-details.tsx>)
- [ ] [src/components/dashboard/forms/store-default-shipping-details.tsx](<../../src/components/dashboard/forms/store-default-shipping-details.tsx>)
- [ ] [src/components/dashboard/forms/shippingRate-details.tsx](<../../src/components/dashboard/forms/shippingRate-details.tsx>)
- [ ] [src/components/dashboard/forms/coupon-details.tsx](<../../src/components/dashboard/forms/coupon-details.tsx>)
- [ ] [src/components/dashboard/forms/coupon-form-fields.tsx](<../../src/components/dashboard/forms/coupon-form-fields.tsx>)
- [ ] [src/components/dashboard/forms/order-status-select.tsx](<../../src/components/dashboard/forms/order-status-select.tsx>)
- [ ] [src/components/dashboard/forms/product-status-select.tsx](<../../src/components/dashboard/forms/product-status-select.tsx>)
- [ ] [src/components/dashboard/forms/store-status-select.tsx](<../../src/components/dashboard/forms/store-status-select.tsx>)
- [ ] [src/components/dashboard/forms/category-details.tsx](<../../src/components/dashboard/forms/category-details.tsx>)
- [ ] [src/components/dashboard/forms/attribute-details.tsx](<../../src/components/dashboard/forms/attribute-details.tsx>)
- [ ] [src/components/dashboard/forms/attribute-option-details.tsx](<../../src/components/dashboard/forms/attribute-option-details.tsx>)
- [ ] [src/components/dashboard/forms/attribute-fields.tsx](<../../src/components/dashboard/forms/attribute-fields.tsx>)
- [ ] [src/components/dashboard/forms/offer-tag-details.tsx](<../../src/components/dashboard/forms/offer-tag-details.tsx>)
- [ ] [src/components/dashboard/forms/admin-coupon-details.tsx](<../../src/components/dashboard/forms/admin-coupon-details.tsx>)
- [ ] [src/components/dashboard/forms/click-to-add.tsx](<../../src/components/dashboard/forms/click-to-add.tsx>)
- [ ] [src/components/dashboard/shared/input-fieldset.tsx](<../../src/components/dashboard/shared/input-fieldset.tsx>)
- [ ] [src/components/dashboard/shared/image-upload.tsx](<../../src/components/dashboard/shared/image-upload.tsx>)
- [ ] [src/components/dashboard/shared/images-preview-grid.tsx](<../../src/components/dashboard/shared/images-preview-grid.tsx>)
- [ ] [src/components/dashboard/shared/color-palette.tsx](<../../src/components/dashboard/shared/color-palette.tsx>)
- [ ] [src/components/dashboard/shared/store-summary.tsx](<../../src/components/dashboard/shared/store-summary.tsx>)
- [ ] [src/components/dashboard/shared/store-order-summary.tsx](<../../src/components/dashboard/shared/store-order-summary.tsx>)

### 印刷（P4）

PDF用に独立したスタイル。白背景・印刷可読性を保ち、見出し・罫線・ブランドを調整。

- [ ] [src/components/store/order-page/pdf-invoice.tsx](<../../src/components/store/order-page/pdf-invoice.tsx>)

### データテーブルの画面別列・操作（P3/P4）

DataTable本体だけでなく、サムネイル、金額、状態バッジ、編集・削除、確認ダイアログ、処理中・失敗の表示を確認する。

- [ ] [src/app/dashboard/admin/attributes/[id]/options/columns.tsx](<../../src/app/dashboard/admin/attributes/[id]/options/columns.tsx>)
- [ ] [src/app/dashboard/admin/attributes/columns.tsx](<../../src/app/dashboard/admin/attributes/columns.tsx>)
- [ ] [src/app/dashboard/admin/categories/columns.tsx](<../../src/app/dashboard/admin/categories/columns.tsx>)
- [ ] [src/app/dashboard/admin/coupons/columns.tsx](<../../src/app/dashboard/admin/coupons/columns.tsx>)
- [ ] [src/app/dashboard/admin/offer-tags/columns.tsx](<../../src/app/dashboard/admin/offer-tags/columns.tsx>)
- [ ] [src/app/dashboard/admin/orders/columns.tsx](<../../src/app/dashboard/admin/orders/columns.tsx>)
- [ ] [src/app/dashboard/admin/stores/columns.tsx](<../../src/app/dashboard/admin/stores/columns.tsx>)
- [ ] [src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx>)
- [ ] [src/app/dashboard/seller/stores/[storeUrl]/inventory/columns.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/inventory/columns.tsx>)
- [ ] [src/app/dashboard/seller/stores/[storeUrl]/orders/columns.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/orders/columns.tsx>)
- [ ] [src/app/dashboard/seller/stores/[storeUrl]/products/columns.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/products/columns.tsx>)
- [ ] [src/app/dashboard/seller/stores/[storeUrl]/shipping/columns.tsx](<../../src/app/dashboard/seller/stores/[storeUrl]/shipping/columns.tsx>)

### 適用済み部品の回帰確認

次の部品は移行元の基準または適用済み。共通トークン・基本部品の変更時に回帰確認する。

- ヘッダー・フッター本体、Brand、ブランドwordmark。ヘッダーの展開メニューは上記P1で別途対応。
- ホームのluxury一式、商品詳細の主要レイアウト・購入操作・説明・仕様・関連商品・レビューeditorial表示。
- browseのFilterPanel・Sort、店舗詳細、About、Contactの独立CSS。
- AuthFrameとClerk SignIn/SignUpのappearance。パスワード再設定・認証コード・外部ログイン遷移の実確認は別途必要。
- SocialShareなど既に商品詳細のブランドCSSを利用する部品。今回のグローバル変更で崩さない。

### 残りのUIプリミティブ・アイコン

`src/components/ui` の残りのプリミティブも、現在の利用先が確認できたものから対象へ追加する。未使用のラッパーまで先に作り替えない。Portalを使う部品はページ内のCSS変数が継承されるかを確認する。

`src/components/store/icons`、`src/components/dashboard/icons` はアイコン名・意味を保ち、呼び出し側から色・サイズを統一する。商品画像・第三者ロゴはブランド色に塗り替えない。

## 4. 利用確認が必要な旧部品

以下は現在のルートからの利用を確認できない、または参照元自体の利用を確認する必要がある候補。未使用を断定するための完全な静的解析は行っていない。動的import、再export、テスト用途も確認する。

- [ ] [src/components/store/home/animated-deals.tsx](<../../src/components/store/home/animated-deals.tsx>)
- [ ] [src/components/store/home/featured-categories.tsx](<../../src/components/store/home/featured-categories.tsx>)
- [ ] [src/components/store/home/category-card.tsx](<../../src/components/store/home/category-card.tsx>)
- [ ] [src/components/store/home/main/featured.tsx](<../../src/components/store/home/main/featured.tsx>)
- [ ] [src/components/store/home/main/home-swiper.tsx](<../../src/components/store/home/main/home-swiper.tsx>)
- [ ] [src/components/store/home/main/user/user.tsx](<../../src/components/store/home/main/user/user.tsx>)
- [ ] [src/components/store/home/main/user/products.tsx](<../../src/components/store/home/main/user/products.tsx>)
- [ ] [src/components/store/home/sideline/sideline.tsx](<../../src/components/store/home/sideline/sideline.tsx>)
- [ ] [src/components/store/home/sideline/item.tsx](<../../src/components/store/home/sideline/item.tsx>)
- [ ] [src/components/store/layout/categories-header/categories-header.tsx](<../../src/components/store/layout/categories-header/categories-header.tsx>)
- [ ] [src/components/store/layout/categories-header/container.tsx](<../../src/components/store/layout/categories-header/container.tsx>)
- [ ] [src/components/store/layout/categories-header/categories-menu.tsx](<../../src/components/store/layout/categories-header/categories-menu.tsx>)
- [ ] [src/components/store/layout/categories-header/offerTags-links.tsx](<../../src/components/store/layout/categories-header/offerTags-links.tsx>)
- [ ] [src/components/store/layout/header/download-app.tsx](<../../src/components/store/layout/header/download-app.tsx>)
- [ ] [src/components/store/layout/footer/contact.tsx](<../../src/components/store/layout/footer/contact.tsx>)
- [ ] [src/components/store/cards/product/clean-card.tsx](<../../src/components/store/cards/product/clean-card.tsx>)
- [ ] [src/components/store/cards/product/simple-card.tsx](<../../src/components/store/cards/product/simple-card.tsx>)
- [ ] [src/components/store/shared/swiper.tsx](<../../src/components/store/shared/swiper.tsx>)
- [ ] [src/components/store/shared/shipping-addresses/address.list.tsx](<../../src/components/store/shared/shipping-addresses/address.list.tsx>)
- [ ] [src/components/store/cards/address-card.tsx](<../../src/components/store/cards/address-card.tsx>)

確認後、「移行対象」「保管」「削除候補」のいずれかを記録する。自動削除しない。未使用部品の移行はP4とし、購入導線より先行させない。

## 5. 導入順序・依存関係

| 波 | 作業 | 主な依存 | 完了条件 |
|---|---|---|---|
| 1 | 共通トークン、基本操作、モーダル、ヘッダー展開部品 | 現行の適用済み画面とlight/darkの基準確認 | 既存画面を崩さず、展開部品・基本操作が統一される |
| 2 | カート → checkout → 注文・支払い | 波1のボタン、住所、モーダル、通知 | 購入導線と空・処理中・失敗状態を統一 |
| 3 | ProfileLayout・Sidebar → 各マイページ、共用メッセージ | 波1のカード・フォーム・ページャー | 顧客の通常操作と認証戻り先を維持 |
| 4 | 追跡、サポート、比較、オファー、静的コンテンツ | 波1、関連するカード・フォーム | 状態・結果・受付完了・長文の可読性を統一 |
| 5 | 出店申請、業務共通レイアウト・表 → 出店者業務と管理概要 | 共通トークン、MessagesLayout、DataTable・CustomModal | light/darkと業務操作を維持してブランド統一 |
| 6 | 管理マスタ、PDF、旧部品の判断 | 波5の共通表・フォーム | 残存台帳が完了または理由付き保留になる |

P2のマイページ改修はP1の購入処理そのものには依存しない。基盤が揃った範囲から進められる。管理概要・業務フォームは共通ダッシュボード基盤を先行させる。

### 5.1 実装方針

- ブランドトークンと意味を持つ状態色を分ける。既存のデザイン値は役割を確認して共通化する。
- 顧客向けはブランドの余白と見出しを活かす。管理画面では同じブランド色を使い、表・入力欄・業務本文の情報密度を維持する。
- ダッシュボードの既存ThemeToggleを維持し、ライト・ダーク両方の値を用意する。顧客向けの固定light面と混同しない。
- グローバルCSS変数の変更が全画面へ波及しないよう、テーマの適用範囲を決める。Portal、Clerk、Stripe等は個別のテーマ設定と継承を確認する。
- 外部SDKのカスタマイズはインストール済み型・公式仕様に合わせる。PayPalのブランド表示、CAPTCHA、Clerkの必要表示を無理に上書きしない。
- 文言・機能の変更は必要な範囲へ限定する。新しい会社情報、サポート時間、決済方法、管理機能を創作しない。
- DB、API、認可、金額計算、在庫、決済、注文状態遷移の変更はこのデザイン計画に含めない。
- 新規の共通部品は必要な呼び出し元から段階的に導入する。既に適用済みのページを全面的に作り直さない。

## 6. TDD・検証計画

この文書の保存にアプリのテスト追加は不要。以下は今後のUI移行を実施する際の検証計画。

### 6.1 各作業単位の進め方

1. 対象と呼び出し元、表示状態、既存の動作テストを確認する。
2. 新しい表示・操作要件や回帰を守る必要なテストを追加し、想定した理由で失敗することを確認する。
3. 最小限の実装でテストを通す。
4. 重複を整理し、型チェック・Lint・関連テストを再実行する。
5. 実ブラウザーでPC・スマートフォン、キーボード操作、色・状態・レイアウトを確認する。

CSSの実装文字列をそのままなぞる大量の単体テストは作らない。表示の配色・サイズ・フォーカスはブラウザーで、業務操作・状態遷移は既存の意味のあるテストで確認する。

### 6.2 主な回帰ケース

| 対象 | 検証する操作・状態 |
|---|---|
| 共通UI | キーボードでの展開・閉じる操作、focus、disabled、Portal、通知、狭い画面 |
| カート | 数量変更、商品削除、空カート、金額、送料、サインインへの引き継ぎ |
| Checkout | 配送先の選択・保存、クーポン、合計、注文確定、二重送信防止 |
| 注文・決済 | 商品明細、支払い開始、処理中、失敗・再試行、SDKの表示 |
| 商品・アカウント | お気に入り、比較、フォロー、レビュー、ページング、空・読み込み状態 |
| 認証・Clerk | sign-in/sign-up往復、wishlistへの戻り先、UserProfile、リセット・認証コード |
| サポート | 未入力・不正入力、送信失敗、受付完了、追跡の成功・未検出 |
| 会話 | 会話選択、空一覧、送信、長文、購入者・出店者の両画面 |
| 業務画面 | 検索・並べ替え・編集・状態変更・在庫操作、役割別表示、ライト・ダーク |
| PDF | 複数明細、改ページ、金額、印刷時の可読性 |

### 6.3 表示の受け入れ条件

- PCとスマートフォンで意図しないページ全体の横スクロールがない。表・比較などの必要な横スクロールは局所化する。
- 通常・選択・無効・hover・focus・処理中・エラー・成功・空・画像未取得を確認する。
- WCAG 2.1 AA相当のコントラストとキーボード操作を確認する。第三者UIで検証できない範囲は記録する。
- 見出し・ラベル・状態通知が理解でき、色だけで状態を伝えない。
- 動きを減らす設定を尊重する。
- 既存の購入計算、送信、データ取得、認可、URLパラメーター、リダイレクトの動作を維持する。

## 7. 監査・移行の完了管理

### 文書の完了条件

- 全66ページが台帳に含まれ、判定件数と一致する。
- 小さな部品にもファイル単位の対応項目がある。
- 優先度の理由、導入順、依存関係、検証方法が記載される。
- 適用済み・未適用・利用確認・認証等の実画面未確認を区別する。
- 参照パスが存在し、Markdownの形式と差分に問題がない。

### 今後の移行で更新する情報

各対象に「TODO／対応中／実装済み／検証済み／保留」、実施日、関連変更、確認した画面・状態を追記する。ソースを変更しただけで検証済みにしない。保留には理由と解除条件を書く。

状態・証跡は[進捗ノート](../../docs/design/design-system/PROGRESS.md)に記録し、当計画は完了チェックと対象・優先度を同期する。進め方は [design-system-workflow](../../.agent/skills/design-system-workflow/SKILL.md) を参照する。

全画面のデザイン統一を完了とするのは、利用中の対象が検証済み、または理由付き保留として整理され、適用済み画面の回帰確認が終わった時点とする。

### FAQs移行チェック（DS-PAGE-014）

- [x] [保存計画](faqs-design-system-plan.md)に対象・受け入れ条件・検証方法を記録。
- [x] 新要件のRTL・ブラウザRed確認後、専用レイアウト・CSS Moduleを実装。
- [x] 1440／390／768px、キーボードfocus・アンカー、axe、旧URL転送、関連RTL、lint、型チェックを確認。
- [x] 関連仕様・QA・[移行記録](../../docs/design/design-system/PROGRESS.md#faqs移行記録)を同期。

共有StaticPageLayout（DS-COMP-123）と他の静的ページは未移行。今回のチェックはFAQ本体のみ。

### Profile移行チェック（DS-PAGE-029／DS-COMP-077〜079）

- [x] [保存計画](profile-design-system-plan.md)に対象・受け入れ条件・先行テストを記録。
- [x] RTLと認証後ブラウザのRed→Green、共通CSS／定数の整理後に再検証。
- [x] 1440／390／768px、focus・キーボード、axe、未認証転送、共有ナビゲーションの子ページ回帰を確認。
- [x] [profile仕様](../../docs/design/profile-overview/requirements.md)、設定の共通枠仕様、QA、[移行進捗](../../docs/design/design-system/PROGRESS.md#profile移行記録)を同期。

他profileページの本文・Clerk UserProfile自体は未移行のまま。共有枠が新デザインになったことを全子ページの移行完了とは扱わない。

### Wishlist移行チェック（DS-PAGE-033／DS-COMP-085）

- [x] [保存計画](wishlist-design-system-plan.md)に対象・受け入れ条件・先行テストを記録。
- [x] RTLと認証後ChromiumのRed→Green、共通見出し・URLリンクの整理後に再検証。
- [x] 1440／390／768px、空／商品あり／ページング、比較・focus・Enter、axe、ブラウザ戻ると転送を確認。
- [x] [Wishlist仕様](../../docs/design/profile-wishlist/requirements.md)、QA、[移行進捗](../../docs/design/design-system/PROGRESS.md#wishlist移行記録)を同期。

DS-PAGE-034のalias転送も回帰確認。共有ProductCardの他画面・他機能まで移行済みとは扱わない。

### ストア通知（追加対象 DS-COMP-201）

- [x] [src/components/store/shared/store-toaster.tsx](../../src/components/store/shared/store-toaster.tsx): カートと全ストアのreact-hot-toast。Radix/SonnerのDS-COMP-102/103は未移行。証跡は[cart移行記録](../../docs/design/design-system/PROGRESS.md#cart移行記録)。

### 購入者メッセージ専用スレッド（追加対象 DS-COMP-202）

- [x] [src/components/store/profile/messages/profile-conversation-thread.tsx](<../../src/components/store/profile/messages/profile-conversation-thread.tsx>)

既存shared layout/hook/threadと販売者部品の移行は別対象。[証跡](../../docs/design/design-system/PROGRESS.md#profile-messages移行記録)。

### Checkout・注文詳細移行チェック（DS-PAGE-008／003）

- [x] [保存計画](checkout-order-design-system-plan.md)、RTL4件のRed、実装とaction Propsの整理。
- [x] Refactor後の関連Jest420/420、supplemental Chromium11/11（1440／768／390px・axe contrast含む）、lint／tsc／画像目視。
- [x] Checkout／order-detailの要件・設計・タスク、SDD、QA、[実施記録](../../docs/design/design-system/PROGRESS.md#checkout-order移行記録)を同期。
- [ ] 専用テストDBの認証後実ルートとSDK実描画を確認。現在は実装あり・検証保留。

DS-COMP-020／031〜049（036はcheckoutのopt-inのみ）、購入導線共通CSSのDS-COMP-204。旧住所form/list/card・旧Modalと全体トークンは別対象のまま。実装だけで既存部品チェックを完了にしない。

### 購入導線の共通表示（追加対象 DS-COMP-204）

- [ ] [src/components/store/shared/commerce.module.css](../../src/components/store/shared/commerce.module.css): 2画面の面・文字・focus・responsive・dialogをスコープ。実装あり、実ルート検証保留。

### P2優先5画面移行チェック（2026-10-05）

- [x] [保存計画](priority-five-design-system-plan.md)、14件の新要件Red確認、画面別Green/Refactor/文書同期を分割コミット。
- [x] DS-PAGE-016/012/035: 実ルートChromium（公開3画面1440/768/390px）、hover/focus/Enter・validation/pending/error/retry/receipt・overflow・axe AAと画像目視。
- [x] DS-PAGE-022/024: RTL・補助Chromium6/6、URL links/back・長文・follow/compare・loading/error/retry/empty・axe AA。未認証実ルート転送とalias/canonicalの回帰。
- [x] 最終Jest2766/2769（3 skipped）、263 suites、127 snapshots、tsc/lint、SDD・QA・dashboard・[進捗](../../docs/design/design-system/PROGRESS.md#p2優先5画面移行記録)を同期。
- [ ] DS-PAGE-022/024の認証後実ルート受け入れ検証。専用test DB不在で保留（実装あり）。補助fixtureを実ルート検証済み扱いにしない。

### P2専用共通表示（追加対象）

- [x] DS-COMP-205: [DesignPage](../../src/components/store/shared/design-page/design-page.tsx)と専用CSS。公開3画面で検証済み。
- [ ] DS-COMP-206: [Account discovery](../../src/components/store/profile/shared/discovery.tsx)と専用CSS。補助検証済み、認証後実ルート保留。
- [ ] DS-COMP-207: [HistoryContainer](../../src/components/store/profile/history/container.tsx)。補助検証済み、認証後実ルート保留。

旧StoreCard/ProductCard/汎用Pagination、全体トークンをこの5画面だけで移行完了にしない。

### 優先7画面移行チェック

[保存計画](priority-seven-design-system-plan.md)／[実施記録](../../docs/design/design-system/PROGRESS.md#優先7画面移行記録)。認証後実ルートと第三者UI確認は実装と別に記録する。

- [x] DS-PAGE-032 アカウント設定: TDD・実装・関連検証・仕様同期。
- [ ] DS-PAGE-032: 認証後実ルート・必要なSDK実描画の受け入れ検証（実装あり・保留）。

- [x] DS-PAGE-004 出店申請: TDD・実装・関連検証・仕様同期。
- [ ] DS-PAGE-004: 認証後実ルート・必要なSDK実描画の受け入れ検証（実装あり・保留）。

- [x] DS-PAGE-058 店舗概要: TDD・実装・関連検証・仕様同期。
- [ ] DS-PAGE-058: 認証後実ルート・必要なSDK実描画の受け入れ検証（実装あり・保留）。

- [x] DS-PAGE-062 商品一覧: TDD・実装・関連検証・仕様同期。
- [ ] DS-PAGE-062: 認証後実ルート・必要なSDK実描画の受け入れ検証（実装あり・保留）。

- [x] DS-PAGE-055 在庫管理: TDD・実装・関連検証・仕様同期。
- [ ] DS-PAGE-055: 認証後実ルート・必要なSDK実描画の受け入れ検証（実装あり・保留）。

- [x] DS-PAGE-057 注文一覧: TDD・実装・関連検証・仕様同期。
- [ ] DS-PAGE-057: 認証後実ルート・必要なSDK実描画の受け入れ検証（実装あり・保留）。

- [x] DS-PAGE-056 販売者メッセージ: TDD・実装・関連検証・仕様同期。
- [ ] DS-PAGE-056: 認証後実ルート・必要なSDK実描画の受け入れ検証（実装あり・保留）。

新設部品DS-COMP-208〜216は販売者/申請scopeの本体適用・補助検証済み・認証後受け入れ保留。[台帳](../../docs/design/design-system/PROGRESS.md#部品台帳)。共通部品の他scopeを一括完了にしない。

### 優先6画面移行チェック

[保存計画](priority-six-design-system-plan.md)／[実施記録](../../docs/design/design-system/PROGRESS.md#優先6画面移行記録)。

- [x] DS-PAGE-061 商品登録: TDD・実装・補助検証・仕様同期。
- [ ] DS-PAGE-061: 認証後実ルートと必要なSDK実描画（実装あり・保留）。
