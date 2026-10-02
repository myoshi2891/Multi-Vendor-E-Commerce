# Interfaces

## UI Routes (App Router)
Storefront:
- `/compare` public comparison page; Server Component passes the existing `getProductsByIds` action as `fetchProductsAction` to the client grid. Keeps the `compare-store` localStorage key and four-variant limit. No new API or action signature. See the compare flow for empty/loading/error/retry/unavailable states.
- `/` dynamic storefront landing page (`force-dynamic`). Streams `BrandExperience` and `Selection` through separate Suspense boundaries; `getBrandCategories` supplies up to three live category slugs, and the selection uses `getProducts` for up to eight displayable products. The experience's WebGL scene is decorative and client-only; navigation and shopping links remain in HTML. See `05-workflows.md` for display and failure states.
- `/browse` browse and search; reads `search`, `category`, legacy `subCategory`, `offer`, repeatable `size` / `color`, `minPrice`, `maxPrice`, `sort`, and 1-based `page` query parameters. `page` is normalized per the tech.md URL-parameter rule and passed to `getProducts(filters, sort, page)`; out-of-range pages redirect to the last available page (or page 1 for zero results). Resolvable legacy `subCategory` redirects (308) to `category` only when it is nested under the supplied category or no category is supplied; conflicting or unresolvable category filters retain fail-closed results. The pager renders only when `totalPages > 1`, via `src/components/store/browse-page/browse-pagination.tsx`, preserving other query parameters and replacing only `page`.
- `/offers` platform-wide offer (OfferTag) landing; each tag links to `/browse?offer=<url>` (reuses `getAllOfferTags`, `force-dynamic`)
- `/about` `/legal` `/faqs` `/product-support` public content pages (DB-independent; typed content constants in `src/components/store/static/content/`). Branded pages use dedicated Server Component layouts; `/legal` retains `StaticPageLayout`. Parent store rendering remains unchanged.
- `/customer-service` support hub portal (cards linking to `/contact` `/returns-exchange` `/faqs` `/track-order` `/product-support`)
- `/faq` → 308 `permanentRedirect` to canonical `/faqs` (deduplicates the legacy footer link)
- `/product/[productSlug]` redirects to the first variant, or `/` when the product is missing, has no variants, or cannot be loaded.
- `/product/[productSlug]/[variantSlug]` dynamic variant detail page. Missing product data returns 404. Optional `size` is a size ID: invalid IDs redirect to the variant URL without `size`, and a variant with exactly one size redirects to `?size=<id>`. The page fetches product data plus same-category related products; category and offer navigation fetches may fail independently and then render empty navigation lists. The client purchase panel uses the selected size for price, stock, quantity, and cart actions; further UI behavior is specified in `05-workflows.md`.
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
- `/profile/settings` account settings (embeds Clerk `<UserProfile routing="hash" />`; no server action — edits sync to Prisma via the Clerk webhook)
- `/profile/messages` buyer↔seller messaging (force-dynamic; two-pane list + thread with 5s polling)
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
- `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new` add a variant to an existing product
- `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]` edit an existing product + variant (`force-dynamic`; loads via `getProductVariantForEdit`, including category-attribute initial values)
- `/dashboard/seller/stores/[storeUrl]/inventory` inventory management (F2)
- `/dashboard/seller/stores/[storeUrl]/messages` seller-side messaging (force-dynamic; two-pane list identified by buyer + reused thread)
- `/dashboard/admin` admin overview
- `/dashboard/admin/stores` manage stores
- `/dashboard/admin/categories` manage categories
- `/dashboard/admin/subCategories` manage subcategories
- `/dashboard/admin/offer-tags` manage offer tags
- `/dashboard/admin/attributes` manage category attribute definitions (`/new`, and `/[id]/options` for ENUM allowed values) — plan 069

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
  store-dashboard, message, support, attribute.
- Mutations on user-owned resources verify ownership before writing.
  Example: review module uses conditional `update`/`create` with ownership
  check instead of `upsert` to prevent IDOR via client-supplied IDs.
- Because `"use server"` files may only export `async` functions, helpers shared between
  query modules live in `src/lib/`: `payment-status.ts` (`isSettledPaymentStatus`,
  `SETTLED_PAYMENT_STATUSES` — the SSOT for irreversible payment states) and
  `order-settlement.ts` (`hasOrderSettledAfterConflict(orderId, logPrefix)` — after a CAS
  `update` returns P2025, re-reads the order and reports whether it actually reached a settled
  state, so that a concurrent delete or a lost `connect` target is not misreported as
  "already paid"; returns `false` without throwing when the re-read itself fails, preserving
  the original P2025). Both are shared by `stripe.ts` and `paypal.ts`.
