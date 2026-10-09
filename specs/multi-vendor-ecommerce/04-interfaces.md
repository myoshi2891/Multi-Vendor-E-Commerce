# Interfaces

## UI Routes (App Router)
Storefront:
- `/compare` public comparison page; Server Component passes the existing `getProductsByIds` action as `fetchProductsAction` to the client grid. Keeps the `compare-store` localStorage key and four-variant limit. No new API or action signature. See the compare flow for empty/loading/error/retry/unavailable states.
- `/` dynamic storefront landing page (`force-dynamic`). Streams `BrandExperience` and `Selection` through separate Suspense boundaries; `getBrandCategories` supplies up to three live category slugs, and the selection uses `getProducts` for up to eight displayable products. The experience's WebGL scene is decorative and client-only; navigation and shopping links remain in HTML. See `05-workflows.md` for display and failure states.
- `/browse` browse and search; reads `search`, `category`, legacy `subCategory`, `offer`, repeatable `size` / `color`, `minPrice`, `maxPrice`, `sort`, and 1-based `page` query parameters. `page` is normalized per the tech.md URL-parameter rule and passed to `getProducts(filters, sort, page)`; out-of-range pages redirect to the last available page (or page 1 for zero results). Resolvable legacy `subCategory` redirects (308) to `category` only when it is nested under the supplied category or no category is supplied; conflicting or unresolvable category filters retain fail-closed results. The pager renders only when `totalPages > 1`, via `src/components/store/browse-page/browse-pagination.tsx`, preserving other query parameters and replacing only `page`. Attribute facets use repeatable `attr.<key>=<value>` parameters (values OR within a key, AND across keys; ENUM values are `AttributeOption.value`; unknown or non-facetable keys return zero results). `getProducts(filters: ProductFilters, sort, page, pageSize)` (plans 073/075/076) filters, sorts and pages in one parameterized SQL query and hydrates the page by id; every sort ends with an `id` tie-breaker. `search` matches the weighted `Product.searchVector` (name > brand > variant name/description/keywords > description) with all words ANDed and the last word as a prefix (`buildPrefixTsQuery`); with no explicit `sort` it orders by relevance. `price-low-to-high` / `price-high-to-low` order by the denormalized `Product.minPrice` (lowest discounted price, products without sizes last). Runtime input is validated by `parseProductFilters` (an array in a single-valued filter returns zero results). The page also calls `getProductFacets(filters)` in parallel; it returns facets only when a category is selected, counts each selected key without its own selection (disjunctive), keeps selected-but-absent values with count 0, and degrades to no facets on failure. Facets render in `filters/attribute/attribute-facet-filter.tsx`.
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
- `/profile/notifications` in-app notifications (force-dynamic; newest first, `?cursor=<notification id>` for older pages; mark one / mark all as read) — plan 086
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
- `POST /api/setUserCountryInCookies` set user country cookie. Rate-limited per `x-real-ip` (in-memory, per instance; default 5/min, `RATE_LIMIT_COOKIE_PER_MIN`) → `429` + `Retry-After`; no limit when the header is absent ([ADR-009](../../docs/architecture/decisions/009-public-endpoint-rate-limiting.md)). The search routes are rate-limited by the Vercel WAF, not in the app.
- `GET /api/index-products` paginated search results
- `POST /api/index-products` search suggestions for autocomplete
- `GET /api/search-products?q=` header search suggestions (plan 073): up to 8 `SearchResult` items (`id`, `name`, `link` = `/product/<productSlug>/<first displayable variant slug>`, `image` = that variant's `variantImage` (primary), or the URL of its oldest related `ProductVariantImage` with a non-empty `url` when `variantImage` is empty) ordered by `ts_rank` on `searchVector` then `id`; products without a displayable variant (non-empty `variantImage` or a related image with a non-empty `url`) are excluded inside the SQL (before `LIMIT`). `search` is accepted as a legacy alias. Input without letters or digits returns `[]`.
- `GET /api/cron/notifications` notification sweeper (plan 086): requires `Authorization: Bearer ${CRON_SECRET}` (constant-time compare; `401` otherwise, `503` when `CRON_SECRET` is unset). Dispatches up to 50 pending / lease-expired email deliveries and deletes read notifications older than 180 days; returns `{ dispatch, purged }`. Scheduling is configured on the deployment platform, not in the repo.
- `POST /api/webhooks` Clerk webhook (user sync); uses Svix SDK-verified
  `evt.data` for payload extraction. User upsert uses immutable Clerk user
  ID as lookup key (not email). Deletion uses `deleteMany` for idempotent
  retry handling.

## Server Actions (Queries)
- Domain modules live in `src/queries/*.ts`.
- Notable modules: category, subCategory, offer-tag, product, store, order,
  home, profile, review, coupon, stripe, PayPal, user, size, dashboard, inventory,
  store-dashboard, message, support, attribute, notification.
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

Sender role is derived (`message.senderId === conversation.userId` ⇒ buyer-sent), not stored. `SendMessageSchema` / `StartConversationSchema` live in `src/lib/schemas.ts`; `ConversationWithLatest` / `MessageType` / `StoreConversationWithLatest` are derived via `Prisma.PromiseReturnType` in `src/lib/types.ts`. Buyer UI (Phase 3, implemented): `/profile/messages` (`force-dynamic`) + `src/components/store/profile/messages/{messages-container,profile-conversation-thread}.tsx` + `use-profile-conversation.ts`, receiving four action props (`loadConversationsAction` / `loadMessagesAction` / `sendMessageAction` / `markReadAction`) through the display facades (5s polling with `cancelled` flag + `document.hidden` pause). Seller UI (Phase 4, implemented): `/dashboard/seller/stores/[storeUrl]/messages` (`force-dynamic`) + `src/components/dashboard/seller/seller-messages-container.tsx` reusing `conversation-thread.tsx`; the list is identified by the buyer `user`. Round-trip E2E (Phase 5) is planned.

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

### notification module (`src/queries/notification.ts`) — in-app notifications (plan 086)

Reads and marks the signed-in user's `Notification` rows. Every function calls `requireUser()` **outside** `try/catch` and scopes `where` by `userId: user.id` (IDOR: another user's id matches 0 rows). DB failures become `"Failed to load notifications."` / `"Failed to update notifications."` with a structured log.

