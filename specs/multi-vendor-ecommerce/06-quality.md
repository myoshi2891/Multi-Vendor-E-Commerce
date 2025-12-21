# Quality Attributes

## Security
- Clerk middleware protects `/dashboard`, `/checkout`, and `/profile` routes.
- Server actions validate authentication via `currentUser`.
- Webhook requests are verified with Svix signatures.
- Cookies for country detection are `httpOnly` and `sameSite`.
- Secrets are read from environment variables only.

## Data Integrity
- Prisma relations enforce ownership and cascade deletes where appropriate.
- CartItem and OrderItem store snapshot fields (price, name, image, size).

## Performance
- MySQL fulltext search with a fallback to `contains` queries.
- Pagination in search endpoints limits result size.
- Client-side cart interactions avoid roundtrips.

## Reliability
- Payment details are upserted and linked to orders.
- User records are upserted via webhook to reduce drift.

## Observability
- Errors are logged to the console; no centralized logging is in place yet.
