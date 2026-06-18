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

## Seller Store and Catalog Flow
1) Apply for seller role and access the seller dashboard.
2) Create a store and configure default shipping settings.
3) Create products and variants with sizes, colors, and images.
4) Configure per-country shipping rates.
5) Manage inventory (F2): view stock per variant×size, quick-edit `Size.quantity`
   inline (`updateSizeStock`, IDOR-guarded), set the store-wide low-stock
   threshold (`updateStoreLowStockThreshold`), and read out-of-stock / low-stock
   counts via the alert summary. Stock status (out/low/ok) is derived by the
   shared `getStockStatus` helper.
6) Receive orders grouped by store and fulfill items.

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
1) User signs up or updates profile in Clerk.
2) Clerk webhook upserts the user in the local database.
3) Clerk private metadata is updated with the role.

## Country Detection
1) Middleware checks for the `userCountry` cookie.
2) If missing, country is detected and written to cookies.
