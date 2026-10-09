# Functional Requirements

## Customer
- Browse featured products, categories, and stores.
- Reach the collection from the landing page's three editorial chapters; browse live category links and a curated product selection, with usable links and imagery when animation or product data is unavailable.
- Pause the landing-page animation, and respect the device's reduced-motion setting.
- Search products by name, brand, and variant keywords.
- Refine the browse collection by category, offer, size, color, price, and search term; keep active conditions when sorting or paging, and allow removing individual conditions or clearing them all.
- Use the browse filters on narrow screens and reach product-card actions with touch or keyboard as well as pointer hover.
- Compare up to four persisted product variants side by side, remove individual selections or clear them, and reach the collection from empty or unavailable states. Show accessible loading and failure feedback with retry while preserving the selection.
- View product details, variants, sizes, colors, images, and specs.
- On a product detail page, inspect gallery images and their enlarged view, see the selected size's price and stock, and review delivery, returns, seller, reviews, questions, and related products when available.
- Prevent purchase actions when no valid in-stock size is selected; show a clear selection or sold-out message.
- Add items to cart with quantity and size selection.
- Manage cart contents (update quantity, remove items).
- Use a responsive branded cart with keyboard-operable selection, bulk/individual removal, quantity and wishlist controls; show loading, empty, unavailable and sync-failure states. Remove each deleted item's shipping contribution from the summary, prevent repeat checkout submissions while saving, and preserve the bag after a failure. Storefront notifications use readable branded success/error feedback with a keyboard-accessible dismiss control. See [cart requirements](../../docs/design/cart/requirements.md).
- Checkout with shipping address selection and shipping fees.
- Pay with Stripe or PayPal.
- Browse payment history in the branded responsive account layout, retaining payment/intent IDs, update date, method, dollar amount, status and order-detail links. Use accessible method filters, period selection, explicit ID search (including empty-search reset), full reset and paging, with pending controls locked and generic failure feedback/retry. See [payment-history requirements](../../docs/design/profile-payment/requirements.md).
- View order details and order status history.
- Browse order history in the branded responsive account layout, preserving IDs, dates, thumbnails, item counts, payment/delivery states, totals and detail links. Use keyboard-operable status filters, period selection, explicit search submission (including empty-search reset), full filter reset and paging. Show accessible empty, pending and lookup-failure states with retry; lock controls during lookup and hide stale results. See [order-history requirements](../../docs/design/profile-orders/requirements.md).
- Manage profile, addresses, wishlist, and reviews.
- Browse saved wishlist pieces in the branded responsive account layout with existing product-card actions and URL-based pagination; reach the collection from empty results and see readable loading or lookup-failure feedback with reload.
- Reach account sections from responsive branded navigation with an accessible current-page indication; use profile shortcuts and existing order filters, see readable account-lookup failure feedback, and reach order support. Show unimplemented coupon/credit shortcuts as unavailable rather than broken links.

- Read the public FAQs with all existing answers visible, navigate to individual questions by keyboard-accessible anchors, and reach contact, tracking, returns, and customer service from the branded responsive page. Keep the permanent `/faq` to `/faqs` redirect.

## Seller
- Apply for seller role.
- Create and manage stores (profile, status, shipping defaults).
- Create and manage products, variants, sizes, colors, and images.
- Maintain inventory and pricing per variant size.
- Configure shipping rates per country.
- Manage store coupons.
- View and fulfill orders grouped by store.

## Admin
- Manage categories, subcategories, and offer tags.
- Review and manage store entries and status.

## Cross-Cutting
- Role-based access control and authentication.
- Validation of form inputs.
- Country-aware shipping configuration.
- Search with fulltext and fallback matching.

- Public order tracking uses the storefront cream/deep-green/gold palette and serif headings, responsive lookup and result cards, visible keyboard focus, and accessible pending/error/missing/success states. Lock inputs and submit while lookup is pending; long order IDs and product names wrap without horizontal overflow.

- The public customer-service hub preserves all five support destinations, titles and descriptions in a responsive cream/deep-green/gold layout with serif headings, breadcrumbs, visible keyboard focus and accessible link activation.

- Returns/exchange preserves the existing policy and uses the storefront cream/deep-green/gold palette, serif heading and responsive policy/form layout. Validate all fields including the UUID order number, lock the branded form during submission, preserve inputs after failure and show an accessible receipt after success.

- Product support preserves existing setup, troubleshooting and aftercare content and placeholder notices in a responsive branded layout with breadcrumbs, keyboard-accessible section anchors and four support destinations.

## Profile shipping address presentation

