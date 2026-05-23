# Engineering Standards

These standards align with the current repo tooling and architecture.

## Code Style
- TypeScript strict mode is required (`tsconfig.json` has `strict: true`); avoid `any`.
- ESLint is the source of truth (`eslint-config-next`); run `bun run lint` before PR.
- Prettier is the formatter (`prettier.config.js`); format changed files with
  `bunx prettier --write` (or equivalent).
- Use the `@/` path alias for internal imports (`tsconfig.json` paths).
- Prefer small, focused modules; keep UI components presentational where possible.

## Testing
- Unit tests for server actions and utilities (see `src/queries/*.test.ts`).
- Component tests for UI behavior with React Testing Library (jsdom).
- Integration tests for Prisma/PostgreSQL changes with reset + seed.
- E2E smoke tests for critical flows using Playwright.
- New behavior must be covered by at least one relevant test; bug fixes include
  a regression test or a written waiver in the PR.

## Error Handling and Logging
- Wrap external calls (Prisma, Clerk, Stripe/PayPal) in `try/catch`.
- Log with `console.error`/`console.warn` at the boundary; never log secrets or PII.
- Surface user-safe error messages; keep error strings consistent
  (for example: "Unauthenticated.").

## Design and Architecture
- `src/app` for routes/layouts, `src/components` for UI, `src/queries` for server
  actions, `src/lib` for shared utilities, `prisma/` for schema.
- Server actions must not import UI components; UI should call server actions via
  `src/queries`.
- Validate input with Zod schemas in `src/lib/schemas.ts`.
- Keep DB access centralized via `src/lib/db.ts`.

## Security
- Require `currentUser()` and role checks for protected actions.
- Protect routes with `clerkMiddleware` and `createRouteMatcher`.
- Secrets live only in environment variables; never commit or log `.env` contents.
- Verify webhooks (Svix) and validate all user input.

## CI / Supply Chain
- Third-party GitHub Actions in `.github/workflows/` MUST be pinned to a full
  commit SHA (40 hex chars), never a mutable tag like `@v1` or `@main`.
- Each SHA pin MUST be followed by a trailing comment naming the released
  version (e.g. `uses: owner/action@<sha> # v2.2.0`). Rationale: SHAs are
  unreadable, and the tag comment lets reviewers verify the pin matches a
  known release and lets Dependabot present readable bump diffs.
- Container service images (e.g. `services.postgres.image`) MUST be pinned to
  a digest (`image: postgres@sha256:<digest>`) with a `# <tag>` comment.
- When a pinned SHA cannot be resolved by Actions ("unable to find version"),
  re-fetch the release SHA via `gh api repos/<owner>/<repo>/git/refs/tags/<tag>`
  and replace; do NOT downgrade the pin to a floating tag.
