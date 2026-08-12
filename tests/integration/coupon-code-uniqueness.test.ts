/**
 * Coupon.code グローバル unique の実 DB 統合テスト (plan 041 / TESTS-25)
 *
 * `Coupon.code` は `prisma/schema.prisma` で **グローバル一意**（`@unique`。storeId との
 * 複合ではない）だが、seller 経路 `upsertCoupon` の事前重複チェックは
 * **自店舗内のみ**を検索する（`src/queries/coupon.ts` の `findFirst` に
 * `{ storeId: store.id }` が入っている）。したがって **他店舗または PLATFORM クーポンが
 * 同じ code を既に使っている場合、事前チェックを素通りして upsert が実 DB の unique 制約に
 * 衝突する** —— これは競合（race）ではなく、2 店舗が両方 "SUMMER10" を作ろうとするだけで
 * **決定論的に到達する本経路**である。
 *
 * unit テスト (`src/queries/coupon.test.ts`) は P2002 をモックの reject で注入するだけなので、
 * 「実 DB の unique 制約が本当に発火するか」「発火時に既存行が無傷か」「新規行が
 * 作られていないか」は原理的に観測できない。本テストはそこを実 PostgreSQL で固定する。
 *
 * **設計上の重要な制約 — 内部経路を推論しないこと。**
 * 事前チェック（自店舗スコープ）と P2002 フォールバックは **まったく同じエラーメッセージ**
 * `'このクーポンコードは既に使用されています'` を投げる。したがって `rejects.toThrow(...)`
 * だけでは、どちらの経路で拒否されたのかを区別できない。
 *
 * かつて本プランは「事前チェックと同一条件の findFirst をテスト側で実行して null を確認する」
 * 方法を指定していたが、これは**経路の証明にならない**ため 2026-07-18 に撤回された ——
 * その findFirst は `upsertCoupon` **内部の**事前チェックを観測しておらず、テスト側で
 * `storeId` をハードコードした別のクエリを再実行しているだけである。将来 `coupon.ts` の
 * 事前チェックがグローバル検索へ変われば P2002 経路は一度も実行されなくなるが、
 * テスト側のクエリは同じ結果を返し続けるのでテストは緑のまま腐る。
 *
 * そこで本ファイルは **外から観測可能な不変条件だけ**を assert する:
 *   「拒否される」+「既存行が無傷」+「行が増えない」
 * これは実装が事前チェックで弾こうが P2002 で弾こうが正しく緑・正しく赤になり、
 * 実装の内部構造に結合しない。**P2002 → 日本語メッセージへの変換そのもの**は、
 * seller / admin 両経路とも `src/queries/coupon.test.ts` の独立したユニットテストが
 * 直接駆動して固定している（seller: `findFirst` を null にして `upsert` に P2002 を
 * 投げさせる / admin: 同型）。役割を分けているので、ここで重複させない。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - plans/041-integration-test-coupon-code-uniqueness.md
 * - prisma/schema.prisma の `Coupon.code String @unique`（本テストの SSOT）
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// upsertCoupon は requireStoreOwner() 経由で、upsertCouponAsAdmin は requireAdmin() 経由で
// currentUser() を呼ぶ。テストごとにロールを差し替える。
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// ----------------------------------------------------------------------------

import { randomUUID } from "node:crypto";

import { currentUser } from "@clerk/nextjs/server";
import type { Coupon, PrismaClient, Store } from "@prisma/client";

import { upsertCoupon, upsertCouponAsAdmin } from "@/queries/coupon";

import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import { seedCoupon, seedStore, seedUser } from "./setup/seed";

let db: PrismaClient;

/**
 * `requireSeller` / `requireAdmin` はいずれも `user.privateMetadata?.role` で判定する
 * (`src/lib/auth-guards.ts`)。DB 上の `User.role` は見ないため、ロールは Clerk mock 側で与える。
 */
function mockAuthAs(userId: string, role: "SELLER" | "ADMIN"): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        privateMetadata: { role },
    });
}

/**
 * `upsertCoupon` / `upsertCouponAsAdmin` に渡すフル shape の Coupon 入力を作る。
 *
 * **code は英数字のみにすること。** `CouponFormSchema`（`src/lib/schemas.ts`）は
 * `/^[A-Za-z0-9]+$/` を要求するので、ハイフン入りの code は unique 制約に到達する前に
 * `'クーポンの入力値が不正です。'` で弾かれ、本テストが見たい経路に入らない。
 * discount も 1〜99 の整数でなければ同じ理由で手前で落ちる。
 */
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
        // seller 経路では coupon.ts が store.id で上書きするため入力値は使われない。
        storeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

