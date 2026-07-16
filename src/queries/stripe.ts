"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-02-24.acacia",
    // Additional Stripe options can be added here
});

/**
 * @Function createStripePaymentIntent
 * @Description Creates a Stripe payment intent for the given order.
 * @PermissionLevel User who owns the addresses
 * @Parameters
 *   - orderId: The ID of the order to process payment for.
 * @Returns Details of the created payment intent from Stripe.
 */

export const createStripePaymentIntent = async (orderId: string) => {
    try {
        // Get current user
        const user = await currentUser();
        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Fetch the order to get total price（IDOR 防止のため userId で絞り込み）
        const order = await db.order.findUnique({
            where: {
                id: orderId,
                userId: user.id,
            },
        });

        if (!order) throw new Error("Order not found.");

        // Create a Stripe payment intent
        // metadata.orderId は Webhook (src/app/api/webhooks/stripe) で内部 Order を相関するために必須
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(order.total.toNumber() * 100), // Convert to cents
            currency: "usd",
            automatic_payment_methods: { enabled: true },
            metadata: { orderId },
        });

        return {
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
        };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating payment intent:", error.message, error.stack);
        } else {
            console.error("Error creating payment intent:", error);
        }
        throw error;
    }
};

/**
 * @Function createStripePayment
 * @Description Captures a Stripe payment and updates the order status in the database.
 * @PermissionLevel User who owns the addresses
 * @Parameters  - orderId: The ID of the order to update.
 *              - paymentIntentId: The Stripe payment intent ID to capture.
 * @Returns Updated order details.
 */

export const createStripePayment = async (
    orderId: string,
    paymentIntentId: string
) => {
    try {
        // Get current user
        const user = await currentUser();
        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Fetch the order to get total price（IDOR 防止のため userId で絞り込み）
        const order = await db.order.findUnique({
            where: {
                id: orderId,
                userId: user.id,
            },
        });

        if (!order) throw new Error("Order not found.");

        // 権威的なソースは Stripe。クライアント値ではなく retrieve した intent から導出する。
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // intent 作成時に付与した metadata.orderId で、対象注文との対応を検証する。
        if (paymentIntent.metadata?.orderId !== orderId) {
            throw new Error("Payment intent does not match order.");
        }

        // metadata が正しくても amount/currency が改ざんされた intent を弾く。
        // intent は createStripePaymentIntent で order.total（セント）+ "usd" で生成される。
        const expectedAmount = Math.round(order.total.toNumber() * 100);
        if (
            paymentIntent.amount !== expectedAmount ||
            paymentIntent.currency !== "usd"
        ) {
            throw new Error("Payment intent amount/currency mismatch.");
        }

        const updatedPaymentDetails = await db.paymentDetails.upsert({
            where: {
                orderId,
            },
            update: {
                paymentIntentId: paymentIntent.id,
                paymentMethod: "Stripe",
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status:
                    paymentIntent.status === "succeeded"
                        ? "Completed"
                        : paymentIntent.status,
                userId: user.id,
            },
            create: {
                paymentIntentId: paymentIntent.id,
                paymentMethod: "Stripe",
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status:
                    paymentIntent.status === "succeeded"
                        ? "Completed"
                        : paymentIntent.status,
                orderId: orderId,
                userId: user.id,
            },
        });

        // Update the order with payment details
        const updatedOrder = await db.order.update({
            where: {
                id: orderId,
            },
            data: {
                paymentStatus:
                    paymentIntent.status === "succeeded" ? "Paid" : "Failed",
                paymentMethod: "Stripe",
                paymentDetails: {
                    connect: {
                        id: updatedPaymentDetails.id,
                    },
                },
            },
            include: {
                paymentDetails: true,
            },
        });
        return updatedOrder;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating payment:", error.message, error.stack);
        } else {
            console.error("Error creating payment:", error);
        }
        throw error;
    }
};
