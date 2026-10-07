# Workflows

## Landing Page Flow
1) `/` opens with three scroll chapters (Luxury, Fortune, Happiness) over a decorative gem stage. The hero and final chapter link to `#collections`; the Fortune chapter links to up to three live categories with canonical `/browse?category=<slug>` URLs. Category priority is jewelry, watches, then bags when those names exist; other categories fill the remaining slots in returned order. If no categories are available, a general `/browse` link remains.
2) The collection section shows up to eight products with first-variant detail links and the lowest discounted size price, calculated with Decimal arithmetic. It requests up to three products per featured category, tolerates individual category query failures, and fills from a general product query when no displayable category products remain. When there are no categories, it makes one general query. Products without a first variant are excluded. A separate link leads to all pieces at `/browse`.
3) The WebGL2 scene loads only on the client when motion is allowed and the shopper has not paused it. Scene activity follows viewport intersection and tab visibility. The branded still image and all HTML content remain usable when WebGL2 is unavailable, the scene fails, motion is paused, or `prefers-reduced-motion: reduce` is set. The motion button toggles pause/resume; under reduced motion it is disabled and reports the still state.
4) The collection has a loading announcement while streamed data resolves. An empty result shows a bilingual empty state and a `/browse` link. A fetch failure shows a bilingual error and a retry link that reloads `/#collections` so the server query actually runs again.

## Customer Purchase Flow
1) Browse or search products. `/browse` paginates at 10 products per page: the page reads the
   `page` query parameter, passes it to `getProducts`, and renders the shared pager only when
   `totalPages > 1`. Paging preserves the active filters, sort, and search terms — the pager
   rewrites only the `page` parameter. Invalid values (`NaN`, `Infinity`, fractions, `< 1`)
   fall back to page 1.
2) Open product page and choose a variant and size.
3) Add to cart (Zustand + localStorage). Opening `/cart` re-syncs items via `updateCartWithLatest()`;
   items whose product / variant / size no longer exist in the DB are dropped (not an error) and the
   buyer is notified with a toast (plan 070).
4) Server-side cart validation via `saveUserCart()` recalculates prices, stock, and shipping from DB.
5) Proceed to checkout and select shipping address; `updateCheckoutProductWithLatest()` recalculates shipping for selected country.
6) Create an order atomically via `placeOrder()` (`db.$transaction`) with inventory deduction.
7) Select payment method and capture payment via Stripe or PayPal.
8) Order status and payment details are updated via payment webhook.
9) Customer views order history and order details.

## Product Detail Flow
1) The variant page shows collection navigation, a breadcrumb, an editorial intro, and a responsive gallery / product information / purchase-panel layout. On wide screens these occupy three side-by-side areas; the information and purchase panel stack below 1200px, and all areas stack below 801px. Category links return to `/browse?category=...`; offer links return to `/browse?offer=...`. The gallery supports thumbnails, previous/next buttons, and image enlargement with a close button or Escape. A `/no_image` placeholder uses branded artwork and does not open the enlarged view.
2) The information panel shows product and variant names, rating and review count, price, color variants, sizes, SKU copy, seller link, share controls, and a link to the description. An invalid stored rating falls back to the weighted average of review buckets. Hovering a color variant previews its images; following it opens that variant URL. Selecting a size writes its ID to the `size` query parameter, updates the displayed discounted price and stock, and enables quantity selection. Out-of-stock sizes are disabled.
3) The purchase panel shows the destination, shipping service, estimated dates, and a fee breakdown when shipping details exist. The fee summary uses `computeShippingTotal` for the selected quantity and weight; complimentary shipping hides the fee breakdown. Returns and privacy links lead to their respective pages.
4) `Buy now` and `Add to bag` remain disabled until a valid in-stock size is selected and the remaining stock permits another item. When all sizes are sold out, the panel says so. Remaining quantity is calculated from current selected-size stock minus the matching quantity already in the cart. `Add to bag` adds to the local cart with a success toast; `Buy now` adds and navigates to `/cart`.
5) Below the purchase area, the page renders the sanitized description; structured category attributes under **Specifications** and legacy specs under **Other specifications** when present; same-category related products; review statistics, filters, sorting, pagination, and review form; questions when present; seller card; and up to five products from that store. Empty optional sections are omitted. Recommendation cards link to variant pages and use representative or branded placeholder imagery when gallery images are unavailable.

