/**
 * Order Lifecycle Integration Tests (updateOrderPaymentStatus / updateOrderGroupStatusAsAdmin)
 *
 * 注文確定**後**のライフサイクル（`src/queries/order.ts`）を実 DB
 * (testcontainers PostgreSQL) + `db.$transaction` で検証する。
 * 全モックの unit テスト (`src/queries/order.test.ts`) では「呼び出し構造」しか見られず、
 * 以下の実 DB セマンティクスは一度も実行されていなかった:
 *
 *   - キャンセル/返金時の親 → 子連動（Order.orderStatus / OrderGroup.status / OrderItem.status）
 *   - 在庫復元（restock = increment）が減算前の値まで戻ること
 *   - 二重キャンセルの冪等性: 条件付き `updateMany` の `count === 1` ガードにより
 *     **在庫復元がちょうど 1 回**に定まること（逐次・並行ディスパッチの両方）
 *   - 終端 → 終端の再遷移（Cancelled → Refunded）でも復元が走らないこと
 *   - 非キャンセル遷移（Paid）は子連動も復元もしないこと
 *   - `updateOrderGroupStatusAsAdmin` のグループ単位遷移ガードと親集約規則
 *     （混在 → Processing / 全 Canceled → Canceled）
 *   - 認可ガード（両 admin 関数が非 ADMIN を拒否し、副作用を一切残さないこと）
 *
 * `placeOrder` 側の在庫**減算**は `tests/integration/order-placement.test.ts` が担当し、
 * 本ファイルは**復元**側を担当する（両者で在庫整合の両側が閉じる）。
 *
 * ⚠️ 本ファイルの並行ディスパッチテストが主張できるのは「**並行ディスパッチの回帰テスト**」
 * までであり、「DB 上でトランザクションが重なったことの証明」ではない。バリアと
 * `connection_limit >= 2` が保証するのは「2 本がクエリ発行の直前まで揃っていた」ことだけで、
 * 解放後に片方が先に完走する実行順でも緑になる。この 2 条件の価値は、**重ならなかった場合に
 * 緑になる構成上の穴を塞ぐ**（= 偽陽性が確定する構成を排除する）点にある。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - src/queries/order.ts (updateOrderPaymentStatus / updateOrderGroupStatusAsAdmin)
 * - src/lib/auth-guards.ts (requireAdmin)
 * - plans/031-integration-test-order-lifecycle-restock.md
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// requireAdmin() は currentUser() でロールを判定する。テストごとに差し替え可能にする。
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// ----------------------------------------------------------------------------

import { cpus } from "node:os";
import type { Product, ProductVariant, Size } from "@prisma/client";
// enum は SUT と同じ `@/lib/types` から取る。`@prisma/client` 側の同名 enum とは
// 値は同一だが型としては別物で、`updateOrderPaymentStatus` の引数型と噛み合わない
// （`src/queries/order.test.ts` も同じ理由で `../lib/types` を使っている）。
import { OrderStatus, PaymentStatus, ProductStatus } from "@/lib/types";
import { currentUser } from "@clerk/nextjs/server";
import {
    updateOrderGroupStatusAsAdmin,
    updateOrderPaymentStatus,
} from "@/queries/order";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCategoryWithSubcategory,
    seedCountry,
    seedOrderWithGroupAndItem,
    seedProductWithVariantAndSize,
    seedShippingAddress,
    seedStore,
    seedUser,
} from "./setup/seed";

const db = getTestDb();

/** Arrange の共通値: 初期在庫 8 / 注文数量 3 → 注文直後の在庫は 5、復元後は 8 に戻る */
const INITIAL_STOCK = 8;
const ORDER_QUANTITY = 3;
const STOCK_AFTER_ORDER = INITIAL_STOCK - ORDER_QUANTITY;

/** currentUser を ADMIN として解決させる */
function mockAuthAsAdmin(): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: "admin-integration",
        privateMetadata: { role: "ADMIN" },
    });
}

/** currentUser を一般ユーザー（非 ADMIN）として解決させる */
function mockAuthAsCustomer(): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: "user-integration",
        privateMetadata: { role: "USER" },
    });
}

