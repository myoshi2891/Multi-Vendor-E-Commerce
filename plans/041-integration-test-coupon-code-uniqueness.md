# Plan 041: `Coupon.code` グローバル unique と upsertCoupon の P2002 フォールバック実挙動を実 DB 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 9111f41..HEAD -- src/queries/coupon.ts prisma/schema.prisma tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（他プランと完全独立・並行可。seed.ts / reset-db.ts を変更しないため
  027 / 031〜040 とファイル競合なし）
- **Category**: tests
- **Planned at**: commit `9111f41`, 2026-07-11
- **出典 finding**: TESTS-25（`plans/audit/findings-15-integration-coverage-r7.md`）

## Why this matters

`Coupon.code` は**グローバル一意**（`@unique` — storeId との複合ではない）だが、seller 経路
`upsertCoupon` の事前重複チェックは**自店舗内のみ**を検索する。つまり**他店舗または PLATFORM
クーポンが同じ code を既に使っている場合、事前チェックを素通りして upsert が実 DB の unique
制約に衝突し、P2002 フォールバックが唯一のガードとして働く** — これは競合（race）ではなく
**決定論的に到達可能な本経路**である（例: 2 店舗が両方 "SUMMER10" を作る）。unit テストは
P2002 をモックの reject で注入するだけで、実 DB の unique 制約が本当に発火するか・発火時に
既存行が無傷か・新規行が作られていないかは未観測。実 DB で固定すれば、コード衝突時のエラー
UX の回帰網になり、「code をグローバル一意のままにするか複合 unique 化するか」という将来の
設計判断の仕様書代わりにもなる。

## Current state

- `prisma/schema.prisma:672` — `code String @unique`（**グローバル一意**）。Coupon model は
  `storeId String?`（nullable — PLATFORM クーポンは null）+ `scope CouponScope @default(STORE)`。
- `src/queries/coupon.ts:32-106` — seller 経路 `upsertCoupon(coupon: Coupon, storeURL: string)`。
  **変更しない。** 要点:
  - `:38` — `requireStoreOwner(storeURL)` で SELLER + 店舗所有権を検証
  - `:50-60` — `coupon.id` の既存行を findUnique し、他店舗/PLATFORM 所有なら
    `'Forbidden: coupon not owned by current store.'`
  - `:64-76` — 事前重複チェック（**自店舗スコープのみ**）:

```typescript
        const existingCoupon = await db.coupon.findFirst({
            where: {
                AND: [
                    { code: coupon.code },
                    { storeId: store.id },
                    { NOT: { id: coupon.id } },
                ],
            },
        })

        if (existingCoupon) {
            throw new Error('このクーポンコードは既に使用されています')
        }
```

  - `:80-88` — `db.coupon.upsert({ where: { id: coupon.id }, ... })`。update/create とも
    `storeId: store.id` + `scope: 'STORE'` を強制
  - `:94-100` — P2002 フォールバック（**他店舗/PLATFORM との code 衝突はここだけが捕捉する**）:

```typescript
        if (
            typeof (error as Record<string, unknown>).code === 'string' &&
            (error as Record<string, unknown>).code === 'P2002'
        ) {
            throw new Error('このクーポンコードは既に使用されています')
        }
```

- `src/queries/coupon.ts:379-419` — admin 経路 `upsertCouponAsAdmin(coupon: Coupon)`。
  **変更しない。** `requireAdmin()`（:380）→ 事前チェック**なし**で upsert（:395-399）→
  P2002 を同じ日本語メッセージへ変換（:402-408）。scope は入力を尊重
  （PLATFORM なら storeId を null に正規化、STORE なら storeId 必須 — :384-393）。