| Function | Description | Auth |
|----------|-------------|------|
| `getMyNotifications({ cursor?, limit? })` | Newest first (`createdAt desc, id desc`), `limit` clamped to 1–50 (default 20) via `normalizePositiveIntParam`; reads `limit + 1` to return `nextCursor`. Rows are rendered through `NOTIFICATION_TEMPLATES`; unknown `type` rows are skipped. `createdAt` is an ISO string. | `requireUser` |
| `getUnreadNotificationCount()` | `count` of `isRead: false` (header badge). | `requireUser` |
| `markNotificationRead(id)` | `updateMany({ id, userId, isRead: false })`; blank id throws `"Invalid notification id."` before DB. Idempotent. | `requireUser` |
| `markAllNotificationsRead()` | `updateMany({ userId, isRead: false })`. | `requireUser` |

Writing and sending live in `src/lib/notifications/` (design: [`notification-foundation/design.md`](../../docs/design/notification-foundation/design.md)): `recordNotifications(tx, events)` writes `Notification` + `NotificationDelivery(PENDING)` with `createManyAndReturn({ skipDuplicates: true })` **inside the caller's transaction** (a write failure rolls back the state change), `scheduleDispatch(ids)` sends after commit via `after()`, and `dispatchPendingDeliveries()` claims rows with a lease, sends through `EmailProvider` (`EMAIL_PROVIDER`; stub by default) with idempotency key `${dedupeKey}:email`, and stops retrying 23h after the first attempt. Wired today: `updateOrderGroupStatus` / `updateOrderGroupStatusAsAdmin` → `order.group.shipped` / `order.group.delivered` for the customer.

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
- `EMAIL_PROVIDER` (notifications; unset/`stub` = no real send)
- `CRON_SECRET` (`/api/cron/notifications` bearer token)

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