/**
 * Prisma の接続プール上限を求める。
 *
 * 並行ディスパッチテストは **プールが 1 だと 2 本が接続待ちで直列化され、CAS の並行性を
 * 検証しないまま緑になる**（偽陽性）。そのため「並行を検証できない環境」を silently pass
 * させず、テスト内で明示的に expect する。`connection_limit` の指定が無い場合、Prisma は
 * `num_cpus * 2 + 1` を既定値として使う。
 */
function resolveConnectionLimit(): number {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL が未設定です（globalSetup 未実行）");
    const explicit = new URL(url).searchParams.get("connection_limit");
    if (explicit !== null) {
        const parsed = Number(explicit.trim());
        if (!Number.isFinite(parsed)) {
            throw new Error(`connection_limit が数値ではありません: ${explicit}`);
        }
        return parsed;
    }
    return cpus().length * 2 + 1;
}

interface PlacedOrderFixture {
    orderId: string;
    groupId: string;
    itemId: string;
    sizeId: string;
    product: Product;
    variant: ProductVariant;
    size: Size;
    storeId: string;
    userId: string;
    shippingAddressId: string;
}

/**
 * 「在庫を 3 個減算済みの注文が 1 件ある」状態を作る。
 *
 * 在庫の減算はヘルパー内ではなくここで明示する（`placeOrder` が確定時に行う decrement を
 * 模しており、復元の期待値 8 がどこから来るかをテスト側で読めるようにするため）。
 */
async function seedPlacedOrder(): Promise<PlacedOrderFixture> {
    const user = await seedUser(db);
    const country = await seedCountry(db);
    const address = await seedShippingAddress(db, {
        userId: user.id,
        countryId: country.id,
    });
    const store = await seedStore(db, { userId: user.id });
    const { category, subCategory } = await seedCategoryWithSubcategory(db);
    const { product, variant, size } = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        sizePrice: 100,
        sizeQuantity: INITIAL_STOCK,
    });

    // 注文確定時の在庫減算を模す（placeOrder の check-and-decrement 相当）
    await db.size.update({
        where: { id: size.id },
        data: { quantity: { decrement: ORDER_QUANTITY } },
    });

    const { order, group, item } = await seedOrderWithGroupAndItem(db, {
        userId: user.id,
        shippingAddressId: address.id,
        storeId: store.id,
        product,
        variant,
        size,
        quantity: ORDER_QUANTITY,
    });

    return {
        orderId: order.id,
        groupId: group.id,
        itemId: item.id,
        sizeId: size.id,
        product,
        variant,
        size,
        storeId: store.id,
        userId: user.id,
        shippingAddressId: address.id,
    };
}

/** 現在の Size.quantity を読む */
async function stockOf(sizeId: string): Promise<number> {
    const row = await db.size.findUniqueOrThrow({ where: { id: sizeId } });
    return row.quantity;
}

// ----------------------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------------------

afterAll(async () => {
    await disconnectTestDb();
});

beforeEach(async () => {
    await resetDb(db);
    (currentUser as unknown as jest.Mock).mockReset();
});

// ============================================================================
// Scenario 1: Cancel transition — 子連動 + 在庫復元
// ============================================================================

describe("Scenario 1: cancel transition cascades to children and restocks", () => {
    it("sets Order/OrderGroup/OrderItem to Canceled and restores Size.quantity", async () => {
        // Arrange
        const fixture = await seedPlacedOrder();
        expect(await stockOf(fixture.sizeId)).toBe(STOCK_AFTER_ORDER);
        mockAuthAsAdmin();

        // Act
        const result = await updateOrderPaymentStatus(
            fixture.orderId,
            PaymentStatus.Cancelled
        );

        // Assert: 戻り値と親
        expect(result).toBe(PaymentStatus.Cancelled);
        const order = await db.order.findUniqueOrThrow({
            where: { id: fixture.orderId },
        });
        expect(order.paymentStatus).toBe(PaymentStatus.Cancelled);
        // 親 PaymentStatus は "Cancelled"（l 2 つ）、子 OrderStatus は "Canceled"（l 1 つ）
        expect(order.orderStatus).toBe(OrderStatus.Canceled);

        // Assert: 子連動
        const group = await db.orderGroup.findUniqueOrThrow({
            where: { id: fixture.groupId },
        });
        expect(group.status).toBe(OrderStatus.Canceled);
        const item = await db.orderItem.findUniqueOrThrow({
            where: { id: fixture.itemId },
        });
        expect(item.status).toBe(ProductStatus.Canceled);

        // Assert: 在庫が減算前まで復元されている
        expect(await stockOf(fixture.sizeId)).toBe(INITIAL_STOCK);
    });
});