## Browse Collection Flow
1) `/browse` presents a dark collection hero, result count, filter sidebar, sort control, and an editorial product grid. On narrow screens the filter controls open through a disclosure button (`aria-expanded`); the grid adapts from two to four columns across breakpoints. Zero results show an explicit empty state.
2) The filter sidebar lists active conditions as removable chips. A long value wraps inside the sidebar. `Filter (N)` counts filter values, including repeated values, but excludes `sort`; `Clear All` removes the query string. Removing one chip preserves the other active conditions.
3) The sort trigger is one button with two visually separated areas: `Sort by` and the selected value. Its radio menu offers Most Popular (default), New Arrivals, Top Rated, and ascending/descending price. Selecting an option updates `sort` while retaining the other query parameters. The label and value must remain within the control at narrow widths.
4) Editorial cards show variant, Add to cart, wishlist, and compare controls over the image on hover or keyboard focus; touch layouts keep them visible below the image. The overlay stays fixed over the image without an entrance slide, and editorial image autoplay on hover is disabled so moving between cards does not restart an image animation. `Add to cart` links to the variant detail page, where a size and quantity can be chosen before the cart mutation.
5) Search and ordering (plans 073/075/076): the header search suggests up to 8 products while typing (2+ characters; the last word matches as a prefix) and Enter opens `/browse?search=`. Results match name, brand, variant name/description/keywords and description; with no explicit sort they are ordered by relevance. Every sort is a total order (ties break by product id), so paging never repeats or skips a product. Price sorts order the whole catalog by the lowest discounted price.
6) With a category selected, attribute facets (DS-COMP-203) appear below Size: each facet lists values with product counts; choosing a value adds `attr.<key>=<value>` and returns to page 1. Values of one facet combine with OR, facets with AND, and a facet's own counts ignore its own selection. A selection left over from another category still appears with count 0 so it can be cleared. Attribute selections are counted in `Filter (N)` and appear as removable chips (removing one keeps the other values of that key), but the chips still show the raw value without the attribute name or option label (tracked in the DS-COMP-203 record).

## Offer Discovery Flow
1) Customer opens `/offers` from the user-menu "Discounts & Offers" link (now wired to `/offers`) or directly.
2) The page (`force-dynamic`) calls `getAllOfferTags()`, listing every `OfferTag` ordered by product count (empty state when none exist).
3) Each offer links to `/browse?offer=<url>`; product filtering, sorting, and paging are delegated to the existing `/browse` + `getProducts` offer filter (no product grid re-implemented on `/offers`).

## Static Content & Support Flow
1) Customer reaches static pages from the footer links or the user-menu: "Help Center" → `/customer-service`, "Legal & Privacy" → `/legal` (both previously empty strings, now wired).
2) `/customer-service` is a responsive branded support hub with breadcrumbs and keyboard-accessible numbered cards to `/contact`, `/returns-exchange`, `/faqs`, `/track-order`, and `/product-support`.
3) `/about`, `/legal` (with table of contents), `/faqs`, and `/product-support` render typed content constants as plain-text paragraphs; branded pages use dedicated layouts. Product support preserves its three sections and placeholder notices, provides keyboard-accessible anchors, and links to customer-service/contact/returns-exchange/track-order for further help.
4) Legacy `/faq` issues a 308 `permanentRedirect` to the canonical `/faqs`. These pages are public (outside middleware protection) and their content is DB-independent. The parent store layout rendering strategy is unchanged.

## Support Form Submission Flow
1) Customer (guest or signed-in) reaches a support form: `/contact` (general), `/returns-exchange` (return/exchange, shows a policy summary on top), `/dispute` (order dispute), or `/report-problem`. The user-menu wires "Return & Refund Policy" → `/returns-exchange`, "Order Dispute Resolution" → `/dispute`, and "Report a Problem" → `/report-problem`.
2) The shared `SupportForm` (client) collects name / email / subject / message, plus an order number derived from `RETURN_REQUEST` / `DISPUTE`. RHF + SupportTicketSchema validates input, and a useRef flag guards double submission. Server Components supply `createSupportTicket` via `submitAction`. `/returns-exchange` selects the branded appearance: pending submission shows 「送信中…」 and locks fields and submit. Errors preserve inputs for retry; success replaces the form with an output receipt. The existing returns policy is displayed unchanged alongside the responsive form.
3) On submit, the public server action `createSupportTicket(input)` re-validates, attaches `userId` only when `currentUser()` resolves (guest submissions leave it null), and creates one `SupportTicket` row with the form's `category`. The message body (PII) is never logged.
4) On success the form shows a receipt message (`role="status"`); a generic failure surfaces as a root-level error (`role="alert"`). No external email/notification is sent in this MVP — operators triage via the stored `status` (admin viewing UI is a follow-up).

