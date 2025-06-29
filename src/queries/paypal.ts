"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";

/**
 * @Function createPayPalPayment
 * @Description Creates a PayPal payment and returns payment details
 * @PermissionLevel User only
 * @Parameters
 *   - orderId: The ID of the order to process payment for.
 * @Returns Details of the created payment from PayPal.
 */

export const createPayPalPayment = async (orderId: string) => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Fetch the order to get total price
        const order = await db.order.findUnique({
            where: {
                id: orderId,
            },
        });

        if (!order) throw new Error("Order not found");

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
                            amount: {
                                currency_code: "USD",
                                value: order.total.toFixed(2).toString(),
                            },
                        },
                    ],
                }),
            }
        );

        const paymentData = await response.json();

        return paymentData;
    } catch (error) {
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
    // Get current user
    const user = await currentUser();

    // Ensure user is authenticated
    if (!user) throw new Error("Unauthenticated.");

    // Capture the payment using PayPal API
    const captureResponse = await fetch(
        `https://api.sandbox.paypal.com/v2/checkout/orders/${paymentId}/capture`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${Buffer.from(`${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
            },
        }
    );

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
            id: orderId,
        },
        update: {
            paymentIntentId: paymentId,
            status:
                captureData.status === "COMPLETED"
                    ? "succecced"
                    : captureData.status,
            amount: Number(
                captureData.purchase_units[0].payments.captures[0].amount.value
            ),
            currency:
                captureData.purchase_units[0].payments.captures[0].amount
                    .currency_code,
            paymentMethod: "Paypal",
            userId: user.id,
        },
        create: {
            paymentIntentId: paymentId,
            status:
                captureData.status === "COMPLETED"
                    ? "succecced"
                    : captureData.status,
            amount: Number(
                captureData.purchase_units[0].payments.captures[0].amount.value
            ),
            currency:
                captureData.purchase_units[0].payments.captures[0].amount
                    .currency_code,
            paymentMethod: "Paypal",
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
            paymentStatus: captureData.status === "COMPLETED" ? "Paid" : "Failed",
            paymentMethod: "PayPal",
            paymentDetails: {
                connect: {
                    id: newPaymentDetails.id,
                }
            }
        },
        include: {
            paymentDetails: true,
        }
    })

    return updatedOrder
};
