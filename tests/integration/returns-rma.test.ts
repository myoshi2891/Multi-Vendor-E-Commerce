/**
 * 返品 RMA の実 DB 統合テスト（plan 088 Step 2 / docs/design/returns-rma/design.md）
 *
 * unit テスト（`src/queries/returns.test.ts`）はモックの tx で呼び出しの形を固定する。
 * 次の性質は実 DB でしか観測できないので、ここで確かめる:
 *   - IDOR: 他人の OrderItem を指した申請が拒否され、行が増えない（3 階層のうち (a)(c)。
 *     (b) の「SQL に o."userId" が入っていること」は unit テストが SQL 文字列で固定する）
 *   - 店舗のスコープ・顧客は自分の RMA を承認できないこと
 *   - R-1（数量の上限）の並行時の原子性（FOR UPDATE OF oi）
 *   - R-2（申請の冪等性）と遷移の冪等性
 *   - 在庫復元との差し引き（design §4.3）: 返品 + 返金でちょうど購入数だけ戻る
 *   - 通知の記録（同じ tx）と、送信の失敗が遷移を巻き戻さないこと
 *
 * 関連: ADR-004 / plans/088-implement-returns-rma.md / tests/integration/order-lifecycle.test.ts
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// commit 後に予約された送信を、テストの中で待てるように集めておく（notification-outbox と同じ）
const pendingAfter: Promise<unknown>[] = [];
jest.mock("next/server", () => ({
    after: (callback: () => Promise<unknown>) => {
        pendingAfter.push(callback());
    },
}));

// ----------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import { OrderStatus, PaymentStatus, ProductStatus } from "@/lib/types";
import { updateOrderPaymentStatus } from "@/queries/order";
import {
    approveReturnRequest,
    cancelReturnRequest,
    createReturnRequest,
    receiveReturnRequest,
    rejectReturnRequest,
    resolveReturnRequest,
} from "@/queries/returns";
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

/** Arrange の共通値: 初期在庫 8 / 購入数 3 → 注文直後の在庫は 5 */
const INITIAL_STOCK = 8;
const ORDER_QUANTITY = 3;
const STOCK_AFTER_ORDER = INITIAL_STOCK - ORDER_QUANTITY;

type Role = "USER" | "SELLER" | "ADMIN";

function mockAuthAs(userId: string, role: Role): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        privateMetadata: { role },
    });
}

interface DeliveredOrderFixture {
    customerId: string;
    sellerId: string;
    storeId: string;
    storeUrl: string;
    orderId: string;
    groupId: string;
    itemId: string;
    sizeId: string;
}

/**
 * 顧客が 3 個買い、配達済み（Delivered）になった注文を 1 件作る。
 * 在庫は注文確定時の減算を模して 8 → 5 にしておく（order-lifecycle と同じ）。
 */
async function seedDeliveredOrder(
    storeOverrides: { acceptsReturns?: boolean; returnWindowDays?: number } = {}
): Promise<DeliveredOrderFixture> {
    const seller = await seedUser(db);
    const customer = await seedUser(db);
    const country = await seedCountry(db);
    const address = await seedShippingAddress(db, {
        userId: customer.id,
        countryId: country.id,
    });
    const store = await seedStore(db, {
        userId: seller.id,
        overrides: storeOverrides,
    });
    const { category, subCategory } = await seedCategoryWithSubcategory(db);
    const { product, variant, size } = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        sizePrice: 100,
        sizeQuantity: INITIAL_STOCK,
    });
    await db.size.update({
        where: { id: size.id },
        data: { quantity: { decrement: ORDER_QUANTITY } },
    });
    const { order, group, item } = await seedOrderWithGroupAndItem(db, {
        userId: customer.id,
        shippingAddressId: address.id,
        storeId: store.id,
        product,
        variant,
        size,
        quantity: ORDER_QUANTITY,
        paymentStatus: PaymentStatus.Paid,
        groupStatus: OrderStatus.Delivered,
    });
    await db.orderItem.update({
        where: { id: item.id },
        data: { status: ProductStatus.Delivered },
    });

    return {
        customerId: customer.id,
        sellerId: seller.id,
        storeId: store.id,
        storeUrl: store.url,
        orderId: order.id,
        groupId: group.id,
        itemId: item.id,
        sizeId: size.id,
    };
}

/** 申請の入力を組み立てる（キーは毎回新しく作る） */
function buildRequest(
    f: DeliveredOrderFixture,
    quantity: number,
    idempotencyKey: string = randomUUID()
) {
    return {
        orderGroupId: f.groupId,
        idempotencyKey,
        resolution: "REFUND" as const,
        items: [
            {
                orderItemId: f.itemId,
                quantity,
                reasonCode: "SIZE_FIT" as const,
            },
        ],
    };
}

