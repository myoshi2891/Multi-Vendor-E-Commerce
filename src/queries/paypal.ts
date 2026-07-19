"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import type { Order } from "@prisma/client";
// 確定済み決済ステータスの SSOT は src/lib/payment-status.ts（Stripe/PayPal 両ガードで共有）
import {
    SETTLED_PAYMENT_STATUSES,
    isSettledPaymentStatus,
} from "@/lib/payment-status";

/**
 * 状態遷移を伴う `order.update` に付与する CAS 条件。
 *
 * `findUnique` による事前判定は read-then-act であり、判定と書き込みの間に別
 * リクエストが決済を確定させたケースを防げない。where に確定済みステータスの
 * 除外条件を混ぜることで判定と書き込みを単一 UPDATE へ畳み込み、0 件マッチ
 * （= 既に確定済み）を Prisma の P2025 として検知する。
 */
const notSettled = () => ({
    paymentStatus: { notIn: [...SETTLED_PAYMENT_STATUSES] },
});

/** CAS 条件が 0 件マッチだった場合に Prisma が返す「更新対象なし」エラーか */
const isRecordNotFound = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025";

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

    // 確定済み決済は capture 応答で上書きしない（Paid/Refunded を古い/DENIED capture で退行させない）。
    // Stripe capture (confirmStripePayment) と同一の settled ガード。認可ガード同様 try/catch の外。
    if (isSettledPaymentStatus(order.paymentStatus)) {
        throw new Error("Order payment is already settled.");
    }

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

        const capture =
            captureData.purchase_units?.[0]?.payments?.captures?.[0];
        // custom_id は purchase_units[0].custom_id（作成時に orderId を格納）に載る。
        // PayPal の応答バージョンによっては capture 側にも複製されるため両方を許容する。
        const capturedCustomId =
            captureData.purchase_units?.[0]?.custom_id ?? capture?.custom_id;

        // 相関検証は status を問わず、あらゆる状態書き込みより前に行う。
        // status 分岐の後ろに置くと、他人の PayPal Order の DENIED/DECLINED 応答で
        // 自分の注文を Failed へ落とせてしまう（検証コードに到達しない書き込み経路）。
        if (capturedCustomId !== orderId) {
            throw new Error("PayPal capture does not match order.");
        }

        // Check if capture was successful
        if (captureData.status !== "COMPLETED") {
            return await db.order.update({
                where: {
                    id: orderId,
                    ...notSettled(),
                },
                data: {
                    paymentStatus: "Failed",
                },
            });
        }

        // capture 応答を作成時の正値 (createPayPalPayment が格納した
        // amount.value = order.total / currency_code = "USD") と突合し、
        // 安い注文で作成した PayPal Order を高い注文の capture に流用する過少支払いを拒否する。
        // 金額は COMPLETED 応答にしか載らないため、相関検証とは分けてここで行う。
        const capturedValue = capture?.amount?.value;
        const capturedCurrency = capture?.amount?.currency_code;

        if (
            capturedCurrency !== "USD" ||
            capturedValue === undefined ||
            !new Prisma.Decimal(capturedValue).equals(order.total)
        ) {
            throw new Error("PayPal capture amount/currency mismatch.");
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
                ...notSettled(),
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
        // CAS 条件が 0 件マッチ = read-then-act ガード通過後に別リクエストが確定させた。
        // 同期ガードと同じメッセージへ写像し、外から見た挙動を一致させる。
        if (isRecordNotFound(error)) {
            throw new Error("Order payment is already settled.");
        }
        // capture 検証エラーは意図した拒否のため、汎用メッセージで上書きせず透過させる
        // (coupon.ts の isGuardError と同じ「意図的 throw の保全」パターン)
        if (
            error instanceof Error &&
            (error.message === "PayPal capture does not match order." ||
                error.message === "PayPal capture amount/currency mismatch.")
        ) {
            throw error;
        }
        throw new Error("Failed to capture PayPal payment");
    }
};
