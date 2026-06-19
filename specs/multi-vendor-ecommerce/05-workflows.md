# Workflows

## Customer Purchase Flow
1) Browse or search products.
2) Open product page and choose a variant and size.
3) Add to cart (Zustand + localStorage).
4) Server-side cart validation via `saveUserCart()` recalculates prices, stock, and shipping from DB.
5) Proceed to checkout and select shipping address; `updateCheckoutProductWithLatest()` recalculates shipping for selected country.
6) Create an order atomically via `placeOrder()` (`db.$transaction`) with inventory deduction.
7) Select payment method and capture payment via Stripe or PayPal.
8) Order status and payment details are updated via payment webhook.
9) Customer views order history and order details.

## Buyer↔Seller Messaging Flow
1) A conversation is created idempotently per `(userId, storeId)` via `getOrCreateConversation()`.
2) Buyer opens `/profile/messages` (force-dynamic; `getUserConversations()` seeds the list) and selects a conversation.
3) On selection the thread loads via `getConversationMessages()` and peer-sent unread are cleared via `markConversationRead()`.
4) Buyer sends a message via `sendMessage()` (atomic `db.$transaction`: message create + conversation `updatedAt`), guarded by `assertParticipant`.
5) The thread polls `getConversationMessages()` every 5s (paused while `document.hidden`) to surface the seller's replies.
6) Seller replies from the store dashboard messages page (Phase 4) using the same `sendMessage()` (participant check authorizes the store owner), closing the loop.

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