- Helpers used by only one query module stay module-private inside that file
  (non-exported declarations are unconstrained by `"use server"`), e.g. `user.ts`'s cart-item
  validation helpers and `paypal.ts`'s `requirePayPalUser` / `findOwnedPayPalOrder`.

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

### order module (`src/queries/order.ts`) — public order tracking

| Function | Permission | Description |
|----------|-----------|-------------|
| `trackOrder(input)` | **Public** (no auth guard) | Looks up an order for the public `/track-order` page by `{ orderId, email }` (validated by `TrackOrderSchema`). Fetches with `where: { id: orderId }` only and matches the owner `User.email` in the app layer (`toLowerCase()`), so identity is proven by email match rather than a `userId` where-clause. Returns the order (`groups → items / store`) with `user`/email stripped, or `null`. A not-found order and an email mismatch return the **same** `null` to prevent order-id enumeration (IDOR 3-layer: validation short-circuit returning `null` instead of throwing / where-structure / no side effects). Invalid input also returns `null` (no `findUnique` call); a `safeParse` failure does not throw. Unexpected DB/infra errors are **re-thrown** (not collapsed into `null`) so the UI can show a generic retry message instead of the not-found message. No PII (email/orderId) is logged. |

This is distinct from `getOrder(orderId)`, which is authenticated (`where: { id, userId }`) and powers the signed-in order detail page; both coexist.

### coupon module (`src/queries/coupon.ts`) — admin functions

Admin-only functions require ADMIN role via `requireAdmin()` (outside `try/catch` per auth-guard convention). Seller functions use `requireStoreOwner(storeUrl)`.

| Function | Permission | Description |
|----------|-----------|-------------|
| `getAllCoupons()` | Admin | All-store coupon list with `store` included. Max 100 rows. |
| `upsertCouponAsAdmin(coupon)` | Admin | Create/update coupon. Server-side `AdminCouponFormSchema.safeParse` gate + explicit field mapping (plan 060). P2002 unique violation → Japanese error message. |
| `deleteCouponAsAdmin(couponId)` | Admin | Delete coupon without store ownership check. |
| `toggleCouponActive(couponId)` | Admin | Flip `isActive` boolean. Returns updated coupon. |
| `getCouponAsAdmin(couponId)` | Admin | Unscoped single-coupon read (incl. PLATFORM coupons with `storeId = null`). Added in plan 058. |
| `upsertCoupon(coupon, storeUrl)` | Seller | Create/update coupon for own store (IDOR-guarded via `requireStoreOwner`). Server-side `CouponFormSchema.safeParse` gate + explicit field mapping — blocks `discount > 99` → negative order totals (plan 060). |
| `getStoreCoupons(storeUrl)` | Seller | Own-store coupons only. |
| `getCoupon(couponId, storeUrl)` | Seller | Own-store single-coupon read, scoped `findFirst { id, storeId }`. Was an unauthenticated `findUnique` (cross-store IDOR read, SECURITY-10) until plan 058. |
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

### message module (`src/queries/message.ts`) — buyer↔seller messaging

1:1 conversation threads between a buyer (`User`) and a `Store`. Conversation uniqueness is `@@unique([userId, storeId])`. Authorization: list queries scope by `requireUser()` (buyer) or `requireStoreOwner(storeUrl)` (seller); per-conversation read/send/mark use a private `assertParticipant(conversationId, userId)` helper that loads the conversation with `store.userId` and throws `"Forbidden: not a participant of this conversation."` unless the caller is the buyer or the store owner. Auth/participant checks run **outside** `try/catch` (auth errors are not overwritten by generic DB messages). No money fields → no `Decimal`.

| Function | Description | Auth |
|----------|-------------|------|
| `getOrCreateConversation(storeId, orderId?)` | Idempotent `upsert` on the `userId_storeId` composite key (returns existing or creates). | `requireUser` |
| `getUserConversations()` | Buyer's conversations (`where: userId`) with store info + latest message, `updatedAt desc`. | `requireUser` |
| `getStoreConversations(storeUrl)` | Store's conversations (`where: storeId`); include adds the buyer `user` (id/name/picture) for seller-side identification. | `requireStoreOwner` |
| `getConversationMessages(conversationId)` | Thread messages (`createdAt asc`). | `assertParticipant` |
| `sendMessage(conversationId, content)` | `db.$transaction([message.create, conversation.update({updatedAt})])`. Content validated by `SendMessageSchema` (1–2000 chars). | `assertParticipant` |
| `markConversationRead(conversationId)` | `updateMany` peer-sent unread only (`senderId: { not: user.id }, isRead: false`). Idempotent. | `assertParticipant` |

