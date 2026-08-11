/**
 * upsertShippingAddress の default フラグ不変条件 統合テスト (plan 037 / TESTS-21)
 *
 * checkout の配送先自動選択は `addresses.find((address) => address.default)`
 * (`src/components/store/shared/shipping-addresses/address.list.tsx`) で**最初の default を
 * 採用**する。したがって「1 ユーザーにつき `default: true` は最大 1 件」という不変条件が
 * 壊れると、**配送先の自動選択が行の並び順に依存する非決定になる**（意図しない住所への
 * 配送リスク）。この行状態の変化はモック unit (`src/queries/user.test.ts`) では観測できない。
 *
 * 実 DB (testcontainers PostgreSQL) で固定する境界:
 *
 *   - **更新経路**: 既存住所を default に更新すると、他住所の default は解除される
 *   - **新規経路**: 新規 id + `default: true` でも解除は走り、default は 1 件に保たれる
 *     （**TESTS-21 の回帰ガード**。修正前は解除がスキップされ 2 件併存していた — plan 064）
 *   - **IDOR 防御の実体**: 他ユーザーの住所 id を渡すと所有権 `findFirst` が null になり、
 *     同一 id での create が **PK 一意制約違反 (P2002)** で reject される。silent overwrite には
 *     ならない
 *   - **原子性**: その reject 時、攻撃者自身の default 解除も同一トランザクションで
 *     ロールバックされる（拒否されたのに副作用が残る状態を作らない）
 *   - 未認証時の拒否と副作用なし
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - plans/037-integration-test-shipping-address-default.md
 * - plans/audit/findings-14-integration-coverage-r6.md (TESTS-21)
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// upsertShippingAddress は currentUser() を直呼びする（auth-guards 非経由・ロール不要）
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// ----------------------------------------------------------------------------

import type { PrismaClient, ShippingAddress } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import { upsertShippingAddress } from "@/queries/user";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import { seedCountry, seedShippingAddress, seedUser } from "./setup/seed";

let db: PrismaClient;
let ownerId: string;
let countryId: string;
/** default: true で作られた住所 */
let addressA: ShippingAddress;
/** default なしの住所 */
let addressB: ShippingAddress;

function mockAuthAs(userId: string): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({ id: userId });
}

/** 当該ユーザーの `default: true` の行数。不変条件はこの値が 0 か 1 であること。 */
function countDefaults(userId: string): Promise<number> {
    return db.shippingAddress.count({ where: { userId, default: true } });
}

beforeAll(() => {
    db = getTestDb();
});

afterAll(async () => {
    await disconnectTestDb();
});

beforeEach(async () => {
    await resetDb(db);
    (currentUser as unknown as jest.Mock).mockReset();

    const owner = await seedUser(db);
    ownerId = owner.id;
    const country = await seedCountry(db);
    countryId = country.id;

    addressA = await seedShippingAddress(db, {
        userId: ownerId,
        countryId,
        overrides: { default: true },
    });
    addressB = await seedShippingAddress(db, { userId: ownerId, countryId });
});