describe("Coupon.code のグローバル一意制約（実 DB）", () => {
    let sellerA: { id: string };
    let sellerB: { id: string };
    let storeA: Store;
    let storeB: Store;

    beforeAll(async () => {
        db = await getTestDb();
    });

    afterAll(async () => {
        await disconnectTestDb();
    });

    beforeEach(async () => {
        await resetDb(db);
        jest.mocked(currentUser).mockReset();

        sellerA = await seedUser(db, { role: "SELLER" });
        sellerB = await seedUser(db, { role: "SELLER" });
        // requireStoreOwner は { url, userId } の複合 where で引くため、
        // seed の userId とテストで mock する Clerk id を一致させる必要がある。
        storeA = await seedStore(db, { userId: sellerA.id });
        storeB = await seedStore(db, { userId: sellerB.id });
    });

    // ------------------------------------------------------------------------
    // シナリオ 1: 同一店舗内の重複（事前チェックが担当する経路）
    // ------------------------------------------------------------------------
    it("同一店舗内で既存 code を再利用する作成は拒否され、行が増えない", async () => {
        // Arrange
        await seedCoupon(db, { storeId: storeA.id, code: "DUPLICATE" });
        mockAuthAs(sellerA.id, "SELLER");

        // Act & Assert
        await expect(
            upsertCoupon(buildCouponInput({ code: "DUPLICATE" }), storeA.url)
        ).rejects.toThrow("このクーポンコードは既に使用されています");

        // Assert: 拒否は副作用なしで成立する
        expect(await db.coupon.count()).toBe(1);
    });

    // ------------------------------------------------------------------------
    // シナリオ 2: 他店舗の code と衝突（本丸 — 実 unique 制約の発火）
    // ------------------------------------------------------------------------
    it("他店舗が使用中の code での作成は拒否され、既存行は無傷で行も増えない", async () => {
        // Arrange: 店舗 B が "SHARED" を保有している
        await seedCoupon(db, {
            storeId: storeB.id,
            code: "SHARED",
            discount: 20,
        });
        const before = await db.coupon.findMany({ where: { code: "SHARED" } });
        expect(before).toHaveLength(1);

        mockAuthAs(sellerA.id, "SELLER");

        // Act & Assert: 店舗 A のオーナーが同じ code を作ろうとすると拒否される。
        // 事前チェックは自店舗スコープなので構造的にこの行を見つけられず、
        // 実 DB の unique 制約だけがこれを止めている。ただし本テストは
        // 「どちらの経路で止まったか」を推論せず、結果だけを固定する。
        await expect(
            upsertCoupon(buildCouponInput({ code: "SHARED" }), storeA.url)
        ).rejects.toThrow("このクーポンコードは既に使用されています");

        // Assert: 既存行は無傷（所有者・割引率とも不変）で、新規行も作られていない
        const after = await db.coupon.findMany({ where: { code: "SHARED" } });
        expect(after).toHaveLength(1);
        expect(after[0]).toMatchObject({
            id: before[0].id,
            storeId: storeB.id,
            discount: 20,
        });
        expect(await db.coupon.count()).toBe(1);
    });

    // ------------------------------------------------------------------------
    // シナリオ 3: PLATFORM クーポンの code と衝突
    // ------------------------------------------------------------------------
    it("PLATFORM クーポンが使用中の code での作成は拒否され、PLATFORM 行は無傷", async () => {
        // Arrange: storeId=null の PLATFORM クーポン。事前チェックは
        // `{ storeId: store.id }` 固定なので、この行は構造的に検出できない。
        await seedCoupon(db, {
            storeId: null,
            scope: "PLATFORM",
            code: "PLATFORM10",
            discount: 15,
        });
        mockAuthAs(sellerA.id, "SELLER");

        // Act & Assert
        await expect(
            upsertCoupon(buildCouponInput({ code: "PLATFORM10" }), storeA.url)
        ).rejects.toThrow("このクーポンコードは既に使用されています");

        // Assert: PLATFORM 行は scope / storeId とも書き換わっていない
        const after = await db.coupon.findMany({
            where: { code: "PLATFORM10" },
        });
        expect(after).toHaveLength(1);
        expect(after[0]).toMatchObject({
            scope: "PLATFORM",
            storeId: null,
            discount: 15,
        });
        expect(await db.coupon.count()).toBe(1);
    });

    // ------------------------------------------------------------------------
    // シナリオ 4: 自クーポンの code 据え置き update は成功する
    // ------------------------------------------------------------------------
    it("自店舗クーポンの code を据え置いたまま更新できる（NOT: { id } 除外の実挙動）", async () => {
        // Arrange
        const existing = await seedCoupon(db, {
            storeId: storeA.id,
            code: "KEEP",
            discount: 10,
        });
        mockAuthAs(sellerA.id, "SELLER");

        // Act: 同じ id・同じ code で discount だけ変更する。事前チェックの
        // `NOT: { id: coupon.id }` が自分自身を除外するため、これは重複扱いにならない。
        await expect(
            upsertCoupon(
                buildCouponInput({
                    id: existing.id,
                    code: "KEEP",
                    discount: 25,
                }),
                storeA.url
            )
        ).resolves.toBeTruthy();

        // Assert: 更新が反映され、行は増えていない
        const after = await db.coupon.findUniqueOrThrow({
            where: { id: existing.id },
        });
        expect(after.discount).toBe(25);
        expect(after.code).toBe("KEEP");
        expect(await db.coupon.count()).toBe(1);
    });

    // ------------------------------------------------------------------------
    // シナリオ 5: admin 経路も同じ不変条件を守る
    // ------------------------------------------------------------------------
    it("admin 経路でも既存 code との衝突は拒否され、既存行は無傷", async () => {
        // Arrange: 店舗 A が "ADMINCLASH" を保有している
        const existing = await seedCoupon(db, {
            storeId: storeA.id,
            code: "ADMINCLASH",
            discount: 30,
        });
        mockAuthAs("admin-user-1", "ADMIN");

        // Act & Assert: 管理者が同じ code で PLATFORM クーポンを作ろうとする。
        // admin 経路には事前チェックが無いため、止めているのは実 unique 制約だけ。
        await expect(
            upsertCouponAsAdmin(
                buildCouponInput({
                    code: "ADMINCLASH",
                    scope: "PLATFORM",
                    storeId: null,
                })
            )
        ).rejects.toThrow("このクーポンコードは既に使用されています");

        // Assert: 既存の店舗クーポンは PLATFORM 化されていない
        const after = await db.coupon.findUniqueOrThrow({
            where: { id: existing.id },
        });
        expect(after).toMatchObject({
            storeId: storeA.id,
            scope: "STORE",
            discount: 30,
        });
        expect(await db.coupon.count()).toBe(1);
    });
});