Authenticated customers manage shipping addresses in the branded responsive `/profile/addresses` body: readable address cards, default indicator, add/edit dialog and explicit Make default action. Preserve all existing address fields and Zod validation. Use labeled native inputs and a select containing DB-supported countries; restore all values when editing. Provide empty/loading/load-failure/retry and save/default pending/failure/success feedback. Prevent duplicate submission and dialog dismissal while saving; preserve inputs after failure. Keyboard users can scroll the pending dialog even when its inputs are disabled. No delete action is added. See [address requirements](../../docs/design/profile-addresses/requirements.md).

## Profile review presentation

Authenticated customers browse their review history in the branded responsive account layout, retaining masked author/avatar, fractional rating, variant, color, size, quantity, text and photos. Native rating filters, labeled periods and explicit Search/Enter search operate on review text. Empty search clears search; full reset also clears period/rating. Preserve conditions during paging/retry, reset page on new conditions, lock pending controls and hide stale results. Provide empty/filtered-empty/loading/generic failure/retry and a readable update date. See [review requirements](../../docs/design/profile-reviews/requirements.md).

## Profile message presentation

Authenticated buyers read and send existing store conversations in the branded responsive account layout, with native selected-conversation controls, long-name/text wrapping, chronological buyer/store bubbles and UTC dates. Provide empty/unselected/loading/generic list/thread failure and retry; a read-status failure keeps the conversation available and offers its own retry. Preserve trimmed 1–2000 character validation, lock input/selection/reload while sending, prevent duplicates, retain failed drafts and refresh after success. Maintain five-second polling, hidden-tab pause and stale-response protection. See [message requirements](../../docs/design/profile-messages/requirements.md).

## Checkout and order-detail presentation

Checkout and order detail use responsive cream/deep-green/gold purchase surfaces with serif headings, keyboard-operable address selection and labeled address/coupon forms. Keep existing monetary calculations, coupon scope and order/payment conditions. Lock ordering during destination/coupon refresh or submission, announce failures with retry, and keep the established post-order duplicate guard. Order detail shows one total summary and readable payment loading/error states. Unimplemented cancellation stays disabled. See [checkout requirements](../../docs/design/checkout/requirements.md) and [order-detail requirements](../../docs/design/order-detail/requirements.md).

## Priority P2 discovery and support presentation

Offers retain tag order, product counts and browse-filter destinations in branded responsive cards; empty results offer the collection, loading is announced and lookup failure has generic reload feedback. Public dispute/problem-report pages use branded support forms with their existing categories, labels and UUID order requirement (DISPUTE only); pending locks, input-preserving retry and receipt remain accessible. Authenticated followed stores use branded cards, supplied follow actions with duplicate prevention, retained failure state and success feedback. Browser view history preserves stored variant order and editorial product interactions, announces loading/error with retry, treats malformed saved data as empty, ignores stale responses, and uses URL paging. Account routes retain normalization, aliases and range correction. [Following requirements](../../docs/design/profile-following/requirements.md), [history requirements](../../docs/design/profile-history/requirements.md).

### Priority seven screen presentation

Account settings uses Clerk hash routing with typed brand appearance and a labeled account section. Seller application retains four steps and validated values, exposes progress, pending/error/retry/success, supports reduced motion and uses readable branded guest links. Seller overview/products/inventory/orders/messages share scoped light/dark tokens, serif headings, responsive navigation and local table scrolling. Inventory and order status saves lock pending requests and expose generic failure/retry and success feedback. Seller messages identify the buyer, show latest-message unread state, retain failed drafts, use existing five-second polling with stale/unmount/hidden cancellation, and switch between list/thread on small screens. Existing authorization, schema, money units/calculation and transaction/state-transition rules remain unchanged. [Saved plan](../../plans/layout-design/priority-seven-design-system-plan.md), [seller UI requirements](../../docs/design/seller-ui-migration/requirements.md).

## Seller product and store form presentation

Seller product creation uses the existing responsive branded light/dark workspace, a labeled page and form heading, readable dynamic fields and themed portal controls. Lock fields during save, retain failed input with generic retry feedback, announce pending/success, and preserve existing product/variant payloads and navigation.

Variant creation uses the same branded editor and an Add variant page heading naming the inherited product. Preserve product-scope field visibility, category defaults, variant-only attribute payload and existing missing-product behavior.

Shipping settings uses a branded responsive defaults form and searchable country-rate table. Preserve amounts, Default/Free labels, country identities and validation; lock saves and pending-dialog dismissal, retain failed input, announce results and return focus to the editing trigger.

Store settings uses responsive logo/cover and labeled profile/contact fields in the seller light/dark theme. Preserve validation, featured value and update payload/navigation; lock saves and retain failed values with generic retry and status feedback.

Store creation has a standalone branded light/dark workspace with a main landmark, theme toggle and the shared labeled store form. Preserve validation/images/featured and navigate to the returned store URL. Creation omits id to use the existing create branch; updates retain id and owner guards.

