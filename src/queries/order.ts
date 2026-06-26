"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { OrderStatus, PaymentStatus, ProductStatus } from "@/lib/types";
import { TrackOrderSchema, type TrackOrderInput } from "@/lib/schemas";
import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * 在庫復元（F3-5）の対象とみなす終端 OrderStatus 判定。
 * Canceled / Refunded への遷移時のみ在庫を戻す。
 */
const isRestockTerminalOrderStatus = (status: OrderStatus | undefined): boolean =>
    status === OrderStatus.Canceled || status === OrderStatus.Refunded;

/**
 * 減算済み在庫を復元する（placeOrder の decrement の対）。
 * 各 OrderItem の quantity を対応する Size.quantity に increment で戻す。
 * 呼び出し側で「非終端 → 終端」の遷移ガードを通すこと（二重復元を防ぐ）。
 */
const restockOrderItems = async (
    tx: OrderTransactionClient,
    items: { sizeId: string; quantity: number }[]
): Promise<void> => {
    for (const item of items) {
        await tx.size.update({
            where: { id: item.sizeId },
            data: { quantity: { increment: item.quantity } },
        });
    }
};

/**
 * @Function getOrder
 * @Description Retrieves a specific order by its ID and the current user's ID, including associated groups, items, store information, item count, and shipping address
 * @Parameters
 *  - params: orderId.
 * @returns Object containing the order details with groups sorted by totalPrice in descending order.
 */

export const getOrder = async (orderId: string) => {
    // Retrieve the current user
    const user = await currentUser();

    // Ensure the user is authenticated
    if (!user) throw new Error("Unauthenticated.");

    // Get order details with groups, product items, and ordered by total price
    const order = await db.order.findUnique({
        where: {
            id: orderId,
            userId: user.id,
        },
        include: {
            groups: {
                include: {
                    items: true,
                    store: true,
                    coupon: true,
                    _count: {
                        select: {
                            items: true,
                        },
                    },
                },
                orderBy: {
                    total: "desc",
                },
            },
            shippingAddress: {
                include: {
                    country: true,
                    user: true,
                },
            },
            paymentDetails: true,
        },
    });

    return order;
};

/**
 * 注文番号 + メールで配送状況を照会する公開アクション。
 *
 * 本人性は orderId が示す注文の所有者 User.email と入力 email の一致で確認する
 * （ゲスト注文は無く email は User.email のみ・schema.prisma:18-39, 498-525）。
 *
 * IDOR/列挙防止: 注文の不存在と email 不一致を区別せず、どちらも null を返す。
 * where は { id: orderId } のみとし、email 照合は取得後にアプリ層で行う（副作用なし）。
 *
 * @param input - { orderId, email }。Zod で検証する。
 * @returns 追跡データ（order/group/item ステータス）または null（不一致/不存在/不正入力）
 * @throws 一過性の DB/インフラ障害時。null（真の不一致/不存在）と区別するため握り潰さず再 throw する。
 */
export const trackOrder = async (input: TrackOrderInput) => {
    // 入力検証（不正入力も「見つからない」と同等に null）。
    const parsed = TrackOrderSchema.safeParse(input);
    if (!parsed.success) return null;
    const { orderId, email } = parsed.data;

    try {
        const order = await db.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { email: true } },
                groups: {
                    include: {
                        items: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                quantity: true,
                                status: true,
                            },
                        },
                        store: { select: { name: true, url: true } },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        // 不存在・email 不一致を同一応答（null）にする（列挙防止）。
        if (!order) return null;
        if (order.user.email.toLowerCase() !== email.toLowerCase()) return null;

        // email を結果から除去して返す（PII を結果に残さない）。
        const { user: _user, ...rest } = order;
        return rest;
    } catch (error: unknown) {
        if (error instanceof Error) {
            // email/orderId 等の PII はログしない。
            console.error("[Order:trackOrder] lookup failed", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error("[Order:trackOrder] lookup failed (unknown)", {
                error,
            });
        }
        // 一過性のインフラ障害を「見つからない(null)」に変換しない。
        // null は真の不一致/不存在/不正入力のみに限定し、DB 障害は呼び出し側へ伝播させる
        // （UI 側で not-found ではなく汎用の再試行メッセージを出すため）。PII は含めない。
        throw new Error("注文の照会に失敗しました。時間をおいて再度お試しください。");
    }
};