describe("upsertShippingAddress — default フラグの不変条件", () => {
    it("シナリオ1: 既存住所を default に更新すると他住所の default が実 DB で解除される", async () => {
        // Arrange
        mockAuthAs(ownerId);

        // Act
        await expect(
            upsertShippingAddress({ ...addressB, default: true })
        ).resolves.toMatchObject({ id: addressB.id, default: true });

        // Assert
        const [a, b] = await Promise.all([
            db.shippingAddress.findUnique({ where: { id: addressA.id } }),
            db.shippingAddress.findUnique({ where: { id: addressB.id } }),
        ]);
        expect(a?.default).toBe(false);
        expect(b?.default).toBe(true);
        expect(await countDefaults(ownerId)).toBe(1);
    });

    it("シナリオ2: 新規住所を default 付きで作成すると既存 default が解除され 1 件のみになる", async () => {
        // Arrange
        mockAuthAs(ownerId);
        const newId = randomUUID();

        // Act — UI は新規住所に v4() の id を採番する。その経路でも解除が走ること
        await expect(
            upsertShippingAddress({ ...addressA, id: newId, default: true })
        ).resolves.toMatchObject({ id: newId, default: true });

        // Assert
        //
        // 回帰ガード (TESTS-21 / plan 064)。修正前の実装は解除を
        // `findUnique({ where: { id: address.id } })` が非 null であることに条件付けており、
        // **新規 id では常に null → 解除が丸ごとスキップされ default が 2 件併存**した。
        // 2 件あると address.list.tsx の `addresses.find((a) => a.default)` がどちらを
        // 拾うかが物理行順依存になり、配送先の自動選択が非決定になる。
        // この期待値は 1 以外に緩めてはならない。
        expect(await countDefaults(ownerId)).toBe(1);

        const created = await db.shippingAddress.findUnique({
            where: { id: newId },
        });
        expect(created?.default).toBe(true);

        const previous = await db.shippingAddress.findUnique({
            where: { id: addressA.id },
        });
        expect(previous?.default).toBe(false);

        expect(
            await db.shippingAddress.count({ where: { userId: ownerId } })
        ).toBe(3);
    });

    it("シナリオ3: 他ユーザーの住所 id の上書きは PK 衝突で reject され、被害者の行は無傷のまま", async () => {
        // Arrange
        const attacker = await seedUser(db);
        mockAuthAs(attacker.id);

        // Act — 所有権 findFirst が null → 同一 id で create を試み PK 一意制約違反になる
        await expect(
            upsertShippingAddress({ ...addressA, firstName: "Attacker" })
        ).rejects.toMatchObject({ code: "P2002" });

        // Assert — 被害者の行は userId も内容も変わらない
        const victim = await db.shippingAddress.findUnique({
            where: { id: addressA.id },
        });
        expect(victim?.userId).toBe(ownerId);
        expect(victim?.firstName).toBe(addressA.firstName);
        // default も無傷であること。攻撃ペイロードは `default: true` を含むため、
        // 実装の「他住所の default 解除」updateMany が userId でスコープされて
        // いなければ、**PK 衝突で reject される前に**被害者の default が落ちる。
        // 拒否されたことだけを見ていると、この副作用は素通りする。
        expect(victim?.default).toBe(true);
        expect(
            await db.shippingAddress.count({ where: { userId: attacker.id } })
        ).toBe(0);
    });

    it("シナリオ4: 未認証は 'Unauthenticated.' で拒否され行数が変わらない", async () => {
        // Arrange
        (currentUser as unknown as jest.Mock).mockResolvedValue(null);
        const before = await db.shippingAddress.count();

        // Act & Assert
        await expect(
            upsertShippingAddress({ ...addressB, default: true })
        ).rejects.toThrow("Unauthenticated.");
        expect(await db.shippingAddress.count()).toBe(before);
        expect(await countDefaults(ownerId)).toBe(1);
    });

    it("シナリオ5: create が PK 衝突で失敗すると攻撃者自身の default 解除もロールバックされる", async () => {
        // Arrange — 攻撃者にも default 住所を 1 件持たせる
        const attacker = await seedUser(db);
        const attackerAddress = await seedShippingAddress(db, {
            userId: attacker.id,
            countryId,
            overrides: { default: true },
        });
        mockAuthAs(attacker.id);

        // Act — 被害者の id で default: true を送る。所有権 findFirst は null なので
        // 解除 updateMany が走った直後に create が P2002 で落ちる
        await expect(
            upsertShippingAddress({ ...addressA, default: true })
        ).rejects.toMatchObject({ code: "P2002" });

        // Assert — 解除と create が同一トランザクションに無ければ、**拒否されたのに
        // 攻撃者自身の default だけが落ちて 0 件になる**（副作用が残る）。
        // シナリオ3 の victim?.default は userId スコープだけでも通るため、
        // ロールバックを立証しているのはこのシナリオだけである。
        const own = await db.shippingAddress.findUnique({
            where: { id: attackerAddress.id },
        });
        expect(own?.default).toBe(true);
        expect(await countDefaults(attacker.id)).toBe(1);
        expect(await countDefaults(ownerId)).toBe(1);
    });

    it("シナリオ6: アプリを迂回して 2 件目の default を立てると DB の部分 unique index が拒否する", async () => {
        // Arrange / Act — upsertShippingAddress を通さず直接 update する。
        // アプリ層の tx は「この関数を通る書き込み」しか守らないため、シーダー・
        // 管理画面・手動 SQL などの別経路に対する最終防衛線として
        // `CREATE UNIQUE INDEX ... ("userId") WHERE "default"` を張っている
        // （prisma/migrations/20260809064416_add_shipping_address_single_default_index）。
        //
        // Assert — index が失われた場合、この update は素通りして 2 件併存に戻る。
        // つまり本シナリオは「index がまだ存在すること」の回帰ガードである。
        await expect(
            db.shippingAddress.update({
                where: { id: addressB.id },
                data: { default: true },
            })
        ).rejects.toMatchObject({ code: "P2002" });

        expect(await countDefaults(ownerId)).toBe(1);
    });
});
