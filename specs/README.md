# Spec Directory (KiloCode + SpecKit)

This folder stores spec-driven documentation derived from the current codebase.
Each spec lives under `specs/<spec-name>/` and uses numbered files to keep a
stable order for review and change tracking.

Current spec: `specs/multi-vendor-ecommerce`

Files:
- `00-overview.md`
- `01-requirements.md`
- `02-architecture.md`
- `03-data-model.md`
- `04-interfaces.md`
- `05-workflows.md`
- `06-quality.md`
- `07-testing.md`
- `08-open-questions.md`

Update workflow:
1) Edit the relevant file(s) when behavior changes.
2) Keep file names stable; append new sections instead of renaming.
3) Link to source files when helpful.

Implementation anchors (non-exhaustive):
- `prisma/schema.prisma`
- `src/app`
- `src/queries`
- `src/cart-store/useCartStore.ts`
- `src/lib/schemas.ts`
- `TESTING_DESIGN.md`