/** 顧客として申請し、seller として承認まで進める */
async function createApproved(
    f: DeliveredOrderFixture,
    quantity: number
): Promise<string> {
    mockAuthAs(f.customerId, "USER");
    const rma = await createReturnRequest(buildRequest(f, quantity));
    mockAuthAs(f.sellerId, "SELLER");
    await approveReturnRequest(f.storeUrl, rma.id);
    return rma.id;
}

/** 受け取りの入力（全明細を同じ状態にする） */
async function conditionsFor(
    rmaId: string,
    condition: "RESELLABLE" | "DAMAGED"
) {
    const items = await db.returnRequestItem.findMany({
        where: { returnRequestId: rmaId },
        select: { id: true },
    });
    return items.map((item) => ({ returnRequestItemId: item.id, condition }));
}

async function stockOf(sizeId: string): Promise<number> {
    const size = await db.size.findUniqueOrThrow({ where: { id: sizeId } });
    return size.quantity;
}

afterAll(async () => {
    await disconnectTestDb();
});

beforeEach(async () => {
    await resetDb(db);
    (currentUser as unknown as jest.Mock).mockReset();
    pendingAfter.length = 0;
    jest.restoreAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

describe("createReturnRequest の認可と IDOR", () => {
    it("他人の OrderItem を指した申請は 'Order item not found' で拒否され、RMA は作られない", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        const intruder = await seedUser(db);
        mockAuthAs(intruder.id, "USER");

        // Act & Assert —— (a) 拒否の理由は「存在しない」と同じ
        await expect(createReturnRequest(buildRequest(f, 1))).rejects.toThrow(
            "Order item not found"
        );

        // (c) 副作用なし
        expect(await db.returnRequest.count()).toBe(0);
        expect(await db.returnRequestItem.count()).toBe(0);
        expect(await db.notification.count()).toBe(0);
    });

    it("idempotencyKey を省略した申請は Zod で拒否される", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");
        const { idempotencyKey: _omitted, ...withoutKey } = buildRequest(f, 1);

        // Act & Assert
        await expect(
            createReturnRequest(
                withoutKey as Parameters<typeof createReturnRequest>[0]
            )
        ).rejects.toThrow();
        expect(await db.returnRequest.count()).toBe(0);
    });
});

describe("遷移の権限", () => {
    it("別店舗の seller は承認できず、状態は REQUESTED のまま", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        const other = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");
        const rma = await createReturnRequest(buildRequest(f, 1));
        mockAuthAs(other.sellerId, "SELLER");

        // Act & Assert
        await expect(
            approveReturnRequest(other.storeUrl, rma.id)
        ).rejects.toThrow("Return request not found.");
        const after = await db.returnRequest.findUniqueOrThrow({
            where: { id: rma.id },
        });
        expect(after.status).toBe("REQUESTED");
        expect(after.approvedAt).toBeNull();
    });

    it("顧客は自分の RMA を承認・受け取り・解決できない", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");
        const rma = await createReturnRequest(buildRequest(f, 1));

        // Act & Assert —— seller 用の action は requireSeller で弾かれる
        await expect(approveReturnRequest(f.storeUrl, rma.id)).rejects.toThrow(
            "Only sellers can perform this action."
        );
        await expect(
            receiveReturnRequest(f.storeUrl, rma.id, [])
        ).rejects.toThrow("Only sellers can perform this action.");
        await expect(resolveReturnRequest(f.storeUrl, rma.id)).rejects.toThrow(
            "Only sellers can perform this action."
        );
        const after = await db.returnRequest.findUniqueOrThrow({
            where: { id: rma.id },
        });
        expect(after.status).toBe("REQUESTED");
    });
});

describe("R-1: 数量の上限", () => {
    it("購入数 3 に対して 2 個と 2 個を同時に申請すると、片方だけが成功する", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");

        // Act
        const results = await Promise.allSettled([
            createReturnRequest(buildRequest(f, 2)),
            createReturnRequest(buildRequest(f, 2)),
        ]);

        // Assert
        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter(
            (r): r is PromiseRejectedResult => r.status === "rejected"
        );
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(String(rejected[0]?.reason)).toContain(
            "Return quantity exceeds purchased quantity."
        );
        expect(await db.returnRequest.count()).toBe(1);
    });

    it("却下された RMA の数量は上限の計算に含めない", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");
        const first = await createReturnRequest(buildRequest(f, 3));
        mockAuthAs(f.sellerId, "SELLER");
        await rejectReturnRequest(f.storeUrl, first.id, "Outside policy");
        mockAuthAs(f.customerId, "USER");

        // Act
        const second = await createReturnRequest(buildRequest(f, 3));

        // Assert
        expect(second.id).not.toBe(first.id);
        expect(second.status).toBe("REQUESTED");
    });
});

