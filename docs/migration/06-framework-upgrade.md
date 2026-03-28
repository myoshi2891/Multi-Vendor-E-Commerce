# Framework Upgrade Guide

**Migration Date**: 2026-03-28
**Branch**: `feat/nextjs-16-migration`
**Commits**: `2e7d706` (deps upgrade), `fcdb042` (async request APIs)

This document records the breaking changes and applied fixes for the major framework upgrade completed 2026-03-28. All changes were made incrementally across 7 phases plus 3 rounds of code review.

---

## Summary of Upgrades

| Package | From | To |
|---------|------|----|
| Next.js | 14.x | 16.2.1 |
| React | 18.x | 19.x |
| `@clerk/nextjs` | v6 | v7 |
| Swiper | 11.x | 12.x |
| ESLint | 8.x | 9.x |

---

## 1. Next.js 14 → 16.2.1

### Breaking Change: Async Request APIs

In Next.js 16, `params`, `searchParams`, `cookies()`, and `headers()` are all Promises. Synchronous access no longer works.

**Before (Next.js 14)**:
```typescript
// Page component — sync params
export default function Page({ params }: { params: { slug: string } }) {
    const { slug } = params;
    // ...
}

// Server Component — sync cookies
import { cookies } from "next/headers";
const cookieStore = cookies();
```

**After (Next.js 16)**:
```typescript
// Page component — awaited params (Server Component)
export default async function Page({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    // ...
}

// Client Component — use() hook to unwrap params Promise
import { use } from "react";
export default function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    // ...
}

// Server Component — awaited cookies
const cookieStore = await cookies();
```

**Files affected**: All route segment files under `src/app/` that receive `params` or `searchParams` props, plus all Server Components calling `cookies()` / `headers()`.

### Page Param Normalization

When normalizing page params to integers, use `Number.isFinite` to catch `Infinity` and `-Infinity` (which `Number()` accepts without error):

```typescript
const raw = Number(pageParam);
const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
```

**Files**: `src/app/(store)/profile/following/[page]/page.tsx`, `src/app/(store)/profile/wishlist/[page]/page.tsx`

---

## 2. React 18 → 19

### Breaking Change: `useRef` Type

`useRef<T>(null)` now returns `RefObject<T | null>` instead of `RefObject<T>`. This means the inferred type includes `null` in the type parameter itself.

**Impact**: Libraries typed against `RefObject<T>` (without `null`) may produce TypeScript errors when receiving a React 19 ref.

**Fix**: Module augmentation in `src/types/use-onclickoutside.d.ts`:
```typescript
declare module "use-onclickoutside" {
    import { RefObject } from "react";
    type PossibleEvent = MouseEvent | TouchEvent;
    type Handler = (event: PossibleEvent) => void;
    export default function useOnClickOutside(
        ref: RefObject<HTMLElement | null>,
        handler: Handler | null,
        options?: { document?: Document }
    ): void;
}
```

**Files**: `src/types/use-onclickoutside.d.ts` (new), `src/components/store/shared/modal.tsx` (removed double-cast)

### `use()` Hook for Promise Params in Client Components

Client Components cannot use `await` directly. Use the `use()` hook to unwrap Promise params:

```typescript
import { use } from "react";

export default function ClientPage({ params }: { params: Promise<{ page: string }> }) {
    const { page } = use(params);
    // ...
}
```

**Files**: `src/app/(store)/profile/history/[page]/page.tsx`

### useEffect Stale Response Prevention

With React 19 and Strict Mode (disabled in this project), race conditions in `useEffect` must be handled explicitly with a cancellation flag:

```typescript
useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
        const result = await someAsyncCall();
        if (!cancelled) setState(result);  // guard all state updates
    };
    fetch();
    return () => { cancelled = true; };
}, [dep]);
```

**Files**: `src/app/(store)/profile/history/[page]/page.tsx`

---

## 3. Clerk v6 → v7

### Breaking Change: All APIs Are Now Async

**Before (v6)**:
```typescript
import { auth, currentUser } from "@clerk/nextjs/server";

const { userId } = auth();          // sync
const user = currentUser();         // sync
const client = clerkClient;         // direct property access
```

