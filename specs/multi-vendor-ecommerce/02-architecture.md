# Architecture

## Stack
- Next.js 14 (App Router)
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui components
- Prisma ORM + MySQL
- Clerk authentication
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

## Data Access
- Prisma client configured in `src/lib/db.ts`.
- MySQL fulltext search used in product search with a fallback to `contains`.

## Client State
- Cart state managed by Zustand with localStorage persistence in
  `src/cart-store/useCartStore.ts`.

## Validation
- Zod schemas in `src/lib/schemas.ts` validate form inputs and constraints.

## Middleware
- `src/middleware.ts` enforces auth on protected routes and sets a
  `userCountry` cookie for shipping context.
