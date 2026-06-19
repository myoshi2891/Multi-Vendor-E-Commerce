# Interfaces

## UI Routes (App Router)
Storefront:
- `/` home
- `/browse` browse and search
- `/product/[productSlug]` product details
- `/product/[productSlug]/[variantSlug]` variant details
- `/store/[storeUrl]` store page
- `/cart` cart
- `/checkout` checkout (protected)
- `/order/[orderId]` order detail
- `/profile` profile overview
- `/profile/orders` and `/profile/orders/[filter]` order history
- `/profile/addresses` shipping addresses
- `/profile/payment` payment history
- `/profile/wishlist` wishlist
- `/profile/reviews` reviews
- `/profile/following` followed stores
- `/profile/history` activity history
- `/seller/apply` seller application

Auth:
- `/sign-in/*` Clerk sign-in
- `/sign-up/*` Clerk sign-up

Dashboard:
- `/dashboard` root
- `/dashboard/seller` seller overview
- `/dashboard/seller/stores` store list
- `/dashboard/seller/stores/new` create store
- `/dashboard/seller/stores/[storeUrl]` store details
- `/dashboard/seller/stores/[storeUrl]/inventory` inventory management (F2)
- `/dashboard/admin` admin overview
- `/dashboard/admin/stores` manage stores
- `/dashboard/admin/categories` manage categories
- `/dashboard/admin/subCategories` manage subcategories
- `/dashboard/admin/offer-tags` manage offer tags

## API Routes
- `POST /api/setUserCountryInCookies` set user country cookie
- `GET /api/index-products` paginated search results
- `POST /api/index-products` search suggestions for autocomplete
- `GET /api/search-products` raw SQL fulltext search
- `POST /api/webhooks` Clerk webhook (user sync); uses Svix SDK-verified
  `evt.data` for payload extraction. User upsert uses immutable Clerk user
  ID as lookup key (not email). Deletion uses `deleteMany` for idempotent
  retry handling.

## Server Actions (Queries)
- Domain modules live in `src/queries/*.ts`.
- Notable modules: category, subCategory, offer-tag, product, store, order,
  home, profile, review, coupon, stripe, PayPal, user, size, dashboard, inventory,
  store-dashboard.
- Mutations on user-owned resources verify ownership before writing.
  Example: review module uses conditional `update`/`create` with ownership
  check instead of `upsert` to prevent IDOR via client-supplied IDs.

### dashboard module (`src/queries/dashboard.ts`)

All functions require ADMIN role via `requireAdmin()` (called outside both cache scope and `try/catch` — intentional: auth errors must propagate with their specific messages and must not be swallowed by the generic DB error handler).

| Function | Description | Cache |
|----------|-------------|-------|
| `getAdminDashboardStats()` | Aggregates 8 KPIs in parallel (`Promise.all`): totalRevenue (Paid only), totalOrders, activeStores, pendingStores, totalUsers, totalProducts, totalCategories, totalSubCategories | `unstable_cache` 20 min, tag `admin-dashboard` |
| `getSalesOverTime(period)` | Returns `SalesPoint[]` bucketed by day (last 30 days) or month (last 12 months). Only Paid orders. JS-side bucket aggregation. | none |
| `getRecentOrders(limit?)` | Last N orders with `groups.store` and `shippingAddress.user` included. Default limit: 5. | none |
| `getRecentStores(limit?)` | Last N non-deleted stores ordered by `createdAt desc`. Default limit: 5. | none |

Return types: `AdminDashboardStats`, `SalesPoint[]` are exported from `dashboard.ts`.
Revenue `Decimal` fields are converted to `number` before return (serialization-safe).

### coupon module (`src/queries/coupon.ts`) — admin functions

Admin-only functions require ADMIN role via `requireAdmin()` (outside `try/catch` per auth-guard convention). Seller functions use `requireStoreOwner(storeUrl)`.

| Function | Permission | Description |
|----------|-----------|-------------|
| `getAllCoupons()` | Admin | All-store coupon list with `store` included. Max 100 rows. |
| `upsertCouponAsAdmin(coupon)` | Admin | Create/update coupon. P2002 unique violation → Japanese error message. |
| `deleteCouponAsAdmin(couponId)` | Admin | Delete coupon without store ownership check. |
| `toggleCouponActive(couponId)` | Admin | Flip `isActive` boolean. Returns updated coupon. |
| `upsertCoupon(coupon, storeUrl)` | Seller | Create/update coupon for own store (IDOR-guarded via `requireStoreOwner`). |
| `getStoreCoupons(storeUrl)` | Seller | Own-store coupons only. |
| `deleteCoupon(couponId, storeUrl)` | Seller | Delete own-store coupon. |
| `applyCoupon(code, cartId)` | Public | Apply coupon to cart. Validates date range, `isActive`, store match. |