## Order Tracking Flow
1) Customer (guest or signed-in) reaches `/track-order` from the footer "Track your Order" link or the `/customer-service` support hub card.
2) The client `TrackOrderForm` collects an order number and email, validates with `TrackOrderSchema` (RHF + zodResolver), and guards against double submission with a `useRef` flag. The Server Component provides the action via `lookupAction`; pending lookup displays 「照会中…」 and disables the inputs and submit button.
3) On submit, the public server action `trackOrder({ orderId, email })` fetches the order by `where: { id: orderId }` only and compares the input email to the owner `User.email` in the app layer (case-insensitive). A match returns the order (groups → items / store) with email stripped; a mismatch, a missing order, or invalid input all return the **same** `null` (enumeration-safe).
4) `TrackOrderResult` renders the overall `orderStatus` / `paymentStatus` and, per store group, the shipping service and delivery window plus each item's `ProductStatus`, reusing the shared `OrderStatusTag` / `PaymentStatusTag` / `ProductStatusTag`. A `null` result shows a single generic "not found" message.

## Product Compare Flow
1) Customer clicks the Add-to-compare toggle on a product card (`product-card.tsx`), which stores the selected `ProductVariant.id` in `useCompareStore` (Zustand + persist, localStorage key `compare-store`, max 4 items, idempotent). The toggle removes the variant if already present and shows a toast; a 5th add is rejected with an error toast.
2) Customer opens `/compare`. The Server Component renders the branded hero and passes `getProductsByIds` as `fetchProductsAction` to the client grid; it does not read localStorage. The existing store layout remains `force-dynamic`.
3) `CompareGrid` (client) reads the variant ids from `useCompareStore`. When the list is empty it renders an empty state and does **not** call `getProductsByIds` (that query throws on an empty id array).
4) For a non-empty list, `CompareGrid` invokes the supplied action (guarded by a `useEffect` cancellation flag) and renders image, name, variant, the existing discounted size-price range, rating, sales, and product links side by side. Individual remove and clear-all preserve the existing store behavior. The scrollable comparison region can be reached and scrolled with the keyboard on narrow screens.
5) The page shows the selected count out of four. Empty selections offer a collection link. Loading is announced through a status; failure through an alert with retry; zero returned products through an unavailable status and collection link. Retry and unavailable states retain selection IDs. Cancelled responses cannot restore products after removal or clear.

## Buyer↔Seller Messaging Flow
1) A conversation is created idempotently per `(userId, storeId)` via `getOrCreateConversation()`.
2) Buyer opens `/profile/messages` (force-dynamic; `getUserConversations()` seeds the list) and selects a conversation.
3) On selection the thread loads via `getConversationMessages()` and peer-sent unread are cleared via `markConversationRead()`.
4) Buyer sends a message via `sendMessage()` (atomic `db.$transaction`: message create + conversation `updatedAt`), guarded by `assertParticipant`.
5) The thread polls `getConversationMessages()` every 5s (paused while `document.hidden`) to surface the seller's replies.
6) Seller opens `/dashboard/seller/stores/[storeUrl]/messages` (force-dynamic; `getStoreConversations()` seeds the list, identifying each conversation by the buyer `user` name/picture) and selects a conversation.
7) Seller replies from that page using the same `sendMessage()` (participant check authorizes the store owner) and the same reused `conversation-thread.tsx`, closing the loop. The buyer's 5s polling then surfaces the reply.

## Order Shipping Notification Flow (plan 086)
1) A seller (`updateOrderGroupStatus`) or admin (`updateOrderGroupStatusAsAdmin`) changes an `OrderGroup` to `Shipped` or `Delivered`.
2) In the same `$transaction` as the status update, `recordOrderGroupStatusNotification` writes one `Notification` for the order's customer and one `NotificationDelivery(PENDING)` for email. Re-setting the same status, or repeating the same transition, does not add rows (`dedupeKey` unique). If the write fails, the status update rolls back and the caller gets the existing generic error.
3) After commit, `scheduleDispatch` sends the email via `after()` (stub provider unless `EMAIL_PROVIDER` is set). A send failure never changes the status update result.
4) Deliveries that were not sent (provider down, process exit, timeout) are retried by `GET /api/cron/notifications` until 23h after the first attempt, then marked `FAILED`; the in-app notification remains.
5) The customer sees an unread count on the header account menu and opens `/profile/notifications`; opening an unread item, or "Mark all as read", clears it.

