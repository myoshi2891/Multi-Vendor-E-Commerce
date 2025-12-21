# Project Constitution (Template)

> This document is updated by team agreement and kept current.

## Quality Bar
- No P0/P1 bugs open for release; P2 allowed with a documented plan.
- Critical flows (browse -> cart -> checkout -> payment) have E2E smoke coverage.
- New server actions and validations include unit tests or a written waiver.
- UI changes must be checked on mobile and desktop breakpoints.

## Non-Functional Requirements
- Availability: degrade gracefully when external providers fail (Clerk, Stripe/PayPal, Cloudinary).
- Performance: avoid N+1 queries; keep search and product listing paginated.
- Scalability: avoid global mutable state; keep DB access behind Prisma.
- Localization: current UI assumes USD and English; changes must not block future i18n.

## Security
- Enforce auth and role checks in server actions and protected routes.
- Validate all input (Zod) and sanitize any rich text.
- Secrets are stored in env vars only; never log or commit them.
- Webhooks must be verified (Svix).

## Review Checklist
- Requirements and acceptance criteria updated.
- Tests added/updated and runnable locally.
- Prisma schema changes include migrations and seed updates.
- API or env var changes documented; no secret files committed.
- Rollout or rollback plan noted for risky changes.

## Scope and Boundaries
- In scope: multi-vendor marketplace, storefront, seller/admin dashboards, payments, search.
- Out of scope: multi-currency, tax engine, advanced analytics, third-party shipping carriers.