- **認可ガードのモック形**（`src/lib/auth-guards.ts`）:
  - `requireStoreOwner` は `requireSeller`（`privateMetadata?.role !== "SELLER"` で判定）→
    `db.store.findUnique({ where: { url: storeUrl, userId: user.id } })`。Clerk mock は
    `{ id: sellerUserId, privateMetadata: { role: "SELLER" } }` の形にすること
    （store は実 DB から引くため `seedStore` の `url` と `userId` が一致している必要がある）
  - `requireAdmin` は `privateMetadata?.role !== "ADMIN"` で判定。admin シナリオでは
    `{ id: adminUserId, privateMetadata: { role: "ADMIN" } }` に差し替える
- **`Coupon` は `@prisma/client` の型**（coupon.ts:8）。テストから渡す入力はフル shape が必要:

```typescript
function buildCouponInput(overrides: Partial<Coupon> = {}): Coupon {
    const now = Date.now();
    return {
        id: randomUUID(),
        code: "TESTCODE",
        startDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
        discount: 10,
        isActive: true,
        scope: "STORE",
        storeId: null, // upsertCoupon 側で store.id に強制上書きされる
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}
```

- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`tests/integration/setup/db.ts`）、
  `resetDb`（`setup/reset-db.ts` — Coupon は TRUNCATE 対象済み）、`seedUser` / `seedStore` /
  `seedCoupon`（`setup/seed.ts:245-265` — `storeId` 必須・`code` 上書き可）。
  **PLATFORM クーポン（storeId=null）は seedCoupon で作れない**ため
  `db.coupon.create({ data: { ..., scope: "PLATFORM", storeId: null } })` を直接呼ぶ。
- **構造の手本**: `tests/integration/order-placement.test.ts`（Clerk mock の宣言位置・
  `mockAuthAs` ヘルパー・`beforeEach` の `resetDb` + `mockReset`）。SELLER role 付きの
  mock ヘルパー形は `plans/036-integration-test-product-deletion-fk.md` Step 2 と同じ:

```typescript
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

function mockAuthAs(userId: string, role: "SELLER" | "ADMIN"): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        privateMetadata: { role },
    });
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/coupon-code-uniqueness.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/coupon-code-uniqueness.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/queries/coupon.ts` — 検証対象本体。**「事前チェックをグローバル化する」「code を
  (storeId, code) 複合 unique に変える」等の修正は行わない**（コード/スキーマ修正は将来の
  correctness プランの領分。本プランは現挙動の characterization）
- `prisma/schema.prisma` / `prisma/migrations/` — unique 制約の変更は絶対にしない
- `tests/integration/setup/seed.ts`（ヘルパー追加は不要 — seedCoupon + 直接 create で足りる）
- `applyCoupon` / `removeCoupon` — CAS・二重適用は `tests/integration/cart-checkout.test.ts`
  S3 が既にカバー（重複させない）
