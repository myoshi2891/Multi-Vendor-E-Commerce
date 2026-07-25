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
- `src/queries/coupon.test.ts` — シナリオ 2 の (2)（P2002 → 日本語メッセージ変換）を
  実 DB に頼らず直接駆動するユニットテストを **追記**する。本文 (2) が要求しているため
  in-scope（`bun run test` の総数が +1 される）

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
   > このため、経路をメッセージ一致から推論するのではなく、下記のとおり
   > 検証手段そのものを分割する。
   >
   > **訂正（2026-07-18）**: 以前の版はここで「事前チェックと**同一条件**の
   > `findFirst` をテスト側で実行し、`null` を確認する」方法（`preCheckHit`）を
   > 指定していた。これは**経路の証明にならない**ので採用しないこと。
   >
   > 理由: その `findFirst` は `upsertCoupon` **内部の**事前チェックを観測して
   > いない。テスト側で `storeId: storeA.id` をハードコードした同じクエリを
   > 再実行しているだけで、実装とは独立している。将来 `coupon.ts` の事前チェックが
   > グローバル検索へ変更されて P2002 経路が**一度も実行されなくなっても**、
   > テスト側のクエリは `storeA.id` のままなので `null` を返し続け、
   > テストは green のままになる。本プランが検証したかった「実 unique 制約の発火」が
   > 無検証で腐るという、まさに (a) が防ぐはずだった事態を (a) 自身が招く。
   > （加えて、旧スニペットの `rawCouponData` はどこにも定義されておらず、
   > そのままでは動かなかった。）
   >
   > **代わりに、証明したい 2 つを別々の手段で検証する**:

**(1) 実 DB 統合テスト — 観測可能な振る舞いを固定する**

内部経路を推測せず、外から見える結果だけを assert する。

```typescript
// 前提: 店舗 B に code "SHARED" の行が 1 件ある
const before = await db.coupon.findMany({ where: { code: "SHARED" } });
expect(before).toHaveLength(1);

// 店舗 A オーナーとして同じ code を作ろうとすると拒否される
await expect(
    upsertCoupon(buildCouponInput({ code: "SHARED" }), storeA.url)
).rejects.toThrow("このクーポンコードは既に使用されています");

// 既存行は無傷、かつ行が増えていない（＝拒否が副作用なしで成立した）
const after = await db.coupon.findMany({ where: { code: "SHARED" } });
expect(after).toHaveLength(1);
expect(after[0]).toMatchObject({ id: before[0].id, storeId: storeB.id });
```

これは「他店舗の code と衝突する作成が、既存行を保ったまま拒否される」という
**プランが本当に守りたい不変条件**そのものであり、実装が事前チェックで弾こうが
P2002 で弾こうが正しく緑・正しく赤になる。実装の内部構造に結合しない。

**(2) P2002 → メッセージ変換は、その分岐を直接駆動して証明する**

「どちらの経路を通ったか」を実 DB の挙動から推論するのをやめ、P2002 分岐だけを
直接叩くユニットテストを `src/queries/coupon.test.ts` に置く。Prisma を
モックして `create`（または `update`）に P2002 を投げさせれば、事前チェックの
スコープが将来どう変わっても、この分岐の存在と変換内容が独立に固定される。

```typescript
mockDb.coupon.findFirst.mockResolvedValue(null);   // 事前チェックは素通りさせる
// 実装は create ではなく `db.coupon.upsert` を呼ぶ（coupon.ts:57）。P2002 はその upsert の
// race フォールバック（coupon.ts:83）で捕捉されるため、モックは upsert に仕込む。
mockDb.coupon.upsert.mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { target: ["code"] },
    })
);

await expect(upsertCoupon(input, storeA.url))
    .rejects.toThrow("このクーポンコードは既に使用されています");
```

   > この分割により、(1) は「振る舞いが守られているか」を実 DB で、(2) は
   > 「P2002 を正しく変換しているか」を実装経路上で、それぞれ**取り違えようのない
   > 形で**検証する。1 本のテストで両方を兼ねようとしたことが、経路を
   > メッセージ一致から推論するという弱い証明を招いていた。
3. **PLATFORM クーポンの code と衝突する seller create も P2002 経路**:
   事前チェックは `storeId: store.id` 固定のため `storeId: null` の PLATFORM 行を
   構造的に検出できない（シナリオ 2 と同じ切り分けの理屈）。本シナリオも
   シナリオ 2 と同じ方針で検証すること — すなわち**「事前チェック素通り」を
   テスト側の再クエリで示そうとしない**（同じトートロジーになる）。
   実 DB 側では観測可能な振る舞い（拒否される・PLATFORM 行が無傷・行が増えない）
   のみを assert し、P2002 変換自体はシナリオ 2 の (2) と同じユニットテストで
   カバー済みとする。
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
4. `bun run test` → unit 全 pass。**テスト数は増える**（`src/queries/coupon.test.ts` に
   シナリオ 2 の (2) で追加する P2002 変換ユニットテスト **+1**）。
   「本プランは unit に触れないため不変」は本文 (2) と矛盾するため撤回した

## Test plan

Step 2 のシナリオ 1〜5 が本体。構造の手本は `tests/integration/order-placement.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST。Integration 統計の SSOT は
`docs/testing/QA_HANDOFF.md`）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `coupon-code-uniqueness.test.ts` の新規テストが全 pass
- [ ] シナリオ 2 は**実 DB で観測可能な振る舞いのみ**を assert する:
      「reject + 既存行無傷（`id` / `storeId` 一致）+ 新規行なし（件数不変）」の 3 点。
      どちらの経路（事前チェック / P2002）で拒否されたかを**テスト側の再クエリで推論しない**
      （本文「(1)」の不変条件そのものを検証する）
- [ ] P2002 → メッセージ変換は `src/queries/coupon.test.ts` の**独立したユニットテスト**で固定する:
      `db.coupon.upsert` を `P2002` で reject させ（`findFirst` は null で事前チェックを素通りさせる）、
      "このクーポンコードは既に使用されています" への変換を直接駆動して証明する（本文「(2)」）
- [ ] シナリオ 3 も**観測可能な振る舞いのみ**を assert する:
      「reject + PLATFORM 行無傷（`scope` === "PLATFORM" / `storeId` === null）+ 新規行なし」。
      「事前チェック素通り」を**テスト側の再クエリで示さない**（P2002 変換は上記ユニットテストでカバー済み）
- [ ] シナリオ 4 に「resolve + discount 更新 + 行数 1」の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test`（上記ユニットテスト含む）exits 0
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
- シナリオ 2 で **既存行が変化する / 行数が増える**（拒否されたのに副作用が残っている）—
  「拒否は副作用なしで成立する」という本プランの不変条件そのものが崩れている。
  実際の行内容を添えて報告
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
