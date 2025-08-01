"use server";

import { db } from "@/lib/db";
import { OrderStatus, ProductStatus } from "@/lib/types";
import { currentUser } from "@clerk/nextjs/server";

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
        throw new Error("Unauthorized to update order group status.");
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
