# Workflows

## Customer Purchase Flow
1) Browse or search products. `/browse` paginates at 10 products per page: the page reads the
   `page` query parameter, passes it to `getProducts`, and renders the shared pager only when
   `totalPages > 1`. Paging preserves the active filters, sort, and search terms — the pager
   rewrites only the `page` parameter. Invalid values (`NaN`, `Infinity`, fractions, `< 1`)
   fall back to page 1.
2) Open product page and choose a variant and size.
3) Add to cart (Zustand + localStorage).
4) Server-side cart validation via `saveUserCart()` recalculates prices, stock, and shipping from DB.
5) Proceed to checkout and select shipping address; `updateCheckoutProductWithLatest()` recalculates shipping for selected country.
6) Create an order atomically via `placeOrder()` (`db.$transaction`) with inventory deduction.
7) Select payment method and capture payment via Stripe or PayPal.
8) Order status and payment details are updated via payment webhook.
9) Customer views order history and order details.

## Offer Discovery Flow
1) Customer opens `/offers` from the user-menu "Discounts & Offers" link (now wired to `/offers`) or directly.
2) The page (`force-dynamic`) calls `getAllOfferTags()`, listing every `OfferTag` ordered by product count (empty state when none exist).
3) Each offer links to `/browse?offer=<url>`; product filtering, sorting, and paging are delegated to the existing `/browse` + `getProducts` offer filter (no product grid re-implemented on `/offers`).

## Static Content & Support Flow
1) Customer reaches static pages from the footer links or the user-menu: "Help Center" → `/customer-service`, "Legal & Privacy" → `/legal` (both previously empty strings, now wired).
2) `/customer-service` is a support hub presenting cards to `/contact`, `/returns-exchange`, `/faqs`, `/track-order`, and `/product-support`.
3) `/about`, `/legal` (with table of contents), `/faqs`, and `/product-support` render typed content constants through the shared `StaticPageLayout` (plain-text paragraphs only; placeholder copy pending operator replacement).
4) Legacy `/faq` issues a 308 `permanentRedirect` to the canonical `/faqs`. All pages are public (outside middleware protection) and DB-independent (SSG, no `force-dynamic`).

## Support Form Submission Flow
1) Customer (guest or signed-in) reaches a support form: `/contact` (general), `/returns-exchange` (return/exchange, shows a policy summary on top), `/dispute` (order dispute), or `/report-problem`. The user-menu wires "Return & Refund Policy" → `/returns-exchange`, "Order Dispute Resolution" → `/dispute`, and "Report a Problem" → `/report-problem`.
2) The shared `SupportForm` (client) collects name / email / subject / message, plus an order number for `/returns-exchange` and `/dispute` (`requireOrderId`). It validates with `SupportTicketSchema` (RHF + zodResolver) and guards against double submission with a `useRef` flag.
3) On submit, the public server action `createSupportTicket(input)` re-validates, attaches `userId` only when `currentUser()` resolves (guest submissions leave it null), and creates one `SupportTicket` row with the form's `category`. The message body (PII) is never logged.
4) On success the form shows a receipt message (`role="status"`); a generic failure surfaces as a root-level error (`role="alert"`). No external email/notification is sent in this MVP — operators triage via the stored `status` (admin viewing UI is a follow-up).

## Order Tracking Flow
1) Customer (guest or signed-in) reaches `/track-order` from the footer "Track your Order" link or the `/customer-service` support hub card.
2) The client `TrackOrderForm` collects an order number and email, validates with `TrackOrderSchema` (RHF + zodResolver), and guards against double submission with a `useRef` flag.
3) On submit, the public server action `trackOrder({ orderId, email })` fetches the order by `where: { id: orderId }` only and compares the input email to the owner `User.email` in the app layer (case-insensitive). A match returns the order (groups → items / store) with email stripped; a mismatch, a missing order, or invalid input all return the **same** `null` (enumeration-safe).
4) `TrackOrderResult` renders the overall `orderStatus` / `paymentStatus` and, per store group, the shipping service and delivery window plus each item's `ProductStatus`, reusing the shared `OrderStatusTag` / `PaymentStatusTag` / `ProductStatusTag`. A `null` result shows a single generic "not found" message.

## Product Compare Flow
1) Customer clicks the Add-to-compare toggle on a product card (`product-card.tsx`), which stores the selected `ProductVariant.id` in `useCompareStore` (Zustand + persist, localStorage key `compare-store`, max 4 items, idempotent). The toggle removes the variant if already present and shows a toast; a 5th add is rejected with an error toast.
2) Customer opens `/compare` (client wrapper page; no server render of store queries, so no `force-dynamic`).
3) `CompareGrid` (client) reads the variant ids from `useCompareStore`. When the list is empty it renders an empty state and does **not** call `getProductsByIds` (that query throws on an empty id array).
4) For a non-empty list, `CompareGrid` fetches products via the existing `getProductsByIds()` (guarded by a `useEffect` cancellation flag) and renders them side-by-side (image / name / lowest size price / rating) with per-column remove and a clear-all action.

## Buyer↔Seller Messaging Flow
1) A conversation is created idempotently per `(userId, storeId)` via `getOrCreateConversation()`.
2) Buyer opens `/profile/messages` (force-dynamic; `getUserConversations()` seeds the list) and selects a conversation.
3) On selection the thread loads via `getConversationMessages()` and peer-sent unread are cleared via `markConversationRead()`.
4) Buyer sends a message via `sendMessage()` (atomic `db.$transaction`: message create + conversation `updatedAt`), guarded by `assertParticipant`.
5) The thread polls `getConversationMessages()` every 5s (paused while `document.hidden`) to surface the seller's replies.
6) Seller opens `/dashboard/seller/stores/[storeUrl]/messages` (force-dynamic; `getStoreConversations()` seeds the list, identifying each conversation by the buyer `user` name/picture) and selects a conversation.
7) Seller replies from that page using the same `sendMessage()` (participant check authorizes the store owner) and the same reused `conversation-thread.tsx`, closing the loop. The buyer's 5s polling then surfaces the reply.

## Seller Store and Catalog Flow
1) Apply for seller role and access the seller dashboard.
2) Create a store and configure default shipping settings.
3) Create products and variants with sizes, colors, and images.
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