- `getCoupon` / `getStoreCoupons` / `deleteCoupon` 等の読み取り・削除系 — unit 網羅済み

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例:
  `test(integration): add coupon code global-uniqueness P2002 scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check 実行 → `bun run test:integration` 全 pass 確認。

**Verify**: `bun run test:integration` → 全 pass（17 テスト以上。他プラン実行済みなら増えていてよい）

### Step 2: `tests/integration/coupon-code-uniqueness.test.ts` を新設

ファイル冒頭 JSDoc に検証境界（グローバル unique と自店舗スコープ事前チェックの不一致 /
P2002 フォールバックの実発火 / 副作用なし）と ADR-004 参照を記載。Clerk mock は import より
前に宣言（Current state のコード形をそのまま使う）。

共通 Arrange: `seedUser`（SELLER 用）× 2 + `seedStore({ userId })` × 2（店舗 A / 店舗 B）。
`upsertCoupon` の第 2 引数には `store.url` を渡し、`mockAuthAs(オーナー.id, "SELLER")` で
認証を合わせる。

シナリオ:

1. **同一店舗内の重複 code は事前チェック（findFirst）で拒否 + 行数不変**:
   店舗 A に `seedCoupon({ storeId: storeA.id, code: "DUPLICATE" })` → 店舗 A オーナーとして
   `upsertCoupon(buildCouponInput({ code: "DUPLICATE" }), storeA.url)` →
   `rejects.toThrow("このクーポンコードは既に使用されています")`。
   `db.coupon.count()` === 1（新規行なし）
2. **他店舗の既存 code と衝突する create は P2002 フォールバックで拒否 + 既存行無傷・新規行なし
   （本丸 — 実 unique 制約の発火）**:
   店舗 B に `seedCoupon({ storeId: storeB.id, code: "SHARED" })` → 店舗 A オーナーとして
   `upsertCoupon(buildCouponInput({ code: "SHARED" }), storeA.url)` →
   `rejects.toThrow("このクーポンコードは既に使用されています")`。
   assert: `db.coupon.count()` === 1、既存クーポンの `storeId` === storeB.id のまま・
   `discount` 等も不変（既存行無傷）。

   > **経路の切り分けが必須**: シナリオ 1（事前チェック `:64-76`）と本シナリオ
   > （P2002 フォールバック `:94-100`）は**まったく同じエラーメッセージ**を投げる。
   > したがって `rejects.toThrow(...)` だけでは、**どちらの経路で拒否されたのかを
   > 区別できない**。「事前チェックは自店舗スコープなので素通りし、P2002 だけが
   > このメッセージを出す」という本シナリオの主張は、メッセージの一致では**証明されない**。
   > 以下 2 つの assert を追加して初めて経路が特定できる。

```typescript
// (a) 事前チェック（coupon.ts:64-76 と同一条件）は素通りする = ここでは拒否していない
const preCheckHit = await db.coupon.findFirst({
    where: {
        AND: [
            { code: "SHARED" },
            { storeId: storeA.id },       // 自店舗スコープ: 店舗 B の行は視界に入らない
            { NOT: { id: input.id } },
        ],
    },
});
expect(preCheckHit).toBeNull();           // 事前チェックでは検出できないことの直接証明

// (b) 実 DB の unique 制約が P2002 を出すことを独立に確認する
await expect(
    db.coupon.create({
        data: { ...rawCouponData, id: randomUUID(), code: "SHARED", storeId: storeA.id },
    })
).rejects.toMatchObject({ code: "P2002" });
```

   > (a) で「事前チェックは素通り」、(b) で「衝突時に DB が出すのは P2002」を示せば、
   > `upsertCoupon` が投げたメッセージの出所は **P2002 フォールバック以外にありえない**
   > と切り分けられる。(a) を省くと、将来事前チェックがグローバルスコープ化されて
   > P2002 経路が**一度も実行されなくなっても**このテストは green のままになり、
   > 本プランが検証したかった「実 unique 制約の発火」が無検証で腐る。
   > ※ (b) は独立確認のため `rejects` 後に行が増えていないこと（`db.coupon.count()` === 1）
   > を最終 assert で担保すること。
3. **PLATFORM クーポンの code と衝突する seller create も P2002 経路**:
   事前チェックは `storeId: store.id` 固定のため `storeId: null` の PLATFORM 行を
   構造的に検出できない（シナリオ 2 と同じ切り分けの理屈）。本シナリオでも
   シナリオ 2 の (a) と同型の「事前チェック素通り」assert を置くこと
   （`findFirst` の条件を PLATFORM 行に対して実行 → null）。
   `db.coupon.create({ data: { id: randomUUID(), code: "PLATFORM10", startDate, endDate,
   discount: 15, scope: "PLATFORM", storeId: null } })` → 店舗 A オーナーとして
   `upsertCoupon(buildCouponInput({ code: "PLATFORM10" }), storeA.url)` →
   `rejects.toThrow("このクーポンコードは既に使用されています")`。
   PLATFORM クーポンが無傷（`scope` === "PLATFORM" / `storeId` === null のまま）
4. **自クーポンの update で code 据え置きは成功（NOT: { id } 除外の実挙動）**:
   店舗 A に `seedCoupon({ storeId: storeA.id, code: "KEEP" })` → その `id` と同じ id・同じ
   code で `upsertCoupon(buildCouponInput({ id: existing.id, code: "KEEP", discount: 25 }),
   storeA.url)` → **resolve**。`discount` が 25 に更新され、行数は 1 のまま
5. **admin 経路 `upsertCouponAsAdmin` の code 衝突も P2002 変換 + 副作用なし**:
   店舗 A に `seedCoupon({ storeId: storeA.id, code: "ADMIN-CLASH" })` →
   `mockAuthAs(admin.id, "ADMIN")` で
   `upsertCouponAsAdmin(buildCouponInput({ code: "ADMIN-CLASH", scope: "PLATFORM" }))` →
   `rejects.toThrow("このクーポンコードは既に使用されています")`。
   `db.coupon.count()` === 1・既存行無傷

**Verify**: `bun run test:integration -- tests/integration/coupon-code-uniqueness.test.ts` → all pass（5 テスト以上）

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規 全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass（本プランは unit に触れないため不変のはず）

## Test plan

Step 2 のシナリオ 1〜5 が本体。構造の手本は `tests/integration/order-placement.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST。Integration 統計の SSOT は
`docs/testing/QA_HANDOFF.md`）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `coupon-code-uniqueness.test.ts` の新規テストが全 pass
- [ ] シナリオ 2 に「reject + 既存行無傷 + 新規行なし」の 3 点の assert が存在する
- [ ] シナリオ 2 に**経路の切り分け** assert が存在する:
      (a) 事前チェックと同一条件の `findFirst` が null（自店舗スコープで素通りする証明）、
      (b) 生の `db.coupon.create` が `P2002` で reject する（実 unique 制約の発火の証明）。
      シナリオ 1 と 2 はエラーメッセージが同一のため、この 2 点が無いと
      どちらの経路で拒否されたか区別できない