## Order Cancellation and Restock Flow (plan 087)
1) Stock decremented by `placeOrder` is restored through any of five paths: order (`updateOrderPaymentStatus` → `Cancelled`/`Refunded`), group (admin `updateOrderGroupStatusAsAdmin` / seller `updateOrderGroupStatus` → `Canceled`/`Refunded`), or item (admin `updateOrderItemStatusAsAdmin` / seller `updateOrderItemStatus` → `Canceled`/`Refunded`/`Returned`).
2) Every path moves only the items that are not yet terminal into a terminal `ProductStatus`, inside the caller's `$transaction`, and restores stock only for the items that actually moved. Whatever the order or concurrency of the paths, each item's stock is restored exactly once.
3) A terminal item is absorbing: moving it back to a non-terminal status is rejected with `"Order item is already settled."` (shown via the existing toast). Relabeling between terminal statuses (e.g. `Canceled → Refunded`) is allowed and does not restock again. An order-level refund does not overwrite items that were already terminal.
4) Reopening a group (e.g. `Canceled → Processing`) updates only the group; its items stay terminal. Re-shipping is handled as a new order (exchange), not by reopening.
5) If the ordered `Size` row no longer exists (recreated by a product edit), the cancellation still completes and the restock for that item is skipped with a structured warning. Design: [`inventory-restock/design.md`](../../docs/design/inventory-restock/design.md).

## Seller Store and Catalog Flow
1) Apply for seller role and access the seller dashboard.
2) Create a store and configure default shipping settings.
3) Create products and variants with sizes, colors, and images. The product form renders the
   category attributes effective for the selected node (inherited, deepest key wins); required
   attributes block saving. Existing variants are edited at
   `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]`, which
   preloads the saved attribute values.
4) Configure per-country shipping rates.
5) View the store dashboard (F1) at `/dashboard/seller/stores/[storeUrl]`: 6 KPI
   cards (revenue from Paid orders, orders, views, sales, products, low-stock
   count), a sales-trend chart (`getStoreSalesOverTime`, reusing the admin
   `SalesChart`), recent orders (`getStoreRecentOrders`), and top products
   (`getStoreTopProducts`) — all store-scoped via `requireStoreOwner` and
   aggregated through `getStoreDashboardStats` (20-min cache keyed by `storeId`).
6) Manage inventory (F2): view stock per variant×size, quick-edit `Size.quantity`
   inline (`updateSizeStock`, IDOR-guarded), set the store-wide low-stock
   threshold (`updateStoreLowStockThreshold`), and read out-of-stock / low-stock
   counts via the alert summary. Stock status (out/low/ok) is derived by the
   shared `getStockStatus` helper.
7) Receive orders grouped by store and fulfill items.

## Admin Catalog Flow
1) View KPI dashboard: total revenue (Paid orders), order count, active/pending
   stores, user count, product count, categories and subcategories — aggregated
   via `getAdminDashboardStats()` with 20-minute cache.
2) Review sales trend chart (daily last-30-days or monthly last-12-months) via
   `getSalesOverTime()`, and inspect recent orders/stores at a glance.
3) Manage categories, subcategories, and offer tags.
4) Review store listings and update store status.
5) Manage coupons across all stores (`/dashboard/admin/coupons`):
   - View all-store coupon list with store name and Active/Inactive status badge.
   - Toggle `isActive` per coupon to immediately deactivate without changing dates.
   - Delete any coupon regardless of store ownership.
   - Create new coupons via `upsertCouponAsAdmin()` (P2002 → Japanese error message).

## Auth and Role Sync
1) User signs up or updates profile in Clerk (e.g. via the `/profile/settings` page,
   which embeds Clerk `<UserProfile />` for name/email/password/MFA/account-deletion).
2) Clerk webhook upserts (or deletes) the user in the local database (`user.updated` /
   `user.deleted` → `db.user.upsert` / `deleteMany`).
3) Clerk private metadata is updated with the role.