/**
 * @function updateOrderGroupStatus
 * @description - Updates the status of a specified order group.
 *              - Throws an error if the user is not authenticated or lacks seller privileges.
 * @access User
 * @param storeId - The store id of the seller to verify ownership.
 * @param groupId - The ID of the order group whose status is to be updated.
 * @param status - The new status to be set for the order.
 * @returns {Object} - Updated order status.
 */

export const updateOrderGroupStatus = async (
    storeId: string,
    groupId: string,
    status: OrderStatus
) => {
    // Retrieve the current user
    const user = await currentUser();

    // Ensure user is authenticated
    if (!user) throw new Error("Unauthenticated.");

    // Ensure user has seller privileges
    if (user.privateMetadata.role !== "SELLER")
        throw new Error("Only sellers can perform this action.");

    // Ensure the user is a seller of the specified store
    const store = await db.store.findUnique({
        where: {
            id: storeId,
            userId: user.id,
        },
    });

    // Verify ownership of the store
    if (!store) {
        throw new Error("Unauthorized to update order group status.");
    }

    // Retrieve the order to be updated
    const order = await db.orderGroup.findUnique({
        where: {
            id: groupId,
            storeId: storeId,
        },
    });

    // Ensure order existence
    if (!order) {
        throw new Error("Order not found");
    }

    // Update the order status
    const updatedOrder = await db.orderGroup.update({
        where: {
            id: groupId,
        },
        data: {
            status,
        },
    });

    return updatedOrder.status;
};

/**
 * @function updateOrderItemStatus
 * @description -
 *              -
 * @access User
 * @param storeId -
 * @param orderItemId -
 * @param status -
 * @returns {Object} -
 */

export const updateOrderItemStatus = async (
    storeId: string,
    orderItemId: string,
    status: ProductStatus
) => {
    // Retrieve the current user
    const user = await currentUser();

    // Ensure user is authenticated
    if (!user) throw new Error("Unauthenticated.");

    // Ensure user has seller privileges
    if (user.privateMetadata.role !== "SELLER")
        throw new Error("Only sellers can perform this action.");

    // Ensure the user is a seller of the specified store
    const store = await db.store.findUnique({
        where: {
            id: storeId,
            userId: user.id,
        },
    });

    // Verify ownership of the store
    if (!store) {
        throw new Error("Unauthorized to update order item status.");
    }

    // Retrieve the product item to be updated
    const product = await db.orderItem.findUnique({
        where: {
            id: orderItemId,
        },
    });

    // Ensure product existence
    if (!product) {
        throw new Error("Order item not found");
    }

    // Update the order status
    const updatedProduct = await db.orderItem.update({
        where: {
            id: orderItemId,
        },
        data: {
            status,
        },
    });

    return updatedProduct.status;
};

// ==================================================================
// Admin（全店舗横断）の注文 query 群
//   - すべて冒頭で requireAdmin() を呼ぶ（多層防御・NFR-1）
//   - 既存 seller 版（getOrder / updateOrderGroupStatus 等）は温存
//   - 在庫連動はスコープ外。各 action に TODO コメントのフック位置のみ残す
// ==================================================================

/**
 * admin 注文一覧のフィルタ（F2-4/F2-5・判断6-5）。
 * paymentStatus / orderStatus は nativeEnum で入口検証し、下流の as キャストを排除する。
 * limit は上限 100 にキャップして OOM/DoS を防止する。
 */
const AdminOrderFilterSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    orderStatus: z.nativeEnum(OrderStatus).optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    // limit は throw ではなく clamp（≤100）でキャップし、極端値を 100 に丸める（AC-F2-3）
    limit: z
        .number()
        .default(20)
        .transform((n) => Math.min(Math.max(Math.floor(n), 1), 100)),
});

