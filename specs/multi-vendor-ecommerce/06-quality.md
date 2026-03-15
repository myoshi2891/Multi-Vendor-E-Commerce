# Quality Attributes

## Security
- Clerk middleware protects `/dashboard`, `/checkout`, and `/profile` routes.
- Server actions validate authentication via `currentUser`.
- Webhook requests are verified with Svix signatures; handlers use the
  SDK-verified `evt.data` object instead of re-parsing the raw body.
- Cookies for country detection are `httpOnly` and `sameSite`.
- Secrets are read from environment variables only.
- IDOR prevention: mutations that touch user-owned resources (reviews, stores,
  orders) verify ownership before writing. Review operations use conditional
  `update`/`create` instead of `upsert` to prevent client-supplied IDs from
  overwriting other users' records.

## Data Integrity
- Prisma relations enforce ownership and cascade deletes where appropriate.
- CartItem and OrderItem store snapshot fields (price, name, image, size).
- Server actions validate resource ownership before mutation to prevent
  cross-user data corruption via client-supplied identifiers.
- Store status updates (`updateStoreStatus`) use Prisma interactive
  transactions (`db.$transaction`) to atomically update store status and
  promote user role on PENDING → ACTIVE transition.
- Order placement (`placeOrder`) wraps all DB writes (order, order groups,
  order items, total update) in a single `db.$transaction` for atomicity.
  Read-only queries (delivery details) are pre-fetched before the
  transaction to minimize lock duration.
- All money fields use `Decimal(12,2)` for exact arithmetic. Internal
  calculations use `Prisma.Decimal` methods; conversion to `number` happens
  only at presentation boundaries.

## Performance
- PostgreSQL fulltext search (tsvector/tsquery) with a fallback to `contains` queries.
- Pagination in search endpoints limits result size.
- Client-side cart interactions avoid roundtrips.

## Reliability
- Payment details are upserted and linked to orders.
- User records are upserted via webhook using immutable Clerk user ID as
  lookup key, ensuring correct matching even after email changes.
- User deletion via webhook uses `deleteMany` for idempotent retry handling
  (avoids Prisma P2025 on re-delivery).
- External service calls (Prisma, Clerk API) in webhook and store handlers
  are wrapped in try/catch with appropriate HTTP status codes or error
  re-throwing.

## Observability
- Errors are logged to the console; no centralized logging is in place yet.
- Catch blocks use `error: unknown` (never `any`) with `instanceof Error`
  type guards for structured logging (`console.error` with context prefix,
  message, and stack).