## Country Detection
1) Middleware checks for the `userCountry` cookie.
2) If missing, country is detected and written to cookies.

### Cart presentation and feedback (2026-10-01)

The branded cart shows persisted items after synchronization, preserves local items with refresh feedback on sync failure, and keeps the existing stale-item removal notice. Item removal also removes its shipping contribution. Saving shows a pending status and locks the checkout button; rejection leaves the bag available for retry. See [cart design](../../docs/design/cart/design.md).

## Account Order History

1. Open `/profile/orders` or an existing `/profile/orders/{filter}` shortcut after authentication. Render the server result in the branded account shell, with a collection link for empty orders.
2. Select one of five status filters or four periods, or submit the labeled search form with Search/Enter. New conditions reset page to 1; previous/next preserves applied conditions. Empty search clears search; Remove all filters clears status, period and search.
3. During lookup, show a status/skeleton, disable controls and hide the pager and old results. On failure, show a generic alert and retry using the same conditions. Initial lookup errors use the same retry path.
4. Read IDs, dates, item counts, thumbnails, payment/delivery status and totals, and follow the unchanged order-detail URL. Page-local filters reset to route defaults on reload. No purchase, payment or fulfillment side effects are added.

## Account Payment History

1. Open `/profile/payment` after authentication and view server-provided records; empty history offers the collection link.
2. Select View all / PayPal / Credit card, select one of four periods, or submit payment-ID/intent-ID search with Search/Enter. New conditions reset to page 1; paging preserves applied conditions. Empty search removes search; Remove all filters clears method, period and search.
3. During lookup, announce loading, lock controls and hide stale records/paging. Failure shows a generic alert and retries the same conditions; initial lookup failure uses the same path.
4. Read payment IDs, update date, intent ID, method, dollar amount and status, and follow `/order/{orderId}`. Stripe and PayPal amounts are already stored in dollars and are never divided by 100. Page-local conditions reset on reload; browsing performs no payment or refund.

## Profile shipping address management

1. Authenticate and open `/profile/addresses`; render server-provided cards/default indicator or empty state. Refresh addresses reloads supported countries and addresses; failure offers Try again.
2. Add new address or Edit opens a labeled dialog with native supported-country selection and existing schema validation. Editing restores address line 2, country and default as well as other fields.
3. Save locks all input/submission/dismissal actions and prevents duplicates. The dialog remains keyboard scrollable. Failure retains input for retry; success closes the dialog, restores trigger focus and updates cards/default/status.
4. Make default explicitly updates an owned address via the existing atomic upsert. Pending blocks repeated changes; failure retains the list and allows retry; success leaves at most one default indicator. Browsing/card selection alone never saves. No deletion or purchase is added.

## Profile review history

1. Authenticate and open `/profile/reviews`; render server-provided own reviews or the empty collection link without a second mount request.
2. Choose View all/1–5 stars, select a period, or submit text search with Search/Enter. New conditions reset page 1; paging retains applied conditions. Unsubmitted draft is not applied by rating/period changes; empty submission clears search, Remove all filters clears every condition.
3. Lookup locks controls and shows status/skeleton without stale cards. Generic failure keeps conditions for Try again; success renders review cards and page metadata.
4. Read masked author/avatar, fractional rating, variant/color/size/quantity/text/photos and update date. Page-local conditions reset on reload. This history view does not post/edit/delete a review or purchase a product.

## Profile message presentation flow

1. Authenticate and open `/profile/messages`; show initial own store conversations or empty collection link, with generic load failure/retry when needed.
2. Select a conversation by keyboard/touch. Clear previous messages, fetch the thread and mark counterpart messages read. Show sender labels and UTC times; thread failure offers retry, read-status failure keeps the thread and offers its own retry.
3. While selected, poll every five seconds when the tab is visible. Prevent overlapping polls and discard responses after switching/unmounting. Queue a post-send refresh after an active poll.
4. Submit a labeled message using existing trim/1–2000 character validation. Sending locks input/selection/reload and prevents duplicates; failure preserves the draft, success clears it and refetches. No new conversation initiation or attachment UI is added.

## Purchase UI pending and recovery

The checkout UI locks order submission while shipping/cart refresh, address save/reload or coupon submission is active. A refresh failure retains the last displayed data but keeps ordering locked until retry succeeds. Address selection changes remain serialized through the existing cart-write queue. Order success retains the duplicate guard through navigation even if cart cleanup fails. The order page keeps the established payment-visibility condition and mutually locks provider UI during payment. Script/initialization and transaction failures have readable feedback/retry; provider-side authorization, calculation and order state transitions are unchanged.