## P3優先6画面のデザイン移行（2026-10-05）

管理者概要・注文・店舗、販売者クーポン一覧・新規作成、Legalの6画面を既存ブランドトークンへ移行。情報・役割認可・計算・法務本文を維持し、空／失敗／pending、再試行、キーボード、狭幅、light/darkを受け入れ条件とする。Legalは公開実ルート検証済み、業務5画面は認証後受け入れ保留。

詳細は[計画](../../plans/layout-design/priority-six-p3-design-system-plan.md)と[検証正本](../../docs/testing/QA_HANDOFF.md#ds-p3-six-browser)を参照。

## P4管理マスタ6画面のデザイン移行（2026-10-06）

カテゴリ・管理者クーポン・オファータグの一覧/作成は管理者light/dark theme、名前付きページ/form、検索、取得失敗/retryを使用する。編集/作成/削除とクーポンActivate/Deactivateを維持し、pending重複/close lock、失敗時入力保持と状態通知を提供する。カテゴリ階層・slug、coupon scope/storeId・割引/日時、offer name/urlの既存仕様は維持する。

[証跡と受け入れ保留](../../docs/design/design-system/PROGRESS.md#p4優先6画面移行記録)。

## Store purchase header presentation

The home, browse, product, store, cart and checkout surfaces share a scoped branded header. Account links, search suggestions and country selection remain operable with keyboard and touch. Search announces pending, empty and unavailable suggestions while preserving full-search navigation and URL conditions; stale responses never replace newer results. Shipping-country updates lock pending controls, retain the previous selection on failure and offer retry. Language English and currency USD remain fixed information. See [saved plan](../../plans/layout-design/priority-six-purchase-design-system-plan.md).

Product quantity and review-filter controls provide 44px operation targets. Review paging uses named branded navigation with current-page indication and disabled boundaries. QuantitySelector waiting for size provides readable status instead of an indefinite animated placeholder; the product page retains its existing size-selection/out-of-stock hint and purchase guards.

## 購入導線6画面のデザイン残存部品（2026-10-08）

[横断受け入れ仕様](../../docs/design/purchase-residual/requirements.md)を適用。browse/store/product/cart/checkout/orderのrootとPortalにスコープ付きpurchase themeを合成。共有住所フォームは既定配色fallbackを保持し、注文・支払い・商品状態タグは任意`variant="store"`のみ意味色を適用する。API・DB・認可・金額・在庫・決済遷移契約は変更なし。overview/data-modelの更新は不要。

TDDのRed/Green/Refactorと各画面の証跡は[進捗](../../docs/design/design-system/PROGRESS.md#購入導線残存部品6画面移行記録)。全体Jest3075/3078（3 skipped）・317スイート（316 passed/1 skipped）、127 snapshots。購入補助ブラウザー68/68（purchase44、commerce24）とaxe AAを確認。専用DB/Clerk/外部SDKを伴う受け入れは保留。

### P2残存6画面の表示要件（2026-10-09）

比較・Wishlist・フォロー店舗・閲覧履歴・通知・設定は共通purchase tokenを使用する。番号ページングは44px以上、focusを視認可能とし、空/読み込み/失敗/再試行も同じ意味色を継承する。通知はRead/Unreadを文字で区別し、一括既読の進行/成功をstatusで通知する。取得失敗でも見出しと正規化cursorを保持する再読み込みを提供する。設定は型付きClerk appearanceと独立Portalにthemeを供給する。既存取得・認可・URL・既読化契約を維持。[計画](../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)。

### 監査指摘6画面の表示受け入れ（2026-10-09）

商品一覧のページング、homeのmotion切替、商品詳細のcategory/review/follow/share/SKUコピーは44px以上の操作領域と可視focusを持つ。属性3画面は管理者ブランドlight/dark・名前付きheading/form・独立Portal・入力/状態通知を適用し、送信中の入力変更/二重送信/dismissを防ぐ。失敗時の入力保持/retryと既存のURL/ENUM/immutable key/value/論理削除契約を維持。[計画](../../plans/layout-design/priority-six-audit-remediation-design-system-plan.md)。


## Post-purchase account presentation (2026-10-10)

Orders, payment history, addresses, reviews, buyer messages and account overview consume the existing scoped purchase/account tokens for surfaces, text, borders, selection, focus and touch targets. Existing primary form actions use gold with dark text; links use readable dark gold. The address portal owns its theme, and buyer messages (including route loading) map message roles to storefront tokens without changing seller themes. Existing filters, paging, monetary units, actions, polling, authorization and destinations remain unchanged. [Plan](../../plans/layout-design/priority-six-p2-postpurchase-design-system-plan.md).