- [ ] シナリオ 3 にも「事前チェック素通り」assert（PLATFORM 行は `storeId: null` のため
      自店舗スコープの findFirst に掛からない）が存在する
- [ ] シナリオ 4 に「resolve + discount 更新 + 行数 1」の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 041 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で `upsertCoupon` / `upsertCouponAsAdmin` が本プランの抜粋と一致しない
  （特に事前チェックがグローバルスコープ化されている・複合 unique に変わっている場合 —
  本プランの前提が消えている）
- **シナリオ 2 または 3 で upsert が成功してしまう** — `Coupon.code` の unique 制約が
  グローバルでなくなっている（schema が変わった）。characterization の前提が崩れているので、
  実際の unique 定義を添えて報告
- シナリオ 2 のエラーメッセージが日本語メッセージでなく生の Prisma エラーになる —
  P2002 フォールバック（coupon.ts:94-100）のドリフト。実際のエラー内容を添えて報告
- シナリオ 2 の切り分け assert (a) が **null にならない**（事前チェックが他店舗の行を
  検出している）— 事前チェックのスコープがグローバル化されており、P2002 経路は
  もはや到達不能。本プランの前提が変わっているので、変更コミットを添えて報告
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- 本テストは「クーポンコードはプラットフォーム全体で一意（他店舗が使った code は使えない）」
  という**現仕様を固定**するもの。プロダクト判断として店舗ごとの code 再利用を許す場合は
  `@@unique([storeId, code])` への migration + 事前チェックの整合が必要で、その際は
  シナリオ 2・3 の期待値を意図的に反転させること
  （`.claude/rules/03-data-model-diagram-sync.md` の ERD 再生成義務にも注意）。
- 事前チェック（:64-76）を「code のグローバル検索」に広げる修正が入った場合、シナリオ 2 は
  P2002 経路でなく事前チェック経路で同じメッセージになる — テストは通り続けるが、
  P2002 フォールバックが再び死蔵コードになる点をレビューで確認すること。
- plan 007（logging consolidation）が coupon.ts の `console.error` 形式を変更しうるが、
  本テストはメッセージ throw のみを assert するため干渉しない。