Sender role is derived (`message.senderId === conversation.userId` ⇒ buyer-sent), not stored. `SendMessageSchema` / `StartConversationSchema` live in `src/lib/schemas.ts`; `ConversationWithLatest` / `MessageType` / `StoreConversationWithLatest` are derived via `Prisma.PromiseReturnType` in `src/lib/types.ts`. Buyer UI (Phase 3, implemented): `/profile/messages` (`force-dynamic`) + `src/components/store/profile/messages/{messages-container,conversation-thread}.tsx` (5s polling with `cancelled` flag + `document.hidden` pause). Seller UI (Phase 4, implemented): `/dashboard/seller/stores/[storeUrl]/messages` (`force-dynamic`) + `src/components/dashboard/seller/seller-messages-container.tsx` reusing `conversation-thread.tsx`; the list is identified by the buyer `user`. Round-trip E2E (Phase 5) is planned.

### attribute module (`src/queries/attribute.ts`) — category attributes (plan 069)

Definitions hang off a `Category` node and are inherited by its subtree; for the same `key` on the ancestor path the **deepest node wins** (`resolveEffectiveDefinitions`, `src/lib/attribute-definitions.ts`). Deletion is logical (`archivedAt`); archived definitions keep their values but drop out of the effective set. Storage invariants (scope / type / multi-valued, one value per attribute) are enforced by DB constraints — ADR-007 D-5〜D-7.

| Function | Description | Auth |
|----------|-------------|------|
| `upsertAttributeDefinition(input)` | Create via `INSERT ... ON CONFLICT ("categoryId","key") WHERE "archivedAt" IS NULL` (concurrent creates converge on one row; a shape mismatch is rejected). Update refuses `key` changes and type / scope / multiValued changes while values exist. | `requireAdmin` |
| `archiveAttributeDefinition(id)` / `restoreAttributeDefinition(id)` | Logical delete / restore. | `requireAdmin` |
| `getAllAttributeDefinitions()` / `getAttributeDefinition(id)` | Admin list / detail. | `requireAdmin` |
| `upsertAttributeOption(definitionId, input)` / `archiveAttributeOption(id)` / `restoreAttributeOption(id)` | ENUM allowed values; `value` is immutable, `label` renames follow through to product display (A-4). | `requireAdmin` |
| `changeAttributeTypeToNumber(id)` | TEXT → NUMBER. Route 1 (all rows convertible) converts in place; route 2 archives the TEXT definition, keeps unconvertible values there and moves the rest to a new NUMBER definition (A-7). | `requireAdmin` |
| `getEffectiveAttributeDefinitions(categoryId)` | Effective definitions (active options only) for the product form. | Public (catalog metadata) |