describe("R-2: 申請の冪等性", () => {
    it("同じキー・同じ内容の再送は同じ RMA を返し、行は 1 件のまま", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");
        const key = randomUUID();

        // Act —— 全数（3 個）でも、再送が R-1 で弾かれずに既存を返すこと
        const first = await createReturnRequest(buildRequest(f, 3, key));
        const second = await createReturnRequest(buildRequest(f, 3, key));

        // Assert
        expect(second.id).toBe(first.id);
        expect(await db.returnRequest.count()).toBe(1);
        expect(await db.notification.count()).toBe(1);
    });

    it("同じキーで内容を変えると拒否される", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");
        const key = randomUUID();
        await createReturnRequest(buildRequest(f, 1, key));

        // Act & Assert
        await expect(
            createReturnRequest(buildRequest(f, 2, key))
        ).rejects.toThrow(
            "Idempotency key was reused with a different request."
        );
        expect(await db.returnRequest.count()).toBe(1);
    });
});

describe("遷移の冪等性と通知", () => {
    it("申請で seller に rma.requested、承認で顧客に rma.approved が記録される", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");

        // Act
        const rma = await createReturnRequest(buildRequest(f, 1));
        mockAuthAs(f.sellerId, "SELLER");
        await approveReturnRequest(f.storeUrl, rma.id);
        await Promise.all(pendingAfter);

        // Assert
        const notifications = await db.notification.findMany({
            orderBy: { createdAt: "asc" },
        });
        expect(notifications.map((n) => [n.type, n.userId])).toEqual([
            ["rma.requested", f.sellerId],
            ["rma.approved", f.customerId],
        ]);
        expect(
            notifications.every((n) => n.sourceType === "ReturnRequest")
        ).toBe(true);
    });

    it("承認を 2 回実行しても approvedAt と通知は 1 回だけ", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        const rmaId = await createApproved(f, 1);
        const once = await db.returnRequest.findUniqueOrThrow({
            where: { id: rmaId },
        });

        // Act —— 2 回目は「すでに APPROVED」なので副作用なしで同じ状態を返す
        const status = await approveReturnRequest(f.storeUrl, rmaId);

        // Assert
        expect(status).toBe("APPROVED");
        const twice = await db.returnRequest.findUniqueOrThrow({
            where: { id: rmaId },
        });
        expect(twice.approvedAt?.getTime()).toBe(once.approvedAt?.getTime());
        expect(
            await db.notification.count({ where: { type: "rma.approved" } })
        ).toBe(1);
    });

    it("送信のプロバイダが失敗しても、RMA の遷移は残る", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");
        const previous = process.env.EMAIL_PROVIDER;
        process.env.EMAIL_PROVIDER = "broken-provider";
        jest.spyOn(console, "error").mockImplementation(() => {});

        try {
            // Act
            const rma = await createReturnRequest(buildRequest(f, 1));
            await Promise.all(pendingAfter);

            // Assert
            const after = await db.returnRequest.findUniqueOrThrow({
                where: { id: rma.id },
            });
            expect(after.status).toBe("REQUESTED");
            expect(await db.notification.count()).toBe(1);
        } finally {
            if (previous === undefined) delete process.env.EMAIL_PROVIDER;
            else process.env.EMAIL_PROVIDER = previous;
        }
    });

    it("顧客は REQUESTED の RMA を取り下げられ、seller に rma.canceled が記録される", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        mockAuthAs(f.customerId, "USER");
        const rma = await createReturnRequest(buildRequest(f, 1));

        // Act
        const status = await cancelReturnRequest(rma.id);

        // Assert
        expect(status).toBe("CANCELED");
        const canceled = await db.notification.findFirstOrThrow({
            where: { type: "rma.canceled" },
        });
        expect(canceled.userId).toBe(f.sellerId);
    });
});

