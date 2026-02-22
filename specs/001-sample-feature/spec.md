# Spec: 001 Sample Feature (Example)

## Background / Purpose
Example: Add search autocomplete on the browse page using the existing
`POST /api/index-products` endpoint to speed up product discovery.

## User Stories
- Example: As a customer, I want suggestions as I type so I can reach products faster.
- Example: As a customer, I want images in suggestions to confirm the right item.

## Requirements
- Example: Use `POST /api/index-products` to fetch suggestions.
- Example: Debounce input by ~300ms and skip requests for queries under 2 chars.
- Example: Show up to 10 suggestions with name and thumbnail.
- Example: Clicking a suggestion navigates to `/product/[productSlug]/[variantSlug]`.
- Example: If the API returns no results, show an empty state without errors.

## Non-Requirements
- Example: No changes to search ranking or database schema.
- Example: No analytics or tracking changes.

## Constraints
- Example: Must not block initial page render; load suggestions client-side.
- Example: Use existing Tailwind/shadcn styles and components where possible.

## Acceptance Criteria
- Example: Given a 2+ character query, when typing, then suggestions appear within 500ms.
- Example: Given an empty query, suggestions are hidden and no request is sent.
- Example: Given a suggestion click, the user lands on the variant detail page.

## Risks / Open Questions
- Example: Search endpoint latency could slow suggestions; consider caching or throttling.