The seller edit page reads values through `getProductVariantForEdit(storeUrl, productId, variantId)` in `src/queries/product.ts` (`requireStoreOwner`; the product lookup is scoped by `storeId`, so another store's product returns `null`). It returns the product form shape plus `productAttributes` / `variantAttributes` initial values and `archivedCurrent` — only **this record's** archived current options, which the form lists as "(Discontinued)" so an unedited save passes (A-11). The product form warns (without blocking) when a legacy `Spec` name duplicates a category attribute (`findSpecAttributeOverlaps`), and `Spec` rows are optional (fully blank rows are dropped).

Product values are written only through `upsertProduct`'s `attributes: AttributeValueInput[]` payload (owner-discriminated: VARIANT carries `variantId`). `src/lib/attribute-sync.ts` validates outside the transaction (early rejection) and again inside it after locking Category → Product → Variant → Definition → Option rows; the column choice lives only in `src/lib/attribute-value.ts`. The storefront reads values via `findProductAttributeDisplay` (`src/lib/attribute-repository.ts`) and `product-specs.tsx` renders **Specifications** (structured attributes) above **Other specifications** (legacy `Spec`).

### support module (`src/queries/support.ts`) — public support forms

Four support form types (contact / return / dispute / problem-report) collapse into a single `SupportTicket` model identified by `SupportTicketCategory`. The submit action is **public** (no auth guard) so guests can submit; when signed in, `currentUser()` attaches `userId` (a failure is logged and degrades to a guest submission). PII (the message body) is never logged. The `orderId` ownership is **not** verified (number-declaration model; operator-side identity check is out of scope). See `docs/design/support-forms/design.md`.

| Function | Description | Auth |
|----------|-------------|------|
| `createSupportTicket(input)` | Validates with `SupportTicketSchema` (outside `try/catch`), then `db.supportTicket.create` selecting `{ id }`. Returns `{ id }`. Throws `"入力内容を確認してください。"` (validation) or `"送信に失敗しました。..."` (DB). | Public (guest-allowed; `userId` only when signed in) |

`SupportTicketSchema` / `SupportTicketCategoryEnum` / `SupportTicketInput` live in `src/lib/schemas.ts`. `superRefine` requires `orderId` only for `RETURN_REQUEST`/`DISPUTE`; empty strings are normalized to `undefined` via `z.preprocess` before the optional uuid check. UI: shared client form `src/components/store/support/support-form.tsx` (RHF + zodResolver, `useRef` double-submit guard, `requireOrderId` toggles the orderId field) rendered by public pages `/contact`, `/returns-exchange` (with `content/returns.ts` policy summary), `/dispute`, `/report-problem` — all stay `○ Static` (no `force-dynamic`; Prisma is only touched in the submit action).

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

### Order tracking presentation boundary (2026-10-01)

The public Server Component passes `trackOrder` as `lookupAction` to TrackOrderForm. Client components import its type only. The branded page includes breadcrumbs and a customer-service link; lookup response and email matching remain unchanged.

### Customer service presentation (2026-10-01)

`/customer-service` is a static Server Component. `SUPPORT_LINKS` remains the source for its five destinations; the branded hub exposes Home breadcrumbs and a named support navigation with numbered cards. No API or data-model change.

### Support form presentation boundary (2026-10-01)

SupportForm receives `submitAction: typeof createSupportTicket` from each Server Component (contact, returns-exchange, dispute, report-problem); Client imports the action type only. Optional `appearance` is `default` or `brand`, with returns-exchange selecting brand. Category determines whether an order ID is required. Action input/output and persistence behavior are unchanged.

### Product support presentation (2026-10-01)

`/product-support` preserves all three PRODUCT_SUPPORT_SECTIONS headings/bodies and placeholder notices. It exposes Home breadcrumbs, a named three-link table of contents targeting support-1 through support-3, and customer-service/contact/returns-exchange/track-order links. Dedicated CSS Module; no API or data-model change.

## Account Order History Display

`/profile/orders` and `/profile/orders/[filter]` share the branded responsive order-history body; the existing filter whitelist and invalid-filter fallback remain. `getUserOrdersForDisplay(filter = "", period = "", search = "", page = 1)` returns `{ orders, totalPages }`: each order has id, createdAt (ISO string), total (number), paymentStatus, orderStatus and groups containing only item counts and image URLs. It delegates to the existing authenticated query and does not change its public contract. Server Components pass the action to the client as `fetchOrdersAction`. No new HTTP endpoint or data model. [Details](../../docs/design/profile-orders/design.md).

## Account Payment History Display

`/profile/payment` is a force-dynamic Server Component with a branded responsive history body and loading state. `getUserPaymentsForDisplay(filter = "", period = "", search = "", page = 1)` returns `{ payments, totalPages }`; each payment contains id, paymentIntentId, paymentMethod, amount (number in dollars), status, orderId and updatedAt (ISO string). It delegates to the existing authenticated query and preserves its contract, method filters and case-insensitive payment/intent-ID search. The client receives `fetchPaymentsAction` via Props; no new HTTP endpoint, schema or provider operation. [Details](../../docs/design/profile-payment/design.md).

### Profile shipping addresses contract

`getProfileShippingAddresses()` returns `{addresses, countries}`. Address fields are id, firstName, lastName, phone, address1, address2, city, state, zip_code, countryId, default plus country `{id,name,code}`; countries use those same three fields. Exclude user/timestamps/private relations. `saveProfileShippingAddress(input)` accepts existing ShippingAddressSchema fields plus optional UUID id and returns address fields without country/user/timestamps. `makeProfileShippingAddressDefault(id)` accepts UUID and returns `{id}`. All authenticate; edit/default reject non-owned IDs before writes. Countries are supported DB records in name order. Errors exposed by UI are generic. Existing upsert accepts optional dates for backward compatibility; the new facade omits them. [UI contract](../../docs/design/profile-addresses/requirements.md).

### Profile review display contract

`getUserReviewsForDisplay(filter = "", period = "", search = "", page = 1)` returns `{reviews, totalPages}`. Review fields: id, rating, review, variant, color, size, quantity, updatedAt (ISO), user `{name,picture}`, images `{id,url,alt}[]`. Exclude private user fields and internal relations/timestamps. Delegate to the existing authenticated user-scoped query: ratings 1–5, four createdAt periods, case-insensitive review-text search, 10 items/page, updatedAt descending. UI Search/Enter replaces delayed search; empty search/full reset work explicitly. No order/product/store search or mutation is added. [Contract](../../docs/design/profile-reviews/requirements.md).