## Discovery and public problem support

1. Explore offers and follow the existing `/browse?offer=<url>` destination; empty results offer the collection and lookup failure reloads `/offers`.
2. Submit a public dispute (UUID order number required) or problem report (no order-number field) with existing validation. Inputs lock while pending, failures retain drafts and allow retry, success announces receipt. No refund or order-state transition is added.
3. After authentication, revisit followed stores and toggle follow with per-store pending lock and failure/success feedback. Navigate by URL page links or browser back/forward.
4. Read browser productHistory after hydration, retrieve variant IDs in their saved order, use existing editorial product actions, and page by URL. Malformed storage is empty; unavailable storage/query failures retry. Out-of-range results fetch the last valid page and replace the URL; cleanup discards previous-page responses.

## 優先7画面の表示移行（2026-10-05）

出店申請の4ステップ・payload・承認待ち状態は保持。説明開閉、読み上げ可能な進捗、native label、送信中ロックと失敗時の入力保持/再試行を整備。設定のClerk hash routingを維持。販売者shellはモバイル開閉ナビとlight/darkに対応。[表示要件](../../docs/design/seller-ui-migration/requirements.md)／[証跡](../../docs/design/design-system/PROGRESS.md#優先7画面移行記録)。DB/認可/状態遷移は変更なし。

### Seller workspace presentation workflows

Server pages load existing store-scoped data and inject typed actions into the opted-in seller views. Products distinguish empty/search results from load failure; creation uses the existing form and deletion requires confirmation. Inventory validates integers, announces pending and restores the committed value after failure; explicit retry resubmits the attempted value. Order group/item status edits use existing enum choices and authorized update actions, retain proposed values after failure and announce success. Details use responsive panels and return focus on close. Seller message list loading/read/thread/send errors have explicit retry, send locks switching/refresh/back, failure retains the draft, success clears and reloads the thread. Five-second polling skips hidden tabs, discards stale selections, avoids overlap and cancels on unmount. Mobile Back clears selection and restores focus. Latest-message unread indication clears only after successful read marking; it does not represent total unread count. [UI contract](../../docs/design/seller-ui-migration/requirements.md).

## Seller six-screen editing flow

The branded product editor keeps the existing category/attribute/image/size workflow. Saving locks fields, guards duplicate requests, announces completion and retains inputs after failure for another submission. Existing list navigation and edit refresh remain unchanged.

Shipping defaults and country overrides retain their existing save actions and store refresh. Country search scopes the table; a labeled editing dialog locks fields and dismissal during pending save, retains inputs for retry and returns focus after dismissal.

New-store users complete validated profile/contact/logo/cover fields in the standalone theme. Pending locks all controls; failure retains drafts; a successful no-id create submission navigates to the returned store URL. Existing-store saves include id. If the returned store URL changed, replace the route with its settings URL; otherwise refresh.

## P3優先6画面のデザイン移行（2026-10-05）

取得失敗はLoadErrorからrefresh再試行。注文状態更新は管理者用既存Actionへ接続。店舗・クーポン削除は確認→pending→成功／error再試行、pending中の重複送信・閉鎖を防止。クーポン編集はgetCouponで最新値取得後に開き、null／失敗は保存させず再試行。新規作成は入力→Zod検証→既存保存→店舗クーポン一覧へ復帰。分精度の日時入力は秒を00で補い、秒を含む値はそのまま保持。guest dashboardは既存どおり/へ転送。

詳細は[計画](../../plans/layout-design/priority-six-p3-design-system-plan.md)と[検証正本](../../docs/testing/QA_HANDOFF.md#ds-p3-six-browser)を参照。

## P4管理マスタ6画面のデザイン移行（2026-10-06）

一覧検索から編集すると最新データを取得し、null/失敗は入力画面を表示せずretryする。閉じた編集sessionの応答は無視する。保存/削除中は重複操作とdialog終了を防止し、失敗時入力を保持する。カテゴリ/offer作成は既存一覧URLへ、編集とadmin coupon保存/toggle/削除はrefreshする。削除は確認とキャンセルを経由する。

[証跡と受け入れ保留](../../docs/design/design-system/PROGRESS.md#p4優先6画面移行記録)。
