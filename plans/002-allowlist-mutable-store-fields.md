# Plan 002: Allowlist seller-editable Store fields (stop client control of `status` / `featured` / ratings)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/queries/store.ts src/queries/store.test.ts prisma/schema.prisma`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

`upsertStore` and `applySeller` spread the whole client-supplied `store` object into `db.store.update` / `db.store.create`. That includes privileged columns a seller must never set themselves: `status` (PENDING/ACTIVE/BANNED/DISABLED — the moderation state), `featured` (homepage promotion), and `averageRating` / `numReviews` (computed reputation). A seller can therefore re-activate a store an admin BANNED (moderation bypass), promote their own store to `featured: true`, or fake their rating — all via a normal store-edit request. This plan restricts both write paths to an explicit allowlist of seller-editable fields so privileged columns can only be changed by the admin-only actions that already exist.

## Current state

- `src/queries/store.ts` — seller store CRUD. Two vulnerable write paths:
  - `upsertStore(store: Partial<Store>)` (starts line 20)
  - `applySeller(store: StoreType)` (starts line 416)
- Admin-only status control already exists elsewhere (the moderation path); sellers must not duplicate it.

Vulnerable update path, `src/queries/store.ts:89-95`:

```ts
// id と userId を除外して更新
const { id, userId, ...storeDataToUpdate } = store;

storeDetails = await db.store.update({
    where: { id: String(id) },
    data: storeDataToUpdate,   // ← status/featured/averageRating/numReviews all pass through
});
```

Vulnerable create path, `src/queries/store.ts:125-143`:

```ts
const { userId, ...storeWithoutUserId } = store;
const createData = {
    ...storeWithoutUserId,
    name: store.name!,
    email: store.email!,
    url: store.url!,
    description: store.description || "",
    phone: store.phone || "",
    logo: store.logo || "",
    cover: store.cover || "",
    featured: store.featured ?? false,     // ← honors client value
    status: store.status ?? "PENDING",     // ← honors client value
    defaultShippingService: store.defaultShippingService || "International Delivery",
    returnPolicy: store.returnPolicy || "Return in 30 days.",
    userId: user.id,
};
storeDetails = await db.store.create({ data: createData });
```

Vulnerable applicant path, `src/queries/store.ts:458-467`:

```ts
const storeDetails = await db.store.create({
    data: {
        ...store,                          // ← spreads client status/featured
        defaultShippingService: store.defaultShippingService || "International Delivery",
        returnPolicy: store.returnPolicy || "Return in 30 days.",
        userId: user.id,
    },
});
```

### Privileged fields (from `prisma/schema.prisma`, `model Store`)

These have server-controlled defaults and MUST NOT be settable by a seller:

```
status        StoreStatus @default(PENDING)
averageRating Float       @default(0)
numReviews    Int         @default(0)
featured      Boolean     @default(false)
```

### Seller-editable fields (safe to accept from the client)

`name, description, email, phone, url, logo, cover, returnPolicy, defaultShippingService, defaultShippingFeePerItem, defaultShippingFeeForAdditionalItem, defaultShippingFeePerKg, defaultShippingFeeFixed, defaultDeliveryTimeMin, defaultDeliveryTimeMax, lowStockThreshold`. (Confirm against the live `model Store` during the drift check; use the schema as the source of truth.)

### Repo conventions

- `upsertStore` uses the older inline `currentUser()` + role check (pre-existing). **Do not** migrate it to auth-guards here — out of scope.
- On **update**, an owner check already runs earlier (`existingStore` lookup by `id` + `userId`, line ~38). Keep it.
- The fix is purely "build the write payload from an allowlist" — do not change validation, duplicate-checking, or error messages.

## Commands you will need

| Purpose   | Command                                     | Expected            |
|-----------|---------------------------------------------|---------------------|
| Typecheck | `bunx tsc --noEmit`                         | exit 0              |
| Unit test | `bun run test -- src/queries/store.test.ts` | all pass            |
| Lint      | `bun run lint`                              | exit 0 (warns ok)   |

## Scope

**In scope**:
- `src/queries/store.ts` — `upsertStore` (update + create branches) and `applySeller`
- `src/queries/store.test.ts` — add mass-assignment regression tests

**Out of scope**:
- The admin store-status mutation action (the legitimate `status`/`featured` writer) — do not touch.
- `src/lib/schemas.ts` `StoreFormSchema` — the Zod form schema already omits `status`/`featured` for the form; changing it is not required and risks form breakage.
- The inline auth block in `upsertStore`.

## Git workflow

- Branch: `advisor/002-allowlist-store-fields`
- Commit style: `fix(store): allowlist seller-editable fields (mass assignment)`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a single allowlist helper at the top of `store.ts`

Define a module-level constant listing seller-editable keys and a small picker, so both write paths share one source of truth:

```ts
// Seller が編集可能な Store フィールドのみを許可する allowlist。
// status / featured / averageRating / numReviews は特権フィールドのため
// クライアント入力から読まない（モデレーション/featured/評価の改ざん防止）。
const SELLER_EDITABLE_STORE_FIELDS = [
    "name", "description", "email", "phone", "url", "logo", "cover",
    "returnPolicy", "defaultShippingService",
    "defaultShippingFeePerItem", "defaultShippingFeeForAdditionalItem",
    "defaultShippingFeePerKg", "defaultShippingFeeFixed",
    "defaultDeliveryTimeMin", "defaultDeliveryTimeMax", "lowStockThreshold",
] as const;

type SellerEditableStoreFields = Pick<
    Store,
    (typeof SELLER_EDITABLE_STORE_FIELDS)[number]
>;

function pickSellerEditableStoreFields<T extends object>(
    store: T
): Partial<SellerEditableStoreFields> {
    const out: Partial<SellerEditableStoreFields> = {};
    for (const key of SELLER_EDITABLE_STORE_FIELDS) {
        const value = Reflect.get(store, key) as
            | SellerEditableStoreFields[typeof key]
            | undefined;
        if (value !== undefined) {
            Object.assign(out, { [key]: value });
        }
    }
    return out;
}
```

