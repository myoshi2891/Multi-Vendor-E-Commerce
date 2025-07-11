"use server";

import { db } from "@/lib/db";
import {
    OrderStatus,
    OrderTableDateFilter,
    OrderTableFilter,
    PaymentStatus,
    PaymentTableDateFilter,
    PaymentTableFilter,
} from "@/lib/types";
import { currentUser } from "@clerk/nextjs/server";
import { PaymentMethod } from "@prisma/client";
import { subMonths, subYears } from "date-fns";

/**
 * @Function getUserOrders
 * @Description Retrieves user orders, with populated groups and items.
 * @Parameters
 *   - filter: String to filter orders by.
 *   - page: The current page number for pagination. (default = 1)
 *   - pageSize: The number of products per page. (default = 10)
 *   - search: String to search by.
 *   - period: The period of orders you want to retrieve.
 * @Returns Array containing user orders, with groups sorted by totalPrice in descending order.
 */

export const getUserOrders = async (
    filter: OrderTableFilter = "",
    period: OrderTableDateFilter = "",
    search = "" /* Search by Order id, store name, products name */,
    page: number = 1,
    pageSize: number = 10
) => {
    // Retrieve the current user
    const user = await currentUser();

    // Ensure the user is authenticated
    if (!user) throw new Error("Unauthenticated.");

    // Calculate pagination values
    const skip = (page - 1) * pageSize;

    // Construct the base query
    const whereClause: any = {
        AND: [{ userId: user.id }],
    };

    // Apply filters
    if (filter === "unpaid") {
        whereClause.AND.push({ paymentStatus: PaymentStatus.Pending });
    }
    if (filter === "toShip") {
        whereClause.AND.push({ orderStatus: OrderStatus.Processing });
    }
    if (filter === "shipped") {
        whereClause.AND.push({ orderStatus: OrderStatus.Shipped });
    }
    if (filter === "delivered") {
        whereClause.AND.push({ orderStatus: OrderStatus.Delivered });
    }

    // Apply period filter
    const now = new Date();
    if (period === "last-6-months") {
        whereClause.AND.push({
            createdAt: { gte: subMonths(now, 6) },
        });
    }
    if (period === "last-1-year") {
        whereClause.AND.push({
            createdAt: { gte: subYears(now, 1) },
        });
    }
    if (period === "last-2-years") {
        whereClause.AND.push({
            createdAt: { gte: subYears(now, 2) },
        });
    }

    // Apply search filter
    if (search.trim()) {
        whereClause.AND.push({
            OR: [
                {
                    id: { contains: search }, // Search by order id
                },
                {
                    groups: {
                        some: {
                            store: {
                                name: { contains: search }, // Search by store name (no mode here)
                            },
                        },
                    },
                },
                {
                    groups: {
                        some: {
                            items: {
                                some: {
                                    name: { contains: search }, // Search by product name (no mode here)
                                },
                            },
                        },
                    },
                },
            ],
        });
    }

    // Fetch orders for the current page
    const orders = await db.order.findMany({
        where: whereClause,
        include: {
            groups: {
                include: {
                    items: true,
                    _count: {
                        select: {
                            items: true,
                        },
                    },
                },
            },
        },
        take: pageSize, // Limit to page size
        skip, // Skip the orders of previous pages
        orderBy: {
            updatedAt: "desc", // Sort by most updated recently
        },
    });

    // Fetch total count of orders for the query
    const totalCount = await db.order.count({ where: whereClause });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return paginated data with metadata
    return {
        orders,
        totalPages,
        currentPage: page,
        pageSize,
        totalCount,
    };
};

/**
 * @Function getUserPayments
 * @Description Retrieves paginated payment details for the authenticated user, with optional filters
 * @access User
 * @params filter - A string to filter payments by method. (e.g., "stripe", "paypal")
 * @params period - A string representing the time range (e.g., "last-6-months", "last-1-year", "last-2-years")
 * @params search - A string to search within the payment details. (e.g., paymentMethod or currency)
 * @params page - The page number for pagination. (default = 1)
 * @params pageSize - The number of records to return per page. (default = 10)
 * @Returns A Promise resolving to an object containing:
 *  - payments: An array of payment details.
 *  - totalPages: The total number of pages available.
 *  - currentPage: The current page number.
 *  - pageSize: The number of records per page.
 *  - totalCount: The total number of payment records matching the query.
 */

export const getUserPayments = async (
    filter: PaymentTableFilter = "",
    period: PaymentTableDateFilter = "",
    search = "" /* Search by Payment intent id */,
    page: number = 1,
    pageSize: number = 10
) => {
    // Retrieve the current user
    const user = await currentUser();

    // Ensure the user is authenticated
    if (!user) throw new Error("Unauthenticated.");

    // Calculate pagination values
    const skip = (page - 1) * pageSize;

    // Construct the base query
    const whereClause: any = {
        AND: [{ userId: user.id }],
    };

    // Apply filters
    if (filter === "paypal") {
        whereClause.AND.push({ paymentMethod: "PayPal" });
    }
    if (filter === "credit-card") {
        whereClause.AND.push({ paymentMethod: "Stripe" });
    }

    // Apply period filter
    const now = new Date();
    if (period === "last-6-months") {
        whereClause.AND.push({
            createdAt: { gte: subMonths(now, 6) },
        });
    }
    if (period === "last-1-year") {
        whereClause.AND.push({
            createdAt: { gte: subYears(now, 1) },
        });
    }
    if (period === "last-2-years") {
        whereClause.AND.push({
            createdAt: { gte: subYears(now, 2) },
        });
    }

    // Apply search filter
    if (search.trim()) {
        whereClause.AND.push({
            OR: [
                {
                    id: { contains: search }, // Search by id
                },
                {
                    paymentIntentId: { contains: search }, // Search by Payment intent id
                },
            ],
        });
    }

    // Fetch payments for the current page
    const payments = await db.paymentDetails.findMany({
        where: whereClause,
        include: {
            order: true,
        },
        take: pageSize, // Limit to page size
        skip, // Skip the orders of previous pages
        orderBy: {
            updatedAt: "desc", // Sort by most updated recently
        },
    });

    // Fetch total count of orders for the query
    const totalCount = await db.paymentDetails.count({ where: whereClause });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return paginated data with metadata
    return {
        payments,
        totalPages,
        currentPage: page,
        pageSize,
        totalCount,
    };
};