`Coupon.isActive Boolean @default(true)` added in Phase 3 F3-第1段 (migration `20260615075233`).

### inventory module (`src/queries/inventory.ts`) — seller F2

All functions require store ownership via `requireStoreOwner(storeUrl)` (called outside `try/catch` per auth-guard convention).

| Function | Description |
|----------|-------------|
| `getStoreInventory(storeUrl)` | All `Size` rows for the store, flattened to product → variant → size. Returns `StoreInventoryRow[]` (`Decimal` price → `number` at return boundary). |
| `updateSizeStock(sizeId, quantity, storeUrl)` | Quick-edit a size's stock. IDOR/TOCTOU-guarded by folding the ownership chain (`size → productVariant → product.storeId`) into the `where` of a single atomic `db.size.updateMany`; `count === 0` (non-owned `sizeId` or missing) → `Forbidden` with no side effect. Input validated by `UpdateSizeStockSchema` (int ≥ 0). |
| `updateStoreLowStockThreshold(storeUrl, threshold)` | Update `Store.lowStockThreshold` (drives low-stock badge/summary). Validated by `LowStockThresholdSchema`. |

`Store.lowStockThreshold Int @default(5)` added in Phase 1 (additive). `getStockStatus(quantity, threshold)` (pure, `src/lib/utils.ts`) classifies `out`/`low`/`ok` and is shared by the badge and alert summary. Return type `StoreInventoryRow` is derived via `Prisma.PromiseReturnType` in `src/lib/types.ts`.

UI (Phase 2-C): `inventory/page.tsx` (RSC, `force-dynamic`) + `inventory/columns.tsx` (`getInventoryColumns(threshold, storeUrl)` factory) + `src/components/dashboard/seller/{stock-status-badge,inventory-quantity-cell,low-stock-threshold-form,inventory-alert-summary}.tsx`.

### store-dashboard module (`src/queries/store-dashboard.ts`) — seller F1

Store-scoped derivation of the admin `dashboard` module. All functions require store ownership via `requireStoreOwner(storeUrl)` (called outside both cache scope and `try/catch` per auth-guard convention), and inject the resolved `store.id` into every `where`.

| Function | Description | Cache |
|----------|-------------|-------|
| `getStoreDashboardStats(storeUrl)` | Aggregates 6 KPIs in parallel (`Promise.all`): totalRevenue (own `OrderGroup.total` where parent `Order.paymentStatus=Paid` only), totalOrders, totalViews (Σ `Product.views`), totalSales (Σ `Product.sales`), totalProducts, lowStockCount (`Size` with `quantity ≤ store.lowStockThreshold`). | `unstable_cache` 20 min, **key includes `storeId`**, tag `store-dashboard-${storeId}` (prevents cross-store cache bleed, NFR-8) |
| `getStoreSalesOverTime(storeUrl, period?)` | Returns `SalesPoint[]` bucketed by day (last 30 days) or month (last 12 months) from own Paid `OrderGroup`s. JS-side bucket aggregation with `Prisma.Decimal` (`.toNumber()` at return boundary). | none |
| `getStoreRecentOrders(storeUrl, limit?)` | Last N own `OrderGroup`s with `items`/`coupon`/parent `order` (`shippingAddress`) included, ordered by `updatedAt desc`. Default limit: 5. | none |
| `getStoreTopProducts(storeUrl, limit?)` | Own products ordered by `sales desc`. Default limit: 5. | none |

Return type `StoreDashboardStats` is exported from `store-dashboard.ts`; `SalesPoint` is reused from `dashboard.ts` (single source shared with `SalesChart`). `StoreRecentOrderType` / `StoreTopProductType` are derived via `Prisma.PromiseReturnType` in `src/lib/types.ts`. Revenue `Decimal` is converted to `number` before return. UI (Phase 3-B, implemented): `[storeUrl]/page.tsx` placeholder replaced with a KPI dashboard (`Promise.all` over the four store-scoped queries + `force-dynamic`) + `src/components/dashboard/seller/{store-stats-cards,store-recent-orders,store-top-products}.tsx` (chart reuses admin `sales-chart.tsx`).

## External Services
- Clerk for auth and user metadata.
- Stripe and PayPal for payments.
- Cloudinary for media uploads.
- PostgreSQL (Neon) as primary datastore.

## Environment Variables (Observed Usage)
- `DATABASE_URL`
- `DIRECT_URL`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `WEBHOOK_SECRET`
