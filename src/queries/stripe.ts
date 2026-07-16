"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { PaymentStatus, Prisma } from "@prisma/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-02-24.acacia",
    // Additional Stripe options can be added here
});

/**
 * Stripe の PaymentIntent.status を Order.paymentStatus へ写像する。
 *
 * 未完了（3DS 認証待ち = requires_action、非同期決済の処理中 = processing 等）は
 * 「失敗」ではない。Failed を確定させると、後続の webhook が succeeded を通知した
 * 際に DB が Stripe の真実と食い違うため、Pending に留めて上書き可能な状態を保つ。
 *
 * requires_payment_method は「拒否されて再入力を要する状態」と「まだ決済手段が
 * 付いていない初期状態」の双方で返るため、status だけでは失敗と判別できない。
 * 拒否の証跡である last_payment_error の有無で区別し、証跡が無い場合は Pending に
 * 留める（初期状態の intent を Failed で確定させると再試行を塞いでしまう）。
 *
 * @see https://docs.stripe.com/payments/paymentintents/lifecycle
 * @param paymentIntent - Stripe から retrieve した権威的な intent
 * @returns Order.paymentStatus に格納する PaymentStatus
 */
const toOrderPaymentStatus = (
    paymentIntent: Stripe.PaymentIntent
): PaymentStatus => {
    switch (paymentIntent.status) {
        case "succeeded":
            return "Paid";
        case "canceled":
            return "Cancelled";
        case "requires_payment_method":
            // 拒否された attempt が存在する場合のみ、このattemptの失敗として確定する。
            return paymentIntent.last_payment_error ? "Failed" : "Pending";
        case "processing":
        case "requires_action":
        case "requires_confirmation":
        case "requires_capture":
            return "Pending";
    }
};

const toStripeAmount = (total: Prisma.Decimal): number =>
    total.mul(100).toDecimalPlaces(0).toNumber();

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
            amount: toStripeAmount(order.total),
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
        const expectedAmount = toStripeAmount(order.total);
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
                paymentStatus: toOrderPaymentStatus(paymentIntent),
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
