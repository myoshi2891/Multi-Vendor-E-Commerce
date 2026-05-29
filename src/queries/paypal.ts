"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import type { Order } from "@prisma/client";

/**
 * @Function createPayPalPayment
 * @Description Creates a PayPal payment and returns payment details
 * @PermissionLevel User only
 * @Parameters
 *   - orderId: The ID of the order to process payment for.
 * @Returns Details of the created payment from PayPal.
 */

export const createPayPalPayment = async (orderId: string) => {
    // Get current user — Clerk 外部呼び出しを try/catch でラップ
    let user: Awaited<ReturnType<typeof currentUser>>;
    try {
        user = await currentUser();
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "Unauthenticated.") {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof Error) {
            console.error(
                "[paypal:createPayPalPayment] Failed to fetch current user",
                error.message,
                error.stack
            );
        } else {
            console.error("[paypal:createPayPalPayment] Failed to fetch current user", error);
        }
        throw new Error(`Failed to fetch current user: ${message}`);
    }
    if (!user) throw new Error("Unauthenticated.");

    // IDOR 防止: 注文所有権を確認してから PayPal API を呼ぶ
    let order: Order | null;
    try {
        order = await db.order.findUnique({
            where: {
                id: orderId,
                userId: user.id,
            },
        });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "Order not found") {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof Error) {
            console.error(
                "[paypal:createPayPalPayment] Failed to fetch order",
                error.message,
                error.stack
            );
        } else {
            console.error("[paypal:createPayPalPayment] Failed to fetch order", error);
        }
        throw new Error(`Failed to fetch order: ${message}`);
    }
    if (!order) throw new Error("Order not found");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        // Here you can call the PayPal API to create a payment
        const response = await fetch(
            "https://api.sandbox.paypal.com/v2/checkout/orders",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${Buffer.from(`${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
                },
                body: JSON.stringify({
                    intent: "CAPTURE",
                    purchase_units: [
                        {
                            // custom_id は Webhook (src/app/api/webhooks/paypal) の resource.custom_id にコピーされ、内部 Order の相関に使用される
                            custom_id: orderId,
                            amount: {
                                currency_code: "USD",
                                value: order.total.toNumber().toFixed(2),
                            },
                        },
                    ],
                }),
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);

        if (response.ok === false) {
            const errorBody = await response.text();
            throw new Error(`PayPal API responded with status ${response.status}: ${errorBody}`);
        }

        const paymentData = await response.json();

        return paymentData;
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error) {
            console.error("Error in createPayPalPayment:", error.message, error.stack);
        } else {
            console.error("Error in createPayPalPayment:", error);
        }
        throw new Error("Failed to create PayPal payment");
    }
};

/**
 * @Function capturePayPalPayment
 * @Description Captures a PayPal payment and updates the order status in the database
 * @PermissionLevel User only
 * @Parameters
 *   - orderId: The ID of the order to update.
 *   - paymentId: The ID of the PayPal payment to capture.
 * @Returns Updated order details.
 */

export const capturePayPalPayment = async (
    orderId: string,
    paymentId: string
) => {
    // Get current user — Clerk 外部呼び出しを try/catch でラップ
    let user: Awaited<ReturnType<typeof currentUser>>;
    try {
        user = await currentUser();
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "Unauthenticated.") {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof Error) {
            console.error(
                "[paypal:capturePayPalPayment] Failed to fetch current user",
                error.message,
                error.stack
            );
        } else {
            console.error(
                "[paypal:capturePayPalPayment] Failed to fetch current user",
                error
            );
        }
        throw new Error(`Failed to fetch current user: ${message}`);
    }
    if (!user) throw new Error("Unauthenticated.");

    // IDOR 防止: PayPal の capture 課金前に注文所有権を確認する
    let order: Order | null;
    try {
        order = await db.order.findUnique({
            where: {
                id: orderId,
                userId: user.id,
            },
        });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "Order not found") {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof Error) {
            console.error(
                "[paypal:capturePayPalPayment] Failed to fetch order",
                error.message,
                error.stack
            );
        } else {
            console.error("[paypal:capturePayPalPayment] Failed to fetch order", error);
        }
        throw new Error(`Failed to fetch order: ${message}`);
    }
    if (!order) throw new Error("Order not found");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        // Capture the payment using PayPal API
        const captureResponse = await fetch(
            `https://api.sandbox.paypal.com/v2/checkout/orders/${paymentId}/capture`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${Buffer.from(`${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
                },
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);

        if (captureResponse.ok === false) {
            const errorBody = await captureResponse.text();
            throw new Error(`PayPal API responded with status ${captureResponse.status}: ${errorBody}`);
        }

        const captureData = await captureResponse.json();

        // Check if capture was successful
        if (captureData.status !== "COMPLETED") {
            return await db.order.update({
                where: {
                    id: orderId,
                },
                data: {
                    paymentStatus: "Failed",
                },
            });
        }

        // Upsert payment details record
        const newPaymentDetails = await db.paymentDetails.upsert({
            where: {
                orderId,
            },
            update: {
                paymentIntentId: paymentId,
                status:
                    captureData.status === "COMPLETED"
                        ? "Completed"
                        : captureData.status,
                amount: Number(
                    captureData.purchase_units[0].payments.captures[0].amount
                        .value
                ),
                currency:
                    captureData.purchase_units[0].payments.captures[0].amount
                        .currency_code,
                // 正規表記は "PayPal"。getUserPayments (src/queries/profile.ts) の
                // フィルタ { paymentMethod: "PayPal" } と一致させる。
                paymentMethod: "PayPal",
                userId: user.id,
            },
            create: {
                paymentIntentId: paymentId,
                status:
                    captureData.status === "COMPLETED"
                        ? "Completed"
                        : captureData.status,
                amount: Number(
                    captureData.purchase_units[0].payments.captures[0].amount
                        .value
                ),
                currency:
                    captureData.purchase_units[0].payments.captures[0].amount
                        .currency_code,
                paymentMethod: "PayPal",
                orderId: orderId,
                userId: user.id,
            },
        });

        // Update the order with the payment details
        const updatedOrder = await db.order.update({
            where: {
                id: orderId,
            },
            data: {
                paymentStatus:
                    captureData.status === "COMPLETED" ? "Paid" : "Failed",
                paymentMethod: "PayPal",
                paymentDetails: {
                    connect: {
                        id: newPaymentDetails.id,
                    },
                },
            },
            include: {
                paymentDetails: true,
            },
        });

        return updatedOrder;
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error) {
            console.error(
                "Error in capturePayPalPayment:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in capturePayPalPayment:", error);
        }
        throw new Error("Failed to capture PayPal payment");
    }
};