// ============================================================================
// Scenario 2: 二重キャンセルの冪等性（TOCTOU ガード）— 逐次 + 並行ディスパッチ
// ============================================================================

describe("Scenario 2: double cancellation restocks exactly once", () => {
    it("does not restock twice on sequential cancellations nor on Cancelled → Refunded", async () => {
        // Arrange
        const fixture = await seedPlacedOrder();
        mockAuthAsAdmin();

        // Act: 同じ遷移を 2 回逐次実行
        const first = await updateOrderPaymentStatus(
            fixture.orderId,
            PaymentStatus.Cancelled
        );
        const second = await updateOrderPaymentStatus(
            fixture.orderId,
            PaymentStatus.Cancelled
        );

        // Assert: 呼び出し元から見て冪等（どちらも throw せず要求 status を返す）
        expect(first).toBe(PaymentStatus.Cancelled);
        expect(second).toBe(PaymentStatus.Cancelled);

        // Assert: 復元は 1 回ぶんのみ（11 = 8 + 3 なら二重復元）
        expect(await stockOf(fixture.sizeId)).toBe(INITIAL_STOCK);

        // Act + Assert: 終端 → 終端の再遷移でも復元は走らない
        const refunded = await updateOrderPaymentStatus(
            fixture.orderId,
            PaymentStatus.Refunded
        );
        expect(refunded).toBe(PaymentStatus.Refunded);
        expect(await stockOf(fixture.sizeId)).toBe(INITIAL_STOCK);
        // 終端済みなので Refunded への遷移自体が起きない（CAS の where に弾かれる）
        const order = await db.order.findUniqueOrThrow({
            where: { id: fixture.orderId },
        });
        expect(order.paymentStatus).toBe(PaymentStatus.Cancelled);
    });

    it("restocks exactly once when two cancellations are dispatched concurrently", async () => {
        // 前提: プールが 1 だと 2 本が接続待ちで直列化され、並行性を検証しないまま緑になる。
        // 「並行を検証できない環境」を silently pass させないため明示的にブロックする。
        expect(resolveConnectionLimit()).toBeGreaterThanOrEqual(2);

        // Arrange: 逐次ケースの注文は使えない（終端済みだと両呼び出しが count === 0 に
        // なり restock が一切走らず、レースを検証しない空テストになる）
        const fixture = await seedPlacedOrder();
        mockAuthAsAdmin();

        // バリア: 2 本が in-flight になってから初めて DB へ進ませる。
        // Promise.all の同時ディスパッチだけには依存しない。
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let arrived = 0;
        const arm = async (): Promise<PaymentStatus> => {
            arrived += 1;
            if (arrived === 2) release();
            await gate;
            return updateOrderPaymentStatus(
                fixture.orderId,
                PaymentStatus.Cancelled
            );
        };

        // Act
        const settled = await Promise.allSettled([arm(), arm()]);

        // Assert: 敗者も含めて 2 本とも fulfill し、要求した status を返す
        expect(settled.map((s) => s.status)).toEqual([
            "fulfilled",
            "fulfilled",
        ]);
        expect(
            settled.map(
                (s) => (s as PromiseFulfilledResult<PaymentStatus>).value
            )
        ).toEqual([PaymentStatus.Cancelled, PaymentStatus.Cancelled]);

        // Assert: 復元は 1 回ぶんのみ（11 なら CAS が壊れている = 本物の回帰）
        expect(await stockOf(fixture.sizeId)).toBe(INITIAL_STOCK);
    });
});

