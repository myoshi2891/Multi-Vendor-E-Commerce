# Architecture

## Stack
- Next.js 16.2.1 (App Router)
- React 19 + TypeScript
- Tailwind CSS + shadcn/ui components
- Prisma ORM + PostgreSQL (Neon)
- Clerk v7 authentication
- Stripe and PayPal payments
- Cloudinary media uploads

## App Routing
- `src/app/(store)`: storefront routes (home, browse, product, cart, checkout)
- `src/app/dashboard`: seller/admin dashboards
- `src/app/(auth)`: sign-in and sign-up
- `src/app/api`: route handlers for search, cookies, and webhooks

## Server Actions and Domain Modules
- `src/queries/*.ts` define server actions with `"use server"`.
- Modules cover product, store, category, order, profile, review, coupon, and
  payment operations.

- Cart Server Component imports the approved query facade and passes synchronization, save and wishlist actions as props to the cart clients; cart clients do not import server actions directly. Storefront react-hot-toast rendering lives in `store/shared/store-toaster.tsx`.

## Data Access
- Prisma client configured in `src/lib/db.ts`.
- PostgreSQL fulltext search (tsvector/tsquery) used in product search with a fallback to `contains`.

## Client State
- Cart state managed by Zustand with localStorage persistence in
  `src/cart-store/useCartStore.ts`.

## Validation
- Zod schemas in `src/lib/schemas.ts` validate form inputs and constraints.

## Request Proxy
- `src/proxy.ts` enforces auth on protected routes and sets a
  `userCountry` cookie for shipping context.

## Account Order History Boundary

The two order-history Server Components share OrdersPage and pass `getUserOrdersForDisplay` from the approved `src/queries/profile.ts` facade as an action prop. The client imports no Server Actions. The facade delegates to the existing owner-scoped `getUserOrders` and projects display fields, converting totals to numbers and dates to ISO strings. OrdersTable keeps the page's filter/search/period state locally, displays initial server results without a mount fetch, and serializes subsequent lookups with a pending lock. See [design](../../docs/design/profile-orders/design.md).

## Account Payment History Boundary

The `/profile/payment` Server Component passes `getUserPaymentsForDisplay` from `src/queries/profile.ts` as an action prop. The facade delegates to the existing owner-scoped payment query and projects only display fields, with dollar amounts as numbers and update dates as ISO strings. PaymentsTable imports no Server Actions, displays the initial result without a mount fetch and serializes lookups with a pending lock. No payment-provider operation is added. [Design](../../docs/design/profile-payment/design.md).

### Profile address server/client boundary

The force-dynamic addresses Server Component supplies initial projected address/country data and load/save/default action props. The dedicated Client body/form never imports actions directly. Profile facades in `src/queries/user.ts` reuse `requireUser`, owner-scoped lookups and the existing atomic address upsert/default transaction. New form saves validate the existing address schema plus optional UUID ID, derive user/new ID on the server and omit timestamps so existing creation dates are preserved. DB models and checkout/shared address components remain unchanged. See [design](../../docs/design/profile-addresses/design.md).

## Account review history boundary

The force-dynamic `/profile/reviews` Server Component loads projected display data and passes getUserReviewsForDisplay as an action prop. The Client container/header import no actions, avoid duplicate mount fetches and serialize lookups. The facade delegates to the existing owner-scoped getUserReviews and sends only displayed review, author and photo fields with ISO updatedAt. A profile-only review card replaces use of the shared product-page ReviewCard here; the shared component and review mutations are unchanged. [Design](../../docs/design/profile-reviews/design.md).

## Account message boundary

The force-dynamic buyer messages Server Component passes initial projected data and four action props (list/thread display facades, send and mark read). Buyer clients import no actions. A profile-only conversation hook/thread provides polling, queued post-send refresh and visible failure/retry states. Shared legacy messaging components and seller UI are unchanged. Facades delegate to existing ownership/participant checks and atomic send/read actions without DB model changes. [Design](../../docs/design/profile-messages/design.md).
