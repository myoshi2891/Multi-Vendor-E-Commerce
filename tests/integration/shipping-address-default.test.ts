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
 *   - **更新経路**: 既存住所を default に更新すると、他住所の default は解除される（正常）
 *   - **新規経路**: 新規 id + `default: true` では解除がスキップされ default が併存する
 *     （**既知バグの characterization** — シナリオ 2 の注記を参照）
 *   - **IDOR 防御の実体**: 他ユーザーの住所 id を渡すと所有権 `findFirst` が null になり、
 *     同一 id での create が **PK 一意制約違反 (P2002)** で reject される。silent overwrite には
 *     ならない
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

    it("シナリオ2: 新規住所を default 付きで作成すると既存 default が残存し 2 件併存する（既知バグの characterization）", async () => {
        // Arrange
        mockAuthAs(ownerId);
        const newId = randomUUID();

        // Act — 新規 id なので実装の findUnique が null を返し、他住所の default 解除がスキップされる
        await expect(
            upsertShippingAddress({ ...addressA, id: newId, default: true })
        ).resolves.toMatchObject({ id: newId, default: true });

        // Assert
        //
        // TODO(characterization): 既知バグ TESTS-21。修正時にこの期待値を 1 に反転する。
        //
        // ⚠️ 2 は「正しい期待値」ではない。本来の不変条件は
        //    **「1 ユーザーにつき default: true は最大 1 件」** である
        //    （address.list.tsx の `addresses.find((a) => a.default)` が最初の 1 件を採るため、
        //     2 件併存するとどちらが選ばれるかが行順に依存し非決定になる）。
        //    ここで固定しているのは現在のバグ挙動であり、修正（新規経路にも解除を追加し
        //    updateMany + create を $transaction 化する）と同時に **必ず 1 へ反転させる**。
        //    出典: plans/audit/findings-14-integration-coverage-r6.md の TESTS-21
        expect(await countDefaults(ownerId)).toBe(2);
        expect(await db.shippingAddress.count({ where: { userId: ownerId } })).toBe(3);
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
});