// ============================================================================
// Scenario 3: Refunded transition — Cancelled とのマッピング差分
// ============================================================================

describe("Scenario 3: refund transition cascades with Refunded statuses", () => {
    it("sets Refunded on order/group/item and restores stock", async () => {
        // Arrange
        const fixture = await seedPlacedOrder();
        mockAuthAsAdmin();

        // Act
        const result = await updateOrderPaymentStatus(
            fixture.orderId,
            PaymentStatus.Refunded
        );

        // Assert
        expect(result).toBe(PaymentStatus.Refunded);
        const order = await db.order.findUniqueOrThrow({
            where: { id: fixture.orderId },
        });
        expect(order.paymentStatus).toBe(PaymentStatus.Refunded);
        expect(order.orderStatus).toBe(OrderStatus.Refunded);

        const group = await db.orderGroup.findUniqueOrThrow({
            where: { id: fixture.groupId },
        });
        expect(group.status).toBe(OrderStatus.Refunded);
        const item = await db.orderItem.findUniqueOrThrow({
            where: { id: fixture.itemId },
        });
        expect(item.status).toBe(ProductStatus.Refunded);

        expect(await stockOf(fixture.sizeId)).toBe(INITIAL_STOCK);
    });
});

// ============================================================================
// Scenario 4: 非キャンセル遷移は子連動も復元もしない
// ============================================================================

describe("Scenario 4: non-cancel transition leaves children and stock untouched", () => {
    it("updates only paymentStatus when transitioning to Paid", async () => {
        // Arrange
        const fixture = await seedPlacedOrder();
        mockAuthAsAdmin();

        // Act
        const result = await updateOrderPaymentStatus(
            fixture.orderId,
            PaymentStatus.Paid
        );

        // Assert: paymentStatus だけが動く
        expect(result).toBe(PaymentStatus.Paid);
        const order = await db.order.findUniqueOrThrow({
            where: { id: fixture.orderId },
        });
        expect(order.paymentStatus).toBe(PaymentStatus.Paid);
        expect(order.orderStatus).toBe(OrderStatus.Pending);

        const group = await db.orderGroup.findUniqueOrThrow({
            where: { id: fixture.groupId },
        });
        expect(group.status).toBe(OrderStatus.Pending);
        const item = await db.orderItem.findUniqueOrThrow({
            where: { id: fixture.itemId },
        });
        expect(item.status).toBe(ProductStatus.Pending);

        // Assert: 在庫は減算されたまま（復元されない）
        expect(await stockOf(fixture.sizeId)).toBe(STOCK_AFTER_ORDER);
    });
});

// ============================================================================
// Scenario 5: updateOrderGroupStatusAsAdmin の遷移ガード + 親集約
// ============================================================================