/**
 * @function getAllOrders
 * @description 全店舗横断の注文一覧（Order 起点）。requireAdmin() で保護。
 *              seller 版が OrderGroup 起点・自店舗限定なのに対し、Order 起点・横断で取得する。
 * @access ADMIN
 * @param filters paymentStatus / orderStatus / search / page / limit（limit は ≤100 にキャップ）
 * @returns { orders, total, page, limit }
 */
export const getAllOrders = async (
    filters?: Partial<z.infer<typeof AdminOrderFilterSchema>>
) => {
    await requireAdmin();
    const f = AdminOrderFilterSchema.parse(filters ?? {});
    try {
        const where: Prisma.OrderWhereInput = {
            ...(f.paymentStatus ? { paymentStatus: f.paymentStatus } : {}),
            ...(f.orderStatus ? { orderStatus: f.orderStatus } : {}),
            ...(f.search ? { id: { contains: f.search } } : {}),
        };

        const [orders, total] = await Promise.all([
            db.order.findMany({
                where,
                include: {
                    groups: {
                        include: { items: true, store: true, coupon: true },
                    },
                    shippingAddress: {
                        include: { country: true, user: true },
                    },
                    paymentDetails: true,
                },
                orderBy: { createdAt: "desc" },
                skip: (f.page - 1) * f.limit,
                take: f.limit,
            }),
            db.order.count({ where }),
        ]);

        return { orders, total, page: f.page, limit: f.limit };
    } catch (error: unknown) {
        console.error("[Order:getAllOrders] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error("Failed to fetch orders.");
    }
};

/**
 * @function getOrderForAdmin
 * @description 注文詳細を取得する（userId フィルタ無し）。requireAdmin() で保護。
 *              既存 getOrder は `where:{ id, userId }` で自分限定のため、admin 用に別途必要（F2-6）。
 * @access ADMIN
 * @param orderId 取得する注文 ID
 * @returns 注文詳細（groups / items / store / shippingAddress / paymentDetails 含む）または null
 */
export const getOrderForAdmin = async (orderId: string) => {
    await requireAdmin();
    try {
        // include は getOrder と同形だが where から userId を外す（全店舗横断の閲覧）
        return await db.order.findUnique({
            where: { id: orderId },
            include: {
                groups: {
                    include: {
                        items: true,
                        store: true,
                        coupon: true,
                        _count: { select: { items: true } },
                    },
                    orderBy: { total: "desc" },
                },
                shippingAddress: {
                    include: { country: true, user: true },
                },
                paymentDetails: true,
            },
        });
    } catch (error: unknown) {
        console.error("[Order:getOrderForAdmin] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error("Failed to fetch order.");
    }
};

/**
 * 子 OrderGroup 群の状態から親 Order.orderStatus を集約導出して更新する（判断6-2 / design §3.2）。
 * 同一トランザクション接続（tx）上で実行し、子→親の整合をアトミックに保つ。
 *
 * 集約規則:
 *   - すべて Delivered            → Delivered
 *   - すべて Shipped              → Shipped
 *   - 一部のみ Shipped/Delivered  → PartiallyShipped
 *   - すべて Canceled             → Canceled
 *   - すべて Refunded             → Refunded
 *   - それ以外（混在/Pending 等） → Processing（決定論的に集約）
 *
 * @param tx db.$transaction のトランザクションクライアント
 * @param orderId 親 Order の ID
 */
// db.$transaction のコールバックが受け取る tx の型（Accelerate 拡張済みクライアント）。
// 素の Prisma.TransactionClient とは非互換のため、$transaction から導出して再利用する。
type OrderTransactionClient = Parameters<
    Parameters<typeof db.$transaction>[0]
>[0];

const reconcileParentOrderStatus = async (
    tx: OrderTransactionClient,
    orderId: string
): Promise<void> => {
    const groups = await tx.orderGroup.findMany({
        where: { orderId },
        select: { status: true },
    });
    if (groups.length === 0) return;

    const statuses = groups.map((g) => g.status);
    const every = (s: OrderStatus) => statuses.every((x) => x === s);
    const some = (s: OrderStatus) => statuses.some((x) => x === s);

    let parent: OrderStatus;
    if (every(OrderStatus.Delivered)) {
        parent = OrderStatus.Delivered;
    } else if (every(OrderStatus.Shipped)) {
        parent = OrderStatus.Shipped;
    } else if (every(OrderStatus.Canceled)) {
        parent = OrderStatus.Canceled;
    } else if (every(OrderStatus.Refunded)) {
        parent = OrderStatus.Refunded;
    } else if (some(OrderStatus.Shipped) || some(OrderStatus.Delivered)) {
        parent = OrderStatus.PartiallyShipped;
    } else {
        parent = OrderStatus.Processing;
    }

    await tx.order.update({
        where: { id: orderId },
        data: { orderStatus: parent },
    });
};

/**
 * @function updateOrderGroupStatusAsAdmin
 * @description 店舗所有権チェック無しで OrderGroup.status を更新し、親 Order を集約連動する（F2-7）。
 *              requireAdmin() で保護。$transaction で子更新と親連動をアトミック化（NFR-6・判断6-2）。
 * @access ADMIN
 * @param groupId 更新する OrderGroup の ID
 * @param status 新しい OrderStatus
 * @returns 更新後の OrderStatus
 */
export const updateOrderGroupStatusAsAdmin = async (
    groupId: string,
    status: OrderStatus
): Promise<OrderStatus> => {
    const admin = await requireAdmin();
    try {
        return await db.$transaction(async (tx) => {
            // F3-5 在庫復元の遷移ガード用に、更新前の status と items を取得する
            const prev = await tx.orderGroup.findUnique({
                where: { id: groupId },
                select: {
                    status: true,
                    items: { select: { sizeId: true, quantity: true } },
                },
            });

            const group = await tx.orderGroup.update({
                where: { id: groupId },
                data: { status },
                select: { id: true, orderId: true, status: true },
            });

            // 子 OrderGroup 群から親 Order.orderStatus を集約更新（判断6-2）
            await reconcileParentOrderStatus(tx, group.orderId);

            // 監査ログ（NFR-5・判断5-3。console.log 禁止のため console.error を構造化ログに使用）
            console.error(
                `[Admin:updateOrderGroupStatus] actor=${admin.id} target=${groupId} to=${status}`
            );

            // F3-5: 非終端 → Canceled/Refunded の遷移時のみ在庫を復元（二重復元防止）
            if (
                !isRestockTerminalOrderStatus(
                    prev?.status as OrderStatus | undefined
                ) &&
                isRestockTerminalOrderStatus(status)
            ) {
                await restockOrderItems(tx, prev?.items ?? []);
            }

            return group.status as OrderStatus;
        });
    } catch (error: unknown) {
        console.error("[Order:updateOrderGroupStatusAsAdmin] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error instanceof Error
            ? error
            : new Error("Failed to update order group status.");
    }
};

/**
 * @function updateOrderItemStatusAsAdmin
 * @description 店舗所有権チェック無しで OrderItem.status（ProductStatus）を更新（F2-8）。
 *              配送/履行ステータスの手動変更であり決済とは無関係（決済 API 警告は UI 層の責務）。
 * @access ADMIN
 * @param orderItemId 更新する OrderItem の ID
 * @param status 新しい ProductStatus
 * @returns 更新後の ProductStatus
 */
export const updateOrderItemStatusAsAdmin = async (
    orderItemId: string,
    status: ProductStatus
): Promise<ProductStatus> => {
    const admin = await requireAdmin();
    try {
        const updated = await db.orderItem.update({
            where: { id: orderItemId },
            data: { status },
            select: { status: true },
        });

        // 監査ログ（NFR-5・判断5-3）
        console.error(
            `[Admin:updateOrderItemStatus] actor=${admin.id} target=${orderItemId} to=${status}`
        );

        // TODO(在庫連動・スコープ外): status が Canceled/Returned のとき在庫復元フックをここに（判断5-2）

        return updated.status as ProductStatus;
    } catch (error: unknown) {
        console.error("[Order:updateOrderItemStatusAsAdmin] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error instanceof Error
            ? error
            : new Error("Failed to update order item status.");
    }
};

/**
 * @function updateOrderPaymentStatus
 * @description Order.paymentStatus を DB のみ更新する（F2-9・C-a）。Stripe/PayPal の決済 API は呼ばない。
 *              status が Refunded/Cancelled のとき、同一 $transaction 内で親 Order.orderStatus と
 *              子 OrderGroup/OrderItem を整合的に連動更新する（F2-10・判断6-2・design §3.2）。
 * @access ADMIN
 * @param orderId 更新する Order の ID
 * @param status 新しい PaymentStatus
 * @returns 更新後の PaymentStatus
 */
export const updateOrderPaymentStatus = async (
    orderId: string,
    status: PaymentStatus
): Promise<PaymentStatus> => {
    const admin = await requireAdmin();
    try {
        return await db.$transaction(async (tx) => {
            // 親 → 子連動（F2-10）。enum スペル注意:
            //   親 PaymentStatus は "Cancelled"（l 2 つ）、子 OrderStatus は "Canceled"（l 1 つ）。
            const isCancelOrRefund =
                status === PaymentStatus.Refunded ||
                status === PaymentStatus.Cancelled;
            const childOrderStatus: OrderStatus =
                status === PaymentStatus.Refunded
                    ? OrderStatus.Refunded
                    : OrderStatus.Canceled;
            const childItemStatus: ProductStatus =
                status === PaymentStatus.Refunded
                    ? ProductStatus.Refunded
                    : ProductStatus.Canceled;

            // F3-5 在庫の二重復元防止: 「非終端 → Cancelled/Refunded」の遷移を、
            // 条件付き updateMany で単一の原子的 UPDATE に畳み込む（placeOrder の
            // check-and-decrement と同型）。並行する 2 つのキャンセルのうち
            // count===1 となるのは片方のみで、子連動と在庫復元はその 1 回だけ走る
            // （read-then-act の TOCTOU レースを回避）。
            let didTransition = false;
            if (isCancelOrRefund) {
                const transition = await tx.order.updateMany({
                    where: {
                        id: orderId,
                        paymentStatus: {
                            notIn: [
                                PaymentStatus.Cancelled,
                                PaymentStatus.Refunded,
                            ],
                        },
                    },
                    // 連動時は親 orderStatus も子と整合させる（F2-10・design §3.2）
                    data: {
                        paymentStatus: status,
                        orderStatus: childOrderStatus,
                    },
                });
                didTransition = transition.count === 1;
            } else {
                // 非キャンセル遷移は無条件更新（paymentStatus のみ）
                await tx.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: status },
                });
            }

            // 子連動・在庫復元は実際に遷移が起きた場合のみ（冪等・二重復元防止）
            if (isCancelOrRefund && didTransition) {
                await tx.orderGroup.updateMany({
                    where: { orderId },
                    data: { status: childOrderStatus },
                });
                await tx.orderItem.updateMany({
                    where: { orderGroup: { orderId } },
                    data: { status: childItemStatus },
                });
            }

            // 監査ログ（NFR-5・判断5-3）
            console.error(
                `[Admin:updatePaymentStatus] actor=${admin.id} target=${orderId} to=${status}`
            );

            if (isCancelOrRefund && didTransition) {
                const items = await tx.orderItem.findMany({
                    where: { orderGroup: { orderId } },
                    select: { sizeId: true, quantity: true },
                });
                await restockOrderItems(tx, items);
            }

            return status;
        });
    } catch (error: unknown) {
        console.error("[Order:updateOrderPaymentStatus] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error instanceof Error
            ? error
            : new Error("Failed to update order payment status.");
    }
};
