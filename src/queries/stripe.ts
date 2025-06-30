"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { PaymentIntent } from "@stripe/stripe-js";
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

        // Fetch the order to get total price
        const order = await db.order.findUnique({
            where: {
                id: orderId,
            },
        });

        if (!order) throw new Error("Order not found.");

        // Create a Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(order.total * 100), // Convert to dollars
            currency: "usd",
            automatic_payment_methods: { enabled: true },
        });

        return {
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
        };
    } catch (error) {
        console.error("Error creating payment intent:", error);
        throw error;
    }
};

/**
 * @Function createStripePayment
 * @Description Captures a Stripe payment and updates the order status in the database.
 * @PermissionLevel User who owns the addresses
 * @Parameters  - orderId: The ID of the order to update.
 *              - paymentIntent: The Stripe payment intent to capture.
 * @Returns Updated order details.
 */

export const createStripePayment = async (
    orderId: string,
    paymentIntent: PaymentIntent
) => {
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

        if (!order) throw new Error("Order not found.");

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
    } catch (error) {
        console.error("Error creating payment:", error);
        throw error;
    }
};