describe("Scenario 5: group-level cancellation restocks that group only", () => {
    it("restocks the canceled group, aggregates the parent, and is idempotent on re-cancel", async () => {
        // Arrange: 1 注文に 2 店舗ぶんの OrderGroup を張る
        const fixture = await seedPlacedOrder();
        const storeB = await seedStore(db, { userId: fixture.userId });
        const { category, subCategory } = await seedCategoryWithSubcategory(db);
        const b = await seedProductWithVariantAndSize(db, {
            storeId: storeB.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            sizePrice: 100,
            sizeQuantity: INITIAL_STOCK,
        });
        await db.size.update({
            where: { id: b.size.id },
            data: { quantity: { decrement: ORDER_QUANTITY } },
        });
        const groupB = await db.orderGroup.create({
            data: {
                orderId: fixture.orderId,
                storeId: storeB.id,
                status: OrderStatus.Pending,
                subTotal: b.size.price.mul(ORDER_QUANTITY),
                shippingFees: b.size.price.mul(0),
                total: b.size.price.mul(ORDER_QUANTITY),
                shippingService: "Standard",
                shippingDeliveryMin: 7,
                shippingDeliveryMax: 14,
            },
        });
        await db.orderItem.create({
            data: {
                orderGroupId: groupB.id,
                productId: b.product.id,
                variantId: b.variant.id,
                sizeId: b.size.id,
                productSlug: b.product.slug,
                variantSlug: b.variant.slug,
                sku: b.variant.sku,
                name: `${b.product.name} - ${b.variant.variantName}`,
                image: b.variant.variantImage,
                size: b.size.size,
                price: b.size.price,
                quantity: ORDER_QUANTITY,
                shippingFee: b.size.price.mul(0),
                totalPrice: b.size.price.mul(ORDER_QUANTITY),
            },
        });

        mockAuthAsAdmin();

        // Act 1: groupA のみキャンセル
        const statusA = await updateOrderGroupStatusAsAdmin(
            fixture.groupId,
            OrderStatus.Canceled
        );

        // Assert 1: groupA の在庫のみ復元、groupB は不変。親は混在なので Processing
        expect(statusA).toBe(OrderStatus.Canceled);
        expect(await stockOf(fixture.sizeId)).toBe(INITIAL_STOCK);
        expect(await stockOf(b.size.id)).toBe(STOCK_AFTER_ORDER);
        const afterA = await db.order.findUniqueOrThrow({
            where: { id: fixture.orderId },
        });
        expect(afterA.orderStatus).toBe(OrderStatus.Processing);

        // Act 2: groupA をもう一度キャンセル（終端 → 終端）
        await updateOrderGroupStatusAsAdmin(
            fixture.groupId,
            OrderStatus.Canceled
        );

        // Assert 2: 追加の復元は起きない（遷移ガードが効いている）
        expect(await stockOf(fixture.sizeId)).toBe(INITIAL_STOCK);

        // Act 3: groupB もキャンセル
        await updateOrderGroupStatusAsAdmin(groupB.id, OrderStatus.Canceled);

        // Assert 3: 全 Canceled になり親も Canceled へ集約される
        expect(await stockOf(b.size.id)).toBe(INITIAL_STOCK);
        const afterB = await db.order.findUniqueOrThrow({
            where: { id: fixture.orderId },
        });
        expect(afterB.orderStatus).toBe(OrderStatus.Canceled);
    });
});

// ============================================================================
// Scenario 6: 認可ガード（両 admin 関数・副作用なし）
// ============================================================================

describe("Scenario 6: non-admin callers are rejected without side effects", () => {
    it("rejects updateOrderPaymentStatus and leaves order/stock unchanged", async () => {
        // Arrange
        const fixture = await seedPlacedOrder();
        mockAuthAsCustomer();

        // Act + Assert
        await expect(
            updateOrderPaymentStatus(fixture.orderId, PaymentStatus.Cancelled)
        ).rejects.toThrow(/Only admins can perform this action/);

        // 副作用なし検証
        const order = await db.order.findUniqueOrThrow({
            where: { id: fixture.orderId },
        });
        expect(order.paymentStatus).toBe(PaymentStatus.Pending);
        expect(order.orderStatus).toBe(OrderStatus.Pending);
        expect(await stockOf(fixture.sizeId)).toBe(STOCK_AFTER_ORDER);
    });

    it("rejects updateOrderGroupStatusAsAdmin and leaves group/item/stock unchanged", async () => {
        // Arrange
        const fixture = await seedPlacedOrder();
        mockAuthAsCustomer();

        // Act + Assert
        await expect(
            updateOrderGroupStatusAsAdmin(fixture.groupId, OrderStatus.Canceled)
        ).rejects.toThrow(/Only admins can perform this action/);

        // 副作用なし検証（片方の関数だけ守られている状態を検出できるようにする）
        const group = await db.orderGroup.findUniqueOrThrow({
            where: { id: fixture.groupId },
        });
        expect(group.status).toBe(OrderStatus.Pending);
        const item = await db.orderItem.findUniqueOrThrow({
            where: { id: fixture.itemId },
        });
        expect(item.status).toBe(ProductStatus.Pending);
        const order = await db.order.findUniqueOrThrow({
            where: { id: fixture.orderId },
        });
        expect(order.orderStatus).toBe(OrderStatus.Pending);
        expect(await stockOf(fixture.sizeId)).toBe(STOCK_AFTER_ORDER);
    });
});