**After (v7)**:
```typescript
import { auth, currentUser } from "@clerk/nextjs/server";

const { userId } = await auth();    // async
const user = await currentUser();   // async
const client = await clerkClient(); // function call, returns Promise
```

### Breaking Change: `authMiddleware` → `clerkMiddleware`

The `authMiddleware` export was removed. Use `clerkMiddleware` with an inline route matcher:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

export default clerkMiddleware(async (auth, req) => {
    const protectedRoutes = createRouteMatcher(["/dashboard/(.*)", "/checkout", "/profile/(.*)"]);
    if (protectedRoutes(req)) await auth.protect();
    // ...
});
```

Note: `auth.protect()` is a direct property call, not `(await auth()).protect()`.

**Files**: `src/middleware.ts`, all `src/queries/*.ts` files using `auth()` / `currentUser()`

---

## 4. Swiper 11 → 12

### Breaking Change: React Component API

The `SwiperRef` type was moved to a named export and the `Swiper` React component API changed slightly.

**Before (Swiper 11)**:
```typescript
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
```

**After (Swiper 12)**:
```typescript
import { Swiper, SwiperSlide, SwiperRef } from "swiper/react";
// SwiperRef is now exported directly from "swiper/react"
```

**Files**: Components using the Swiper carousel (product image galleries, related products).

---

## 5. ESLint 8 → 9

### Breaking Change: Flat Config

ESLint 9 dropped support for `.eslintrc.*` files. The config must be in `eslint.config.mjs` (flat config format).

**Before (`eslint.json` / `.eslintrc.json`)**:
```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "react-hooks/rules-of-hooks": "error"
  }
}
```

**After (`eslint.config.mjs`)**:
```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
    ...compat.extends("next/core-web-vitals", "next/typescript"),
    {
        files: ["**/*.{tsx,jsx}"],  // scope hooks rules to React files only
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
        },
    },
];
```

Key difference: `rules` in flat config objects apply globally unless scoped with `files`. The `react-hooks` plugin rules are scoped to `**/*.{tsx,jsx}` to avoid false positives in non-React files.

**Files**: `eslint.config.mjs` (replaced `.eslintrc.json`)

---

## Code Quality Patterns Established During Review

These patterns were identified and standardized during 3 rounds of code review following the migration:

### 1. Centralized Cookie Parsing

Manual `JSON.parse` + type cast for cookies was error-prone. Centralized to `parseUserCountryCookie()` in `src/lib/utils.ts`, backed by `isCountry()` type guard checking all 4 fields.

**Files affected**: `src/queries/product.ts`, `src/queries/user.ts`, `src/app/(store)/cart/page.tsx`, `src/app/(store)/checkout/page.tsx`, `src/components/store/layout/header/header.tsx`

### 2. Prototype-Safe Filter Validation

Replaced `in` operator with `Object.hasOwn` for validating URL params against known value maps to prevent prototype pollution.

```typescript
// Before (vulnerable to "__proto__" injection)
if (rawFilter in validFilters) { ... }

// After
const validFilterMap: Record<string, OrderTableFilter> = { ... };
if (Object.hasOwn(validFilterMap, rawFilter)) { ... }
```

**Files**: `src/app/(store)/profile/orders/[filter]/page.tsx`

### 3. Structured Error Logging

All `catch` blocks in `src/queries/` log both `error.message` and `error.stack`, with an `else` branch for non-`Error` objects:

```typescript
catch (error: unknown) {
    if (error instanceof Error) {
        console.error("[Module:function] context:", error.message, error.stack);
    } else {
        console.error("[Module:function] context:", error);
    }
}
```

### 4. localStorage Validation

`JSON.parse` of localStorage values must validate the result before use:

```typescript
const parsed: unknown = JSON.parse(stored);
const ids = Array.isArray(parsed) && parsed.every((x): x is string => typeof x === "string")
    ? parsed
    : [];
```

---

## Related

- Upgrade commits: `2e7d706`, `fcdb042`
- DB migration history: `docs/migration/00-05-*.md`
- Architecture decisions: `docs/architecture/decisions/`
- Progress log: `PROGRESS.md` (2026-03-28 entry)