### Profile message display contract

`getProfileConversations()` returns own conversations with id, userId (buyer/sender comparison), updatedAt ISO, store `{name,logo}` and latest messages `{content}[]`; exclude order/store/internal relation data. `getProfileConversationMessages(id)` returns chronological `{id,senderId,content,createdAt ISO}[]` after existing participant validation. The Server Component injects these with existing `sendMessage(id, content)` and `markConversationRead(id)` through Props. Existing schemas, authorization and transaction contracts remain. [UI contract](../../docs/design/profile-messages/requirements.md).

### Priority P2 display interfaces

Public URLs `/offers`, `/dispute`, `/report-problem` and authenticated `/profile/following/[page]`, `/profile/history/[page]` are unchanged. Aliases redirect to page 1. Following supplies `followAction(storeId): Promise<boolean>` from the existing facade. History supplies `fetchHistoryAction(ids, page): Promise<{ products: ProductType[]; totalPages: number }>` from getProductsByIds, retaining its default page size and ordering. URL links are the page-navigation source of truth; no new HTTP endpoint or server action is added. SupportForm keeps its existing submitAction/category contract and opts into appearance="brand" for DISPUTE and PROBLEM_REPORT.

## 優先7画面のUI内部action Props（2026-10-05）

申請のapplySellerAction、ProductDetailsのupsertProductAction/getAttributeDefinitionsAction、商品一覧のdeleteProductActionをServer Componentから注入する。既存queryの引数・戻り値・認可を維持し、Clientはruntime Server Action importを持たない。StoreProductRow/serializeStoreProductsは商品一覧の表示項目だけを投影し、サイズ価格はドル単位のnumberとする。公開API/DB schema変更なし。[表示要件](../../docs/design/seller-ui-migration/requirements.md)。

在庫UIはupdateSizeStock/updateStoreLowStockThresholdをupdateStockAction/updateThresholdActionとしてProps注入する。引数と結果・サーバー検証は既存と同一。失敗した入力値の再送は明示的な再試行操作のみ。

注文一覧はSellerOrderActions（updateGroupAction/updateItemAction）を注入。既存updateOrderGroupStatus/updateOrderItemStatusの引数・結果・認可/遷移検証を維持。serializeSellerOrdersは配送日範囲と顧客/住所/支払表示、明細の価格/送料/合計を投影し、Decimalをドル単位numberへ変換する。内部のcoupon/注文relationはClientに渡さない。

getSellerConversations(storeUrl)は既存getStoreConversationsの店舗所有権検証を委譲し、id/userId/updatedAt ISO/store(name,logo)/user(name,picture)/messages(content)/unreadLatestを返す。unreadLatestは最新1件が購入者発かつ未読のときtrueで、未読総件数ではない。取得/送信/既読は既存getProfileConversationMessages/sendMessage/markConversationReadをProps注入し参加者検証を維持。Clientでruntime query importしない。

## Seller six-screen form boundaries

ProductDetails keeps its existing ProductFormActions and opts into seller design from the product creation Server Component. No public HTTP API, action signature or data schema changes. See [seller UI design](../../docs/design/seller-ui-migration/design.md).

The variant creation/edit Server Components also opt into seller ProductDetails and preserve getProductMainInfo/getProductVariantForEdit arguments, initial values and missing-record behavior. Seller feedback is inline status/alert; the existing action contract is unchanged.

ShippingCountryRow and StoreDefaultShippingInput are plain numeric display data projected in the Server Component without money-unit changes. Existing shipping query actions are injected as updateDefaultsAction/upsertShippingRateAction; createShippingColumns receives them on the Client. Optional CustomModal locked and DialogContent closeDisabled default to false.

