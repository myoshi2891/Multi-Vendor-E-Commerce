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

## Data Access
- Prisma client configured in `src/lib/db.ts`.
- PostgreSQL fulltext search (tsvector/tsquery) used in product search with a fallback to `contains`.

## Client State
- Cart state managed by Zustand with localStorage persistence in
  `src/cart-store/useCartStore.ts`.

## Validation
- Zod schemas in `src/lib/schemas.ts` validate form inputs and constraints.

## Middleware
- `src/middleware.ts` enforces auth on protected routes and sets a
  `userCountry` cookie for shipping context.
