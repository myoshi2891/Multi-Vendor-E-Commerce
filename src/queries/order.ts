"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { OrderStatus, PaymentStatus, ProductStatus } from "@/lib/types";
import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

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
