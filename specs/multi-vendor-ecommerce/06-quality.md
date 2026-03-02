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

## Performance
- PostgreSQL fulltext search (tsvector/tsquery) with a fallback to `contains` queries.
- Pagination in search endpoints limits result size.
- Client-side cart interactions avoid roundtrips.

## Reliability
- Payment details are upserted and linked to orders.
- User records are upserted via webhook to reduce drift.

## Observability
- Errors are logged to the console; no centralized logging is in place yet.
