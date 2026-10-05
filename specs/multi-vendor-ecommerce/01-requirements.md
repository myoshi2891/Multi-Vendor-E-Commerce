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
