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
  home, profile, review, coupon, stripe, paypal, user, size, dashboard.
- Mutations on user-owned resources verify ownership before writing.
  Example: review module uses conditional `update`/`create` with ownership
  check instead of `upsert` to prevent IDOR via client-supplied IDs.

### dashboard module (`src/queries/dashboard.ts`)

All functions require ADMIN role via `requireAdmin()` (called outside cache scope).

| Function | Description | Cache |
|----------|-------------|-------|
| `getAdminDashboardStats()` | Aggregates 8 KPIs in parallel (`Promise.all`): totalRevenue (Paid only), totalOrders, activeStores, pendingStores, totalUsers, totalProducts, totalCategories, totalSubCategories | `unstable_cache` 20 min, tag `admin-dashboard` |
| `getSalesOverTime(period)` | Returns `SalesPoint[]` bucketed by day (last 30 days) or month (last 12 months). Only Paid orders. JS-side bucket aggregation. | none |
| `getRecentOrders(limit?)` | Last N orders with `groups.store` and `shippingAddress.user` included. Default limit: 5. | none |
| `getRecentStores(limit?)` | Last N non-deleted stores ordered by `createdAt desc`. Default limit: 5. | none |

Return types: `AdminDashboardStats`, `SalesPoint[]` are exported from `dashboard.ts`.
Revenue `Decimal` fields are converted to `number` before return (serialization-safe).

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