StoreDetails accepts required upsertStoreAction and optional seller design. StoreDetailsData projects only store form fields; the settings Server Component selects that projection, preserving the existing URL lookup and redirect. Both settings and creation callers provide the existing approved-facade action.

upsertStore retains its existing contract: absent id selects creation and present id selects owner-checked update. The UI no longer supplies a generated id for new-store submissions. API/query/schema/authorization are unchanged.


Seller presentation adapters additionally accept `Table.scrollLabel` for an opt-in named, keyboard-focusable scroll region and `ImagesPreviewGrid.design="seller"` for named image/removal actions. Default consumers preserve existing markup behavior. `ShippingFields` shares form controls while each caller retains its schema and field names. Store settings replace the route with the returned settings URL after a URL change; an unchanged URL refreshes the current route.

## P3優先6画面のデザイン移行（2026-10-05）

AdminOrders/AdminStores/SellerCoupons/SellerCouponFormは型付きAction Propsを受け取る。既存queriesの署名・認可を維持し、Server Componentから既存Actionへのadapterを渡す。admin-orders/admin-storesの表示用serializerはDecimalを文字列／数値へ投影し、User内部情報をClientへ渡さない。クーポン共有入力のseller opt-inは既存管理者フォームの既定動作を維持する。

詳細は[計画](../../plans/layout-design/priority-six-p3-design-system-plan.md)と[検証正本](../../docs/testing/QA_HANDOFF.md#ds-p3-six-browser)を参照。

## P4管理マスタ6画面のデザイン移行（2026-10-06）

新しい管理者表示部品はCategoryActions/AdminCouponActions/OfferTagActionsのloadAction・saveAction・deleteActionをPropsで受け取る（couponのみtoggleActionも）。既存queriesの引数と返却型、公開API・Zod schemaは変更しない。CouponFormFieldsのdesignにadmin opt-inを追加し、既定SDKとseller表示は維持する。

[証跡と受け入れ保留](../../docs/design/design-system/PROGRESS.md#p4優先6画面移行記録)。

AdminCouponRowはCoupon & { store: { name: string } | null }。一覧Server Componentがこの表示契約へ投影し、StoreのDecimalフィールドを除く。queryの取得・認可・返却契約は維持する。

## Store header presentation

The existing search-products GET and setUserCountryInCookies POST shapes remain unchanged. CountrySelector adds an optional `variant` of `default` or `store`; callers retain controlled open/onToggle/onChange/selectedValue/disabled behavior. HeaderFrame receives `userCountry` and `accountMenu` presentation nodes; AccountMenu receives only avatar URL and name from the server. See [plan](../../plans/layout-design/priority-six-purchase-design-system-plan.md).

Product-review Pagination accepts optional `variant: "default" | "editorial"`. Editorial renders named Review pages navigation with scoped brand styling; page/totalPages/setPage contracts and default callers remain unchanged.

## 購入導線6画面のデザイン残存部品（2026-10-08）

[横断受け入れ仕様](../../docs/design/purchase-residual/requirements.md)を適用。browse/store/product/cart/checkout/orderのrootとPortalにスコープ付きpurchase themeを合成。共有住所フォームは既定配色fallbackを保持し、注文・支払い・商品状態タグは任意`variant="store"`のみ意味色を適用する。API・DB・認可・金額・在庫・決済遷移契約は変更なし。overview/data-modelの更新は不要。

TDDのRed/Green/Refactorと各画面の証跡は[進捗](../../docs/design/design-system/PROGRESS.md#購入導線残存部品6画面移行記録)。全体Jest3075/3078（3 skipped）・317スイート（316 passed/1 skipped）、127 snapshots。購入補助ブラウザー68/68（purchase44、commerce24）とaxe AAを確認。専用DB/Clerk/外部SDKを伴う受け入れは保留。