describe("在庫復元との差し引き（design §4.3）", () => {
    it("1 個を RESELLABLE で受け取ると +1、その後に注文を返金すると +2 で、合計ちょうど +3", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        const rmaId = await createApproved(f, 1);

        // Act 1 —— 受け取り
        await receiveReturnRequest(
            f.storeUrl,
            rmaId,
            await conditionsFor(rmaId, "RESELLABLE")
        );

        // Assert 1
        expect(await stockOf(f.sizeId)).toBe(STOCK_AFTER_ORDER + 1);

        // Act 2 —— 注文全体の返金（087 の settleOrderItems 経由）
        mockAuthAs("admin-integration", "ADMIN");
        await updateOrderPaymentStatus(f.orderId, PaymentStatus.Refunded);

        // Assert 2
        expect(await stockOf(f.sizeId)).toBe(INITIAL_STOCK);
    });

    it("DAMAGED で受け取ると在庫は戻らず、その後の返金でもその 1 個は戻らない", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        const rmaId = await createApproved(f, 1);

        // Act
        await receiveReturnRequest(
            f.storeUrl,
            rmaId,
            await conditionsFor(rmaId, "DAMAGED")
        );
        const afterReceive = await stockOf(f.sizeId);
        mockAuthAs("admin-integration", "ADMIN");
        await updateOrderPaymentStatus(f.orderId, PaymentStatus.Refunded);

        // Assert
        expect(afterReceive).toBe(STOCK_AFTER_ORDER);
        expect(await stockOf(f.sizeId)).toBe(INITIAL_STOCK - 1);
        const item = await db.returnRequestItem.findFirstOrThrow({
            where: { returnRequestId: rmaId },
        });
        expect(item.condition).toBe("DAMAGED");
        expect(item.restockedQuantity).toBe(0);
    });

    it("先に注文が返金で終端になっていれば、受け取りで在庫を戻さない（restockedQuantity = 0）", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        const rmaId = await createApproved(f, 1);
        mockAuthAs("admin-integration", "ADMIN");
        await updateOrderPaymentStatus(f.orderId, PaymentStatus.Refunded);
        expect(await stockOf(f.sizeId)).toBe(INITIAL_STOCK);
        mockAuthAs(f.sellerId, "SELLER");

        // Act
        await receiveReturnRequest(
            f.storeUrl,
            rmaId,
            await conditionsFor(rmaId, "RESELLABLE")
        );

        // Assert
        expect(await stockOf(f.sizeId)).toBe(INITIAL_STOCK);
        const item = await db.returnRequestItem.findFirstOrThrow({
            where: { returnRequestId: rmaId },
        });
        expect(item.restockedQuantity).toBe(0);
    });

    it("全数を解決すると OrderItem は Returned になり、在庫は二重に戻らない", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        const rmaId = await createApproved(f, ORDER_QUANTITY);
        await receiveReturnRequest(
            f.storeUrl,
            rmaId,
            await conditionsFor(rmaId, "RESELLABLE")
        );

        // Act
        const status = await resolveReturnRequest(f.storeUrl, rmaId);
        mockAuthAs("admin-integration", "ADMIN");
        await updateOrderPaymentStatus(f.orderId, PaymentStatus.Refunded);

        // Assert
        expect(status).toBe("RESOLVED");
        const item = await db.orderItem.findUniqueOrThrow({
            where: { id: f.itemId },
        });
        expect(item.status).toBe(ProductStatus.Returned);
        expect(await stockOf(f.sizeId)).toBe(INITIAL_STOCK);
        const rma = await db.returnRequest.findUniqueOrThrow({
            where: { id: rmaId },
        });
        // 単価 100 × 3 個（送料・クーポンは含めない・design §5）
        expect(rma.refundAmount?.toFixed(2)).toBe("300.00");
        expect(rma.resolvedAt).not.toBeNull();
    });
});

describe("適格性（design §6）", () => {
    it("Delivered でない item は申請できない", async () => {
        // Arrange
        const f = await seedDeliveredOrder();
        await db.orderItem.update({
            where: { id: f.itemId },
            data: { status: ProductStatus.Shipped },
        });
        mockAuthAs(f.customerId, "USER");

        // Act & Assert
        await expect(createReturnRequest(buildRequest(f, 1))).rejects.toThrow(
            "Order item is not eligible for return."
        );
    });

    it("返品の期限を過ぎた item は申請できない", async () => {
        // Arrange —— 期限 = createdAt + shippingDeliveryMax(14) + returnWindowDays(1)
        const f = await seedDeliveredOrder({ returnWindowDays: 1 });
        await db.order.update({
            where: { id: f.orderId },
            data: {
                createdAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
            },
        });
        mockAuthAs(f.customerId, "USER");

        // Act & Assert
        await expect(createReturnRequest(buildRequest(f, 1))).rejects.toThrow(
            "Order item is not eligible for return."
        );
    });

    it("acceptsReturns = false の店舗には申請できない", async () => {
        // Arrange
        const f = await seedDeliveredOrder({ acceptsReturns: false });
        mockAuthAs(f.customerId, "USER");

        // Act & Assert
        await expect(createReturnRequest(buildRequest(f, 1))).rejects.toThrow(
            "Order item is not eligible for return."
        );
        expect(await db.returnRequest.count()).toBe(0);
    });
});
