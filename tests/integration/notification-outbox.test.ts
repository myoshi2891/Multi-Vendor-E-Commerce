/**
 * 通知の原子的 Outbox の実 DB 統合テスト（plan 086 / design §4）
 *
 * unit テストはモックの tx で「呼び出しの順序」を固定するが、次の 3 点は実 DB でしか観測できない:
 *   1. 状態の更新と同じ tx で Notification / NotificationDelivery が実際に書かれる
 *   2. dedupeKey の一意制約が、同じ遷移の再処理で行を増やさない（skipDuplicates）
 *   3. 通知の記録が失敗したら、OrderGroup.status の更新もロールバックされる
 *
 * `after()` はリクエストの外では使えないので、コールバックをその場で実行する mock に差し替え、
 * commit 後の送信（stub プロバイダ）まで通して確認する。
 *
 * 関連: ADR-004 / docs/design/notification-foundation/design.md / plans/086
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// commit 後に予約された送信を、テストの中で待てるように集めておく
const pendingAfter: Promise<unknown>[] = [];
jest.mock("next/server", () => ({
    after: (callback: () => Promise<unknown>) => {
        pendingAfter.push(callback());
    },
}));

// ----------------------------------------------------------------------------

import { currentUser } from "@clerk/nextjs/server";
import { OrderStatus } from "@/lib/types";
import * as recordModule from "@/lib/notifications/record";
import { updateOrderGroupStatus } from "@/queries/order";
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

/** 販売者（店舗オーナー）と顧客を分けて、Processing の注文を 1 件作る */
async function seedProcessingOrder() {
    const seller = await seedUser(db);
    const customer = await seedUser(db);
    const country = await seedCountry(db);
    const address = await seedShippingAddress(db, {
        userId: customer.id,
        countryId: country.id,
    });
    const store = await seedStore(db, { userId: seller.id });
    const { category, subCategory } = await seedCategoryWithSubcategory(db);
    const { product, variant, size } = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        sizePrice: 100,
        sizeQuantity: 5,
    });
    const { order, group } = await seedOrderWithGroupAndItem(db, {
        userId: customer.id,
        shippingAddressId: address.id,
        storeId: store.id,
        product,
        variant,
        size,
        groupStatus: OrderStatus.Processing,
    });

    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: seller.id,
        privateMetadata: { role: "SELLER" },
    });

    return { seller, customer, store, order, group };
}

afterAll(async () => {
    await disconnectTestDb();
});

beforeEach(async () => {
    await resetDb(db);
    (currentUser as unknown as jest.Mock).mockReset();
    pendingAfter.length = 0;
    jest.restoreAllMocks();
});

describe("OrderGroup の発送通知（原子的 Outbox）", () => {
    it("Shipped への遷移で顧客宛ての通知と配信行を書き、commit 後に送信して SENT にする", async () => {
        // Arrange
        const { customer, store, order, group } = await seedProcessingOrder();

        // Act
        const status = await updateOrderGroupStatus(
            store.id,
            group.id,
            OrderStatus.Shipped
        );
        await Promise.all(pendingAfter);

        // Assert
        expect(status).toBe(OrderStatus.Shipped);
        const notifications = await db.notification.findMany({
            include: { deliveries: true },
        });
        expect(notifications).toHaveLength(1);
        expect(notifications[0]).toMatchObject({
            userId: customer.id,
            type: "order.group.shipped",
            sourceType: "OrderGroup",
            sourceId: group.id,
            linkUrl: `/order/${order.id}`,
            isRead: false,
        });
        expect(notifications[0]?.deliveries).toHaveLength(1);
        expect(notifications[0]?.deliveries[0]).toMatchObject({
            channel: "email",
            status: "SENT",
            attemptCount: 1,
        });
        expect(notifications[0]?.deliveries[0]?.sentAt).not.toBeNull();
    });

    it("同じ遷移をやり直しても行は増えない（dedupeKey の一意制約）", async () => {
        // Arrange
        const { store, group } = await seedProcessingOrder();
        await updateOrderGroupStatus(store.id, group.id, OrderStatus.Shipped);
        await Promise.all(pendingAfter);

        // Act —— 差し戻してからもう一度 Shipped にする（design §2.2 の既知のトレードオフ）
        await updateOrderGroupStatus(
            store.id,
            group.id,
            OrderStatus.Processing
        );
        await updateOrderGroupStatus(store.id, group.id, OrderStatus.Shipped);
        await Promise.all(pendingAfter);

        // Assert
        expect(await db.notification.count()).toBe(1);
        expect(await db.notificationDelivery.count()).toBe(1);
    });

    it("通知の記録が失敗したら、OrderGroup.status の更新もロールバックする", async () => {
        // Arrange
        const { store, group } = await seedProcessingOrder();
        jest.spyOn(recordModule, "recordNotifications").mockRejectedValueOnce(
            new Error("notification write failed")
        );
        jest.spyOn(console, "error").mockImplementation(() => {});

        // Act & Assert
        await expect(
            updateOrderGroupStatus(store.id, group.id, OrderStatus.Shipped)
        ).rejects.toThrow("Failed to update order group status.");

        const after = await db.orderGroup.findUniqueOrThrow({
            where: { id: group.id },
        });
        expect(after.status).toBe(OrderStatus.Processing);
        expect(await db.notification.count()).toBe(0);
        expect(pendingAfter).toHaveLength(0);
    });
});