(Return `Partial<Pick<Store, ...>>` — **not** `Record<string, unknown>` — so the result stays
assignable to Prisma's `StoreUpdateInput`/`StoreCreateInput` under strict TypeScript. Use `Reflect.get`
with the typed key list rather than `key in store`; the repo bans `any`. This is the shape actually
shipped in `src/queries/store.ts`.)

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Rewrite the `upsertStore` update branch to use the allowlist

Replace the `const { id, userId, ...storeDataToUpdate } = store;` + `db.store.update({ data: storeDataToUpdate })` (lines ~89-95) with:

```ts
storeDetails = await db.store.update({
    where: { id: String(store.id) },
    data: pickSellerEditableStoreFields(store),
});
```

`status`/`featured`/`averageRating`/`numReviews` are now never in the update payload.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: Rewrite the `upsertStore` create branch to force safe defaults

Replace the `createData` object (lines ~127-142) so privileged fields are server-set, not client-set:

```ts
const createData = {
    ...pickSellerEditableStoreFields(store),
    name: store.name!,
    email: store.email!,
    url: store.url!,
    description: store.description || "",
    phone: store.phone || "",
    logo: store.logo || "",
    cover: store.cover || "",
    featured: false,          // 特権: 常にサーバー既定
    status: "PENDING",        // 特権: 常にサーバー既定（admin のみ変更可）
    defaultShippingService: store.defaultShippingService || "International Delivery",
    returnPolicy: store.returnPolicy || "Return in 30 days.",
    userId: user.id,
};
```

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 4: Rewrite the `applySeller` create to strip client privileged fields

Replace the `data: { ...store, ... }` spread (lines ~459-465) with:

```ts
data: {
    ...pickSellerEditableStoreFields(store),
    name: store.name!,
    email: store.email!,
    url: store.url!,
    featured: false,
    status: "PENDING",   // 申請は必ず PENDING（admin レビュー必須）
    defaultShippingService: store.defaultShippingService || "International Delivery",
    returnPolicy: store.returnPolicy || "Return in 30 days.",
    userId: user.id,
},
```

If `applySeller`'s `StoreType` makes some required columns non-optional such that TypeScript complains about missing fields, add them from `store.<field>!` following the same pattern — but never add `status`/`featured` from the client. If a **required** column has no server default and isn't in the allowlist, STOP and report (it needs a product decision).

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 5: Add mass-assignment regression tests

In `src/queries/store.test.ts`, add tests (model them after the existing `upsertStore` tests and the IDOR-style assertions in that file):

1. `upsertStore` **update**: call with a `store` object that includes `status: "ACTIVE"` and `featured: true`; assert `db.store.update` was called with `data` that does **not** contain `status` or `featured`:
   ```ts
   const call = mockDb.store.update.mock.calls[0][0];
   expect(call.data).not.toHaveProperty("status");
   expect(call.data).not.toHaveProperty("featured");
   ```
2. `upsertStore` **create**: call with `status: "ACTIVE"`, `featured: true`; assert `db.store.create` `data.status === "PENDING"` and `data.featured === false`.
3. `applySeller`: same assertion — applicant create forces `status: "PENDING"`, `featured: false` regardless of input.

**Verify**: `bun run test -- src/queries/store.test.ts` → all pass, new tests included.

### Step 6: Full typecheck + lint

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run lint` → exit 0.

## Test plan

- New tests in `src/queries/store.test.ts` covering: update drops `status`/`featured`; create forces `PENDING`/`false`; `applySeller` forces `PENDING`/`false`. Include one happy-path assertion that legitimate fields (e.g. `name`, `returnPolicy`) still persist.
- Structural pattern: existing `upsertStore` describe block in the same test file.
- Verification: `bun run test -- src/queries/store.test.ts` → all pass.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test -- src/queries/store.test.ts` exits 0; new mass-assignment tests pass
- [ ] `grep -n "status: store.status" src/queries/store.ts` returns no match
- [ ] `grep -n "featured: store.featured" src/queries/store.ts` returns no match
- [ ] `grep -n "\.\.\.store\b" src/queries/store.ts` shows no remaining raw client spread into a `db.store.create`/`update` data payload
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report if:

- The `store.ts` write paths don't match the "Current state" excerpts (drift).
- A required non-defaulted Store column exists that is neither in the allowlist nor safely server-set (needs a product decision on its source).
- Tests fail twice after reasonable fixes.
- You find another server action (outside `store.ts`) that also spreads client store data into a create/update — note it but do not fix it here (report for a follow-up plan).

## Maintenance notes

- If a new seller-editable Store column is added to `prisma/schema.prisma`, add it to `SELLER_EDITABLE_STORE_FIELDS` — otherwise seller edits to it silently no-op.
- If a new **privileged** column is added, ensure it is NOT in the allowlist and is server-set on create.
- Reviewer should confirm no `...store` spread reaches a `db.store.create`/`update` `data` anymore, and that the admin status/featured action remains the only writer of those fields.
- Follow-up deferred: migrating `upsertStore`'s inline auth to `requireStoreOwner` (separate plan; keeps this fix minimal).
