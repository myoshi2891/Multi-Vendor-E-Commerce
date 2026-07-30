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
 * 検証で意図的に throw する拒否メッセージ。catch の汎用メッセージで上書きせず
 * 透過させる（`coupon.ts` の `isDomainError` と同じ「意図的 throw の保全」パターン）。
 *
 * capture の**前**（retrieve 突合）と**後**（capture 応答突合）で別メッセージを使う。
 * 前者は「課金していない」、後者は「課金済みで返金が必要」という運用上まったく違う
 * 状態を指すため、呼び出し側・ログで区別できる必要がある。
 */
const VERIFICATION_REJECTIONS = new Set([
    "PayPal order does not match order.",
    "PayPal order amount/currency mismatch.",
    "PayPal capture does not match order.",
    "PayPal capture amount/currency mismatch.",
]);

const isVerificationRejection = (error: unknown): error is Error =>
    error instanceof Error && VERIFICATION_REJECTIONS.has(error.message);

/** PayPal API 1 呼び出しあたりのタイムアウト（ms）。予算は呼び出しごとに独立する。 */
const PAYPAL_TIMEOUT_MS = 10_000;

/**
 * PayPal API を **その呼び出し専用の** タイムアウト予算付きで叩く。
 *
 * 1 つの `AbortController` を複数の fetch で共有すると、タイムアウトは個々の
 * 呼び出しの期限ではなく**合計の期限**になる。`capturePayPalPayment` は
 * retrieve（GET orders/{id}）→ capture（POST /capture）の 2 段構成なので、
 * 共有すると retrieve が遅いほど capture に残る時間が減る —— **金が動く側の
 * 呼び出しほど中断されやすい**という最悪の相関が生まれる。capture が途中で
 * abort されても PayPal 側で課金が成立していることはあり、その場合は返金という
 * 別経路の運用が必要になる。
 *
 * `finally` で必ず `clearTimeout` するため、fetch が解決・拒否のどちらで
 * 抜けてもタイマーはイベントループに残らない。
 */
const fetchPayPal = async (
    url: string,
    init: RequestInit
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYPAL_TIMEOUT_MS);

    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

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
            console.error(
                "[paypal:createPayPalPayment] Failed to fetch current user",
                error
            );
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
            console.error(
                "[paypal:createPayPalPayment] Failed to fetch order",
                error
            );
        }
        throw new Error(`Failed to fetch order: ${message}`);
    }
    if (!order) throw new Error("Order not found");

    try {
        // Here you can call the PayPal API to create a payment
        const response = await fetchPayPal(
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
            }
        );

        if (response.ok === false) {
            const errorBody = await response.text();
            throw new Error(
                `PayPal API responded with status ${response.status}: ${errorBody}`
            );
        }

        const paymentData = await response.json();

        return paymentData;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in createPayPalPayment:",
                error.message,
                error.stack
            );
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
            console.error(
                "[paypal:capturePayPalPayment] Failed to fetch order",
                error
            );
        }
        throw new Error(`Failed to fetch order: ${message}`);
    }
    if (!order) throw new Error("Order not found");

    // 確定済み決済は capture 応答で上書きしない（Paid/Refunded を古い/DENIED capture で退行させない）。
    // Stripe capture (confirmStripePayment) と同一の settled ガード。認可ガード同様 try/catch の外。
    if (isSettledPaymentStatus(order.paymentStatus)) {
        throw new Error("Order payment is already settled.");
    }

    try {
        // capture の**前**に PayPal Order を取得して突合する。capture 応答の検証
        // （下の相関・金額チェック）は金が動いた後にしか働かないため、過少支払いや
        // 他人の PayPal Order の流用は throw しても課金自体は成立してしまい、
        // 返金という別経路の運用が必要になる。不一致なら capture を呼ばない。
        //
        // capture 後の検証は削除せず残す（PayPal 側で capture 時に値が変わる経路と、
        // retrieve → capture の間に承認が差し替わる TOCTOU への二重防御）。
        const orderResponse = await fetchPayPal(
            `https://api.sandbox.paypal.com/v2/checkout/orders/${paymentId}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${Buffer.from(`${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
                },
            }
        );

        if (orderResponse.ok === false) {
            const errorBody = await orderResponse.text();
            throw new Error(
                `PayPal API responded with status ${orderResponse.status}: ${errorBody}`
            );
        }

        const orderData = await orderResponse.json();
        const purchaseUnit = orderData.purchase_units?.[0];

        // 相関は金額より先に見る。他人の PayPal Order だと判明した時点で、
        // その金額の一致・不一致は判断材料にならない。
        if (purchaseUnit?.custom_id !== orderId) {
            throw new Error("PayPal order does not match order.");
        }

        // 作成時に createPayPalPayment が格納した正値（order.total / "USD"）と突合する。
        // 金額比較は Prisma.Decimal.equals（float === は 2 進丸めで誤判定しうる）。
        const orderValue = purchaseUnit?.amount?.value;
        const orderCurrency = purchaseUnit?.amount?.currency_code;

        if (
            orderCurrency !== "USD" ||
            orderValue === undefined ||
            !new Prisma.Decimal(orderValue).equals(order.total)
        ) {
            throw new Error("PayPal order amount/currency mismatch.");
        }

        // Capture the payment using PayPal API
        // retrieve とは**別の**予算で叩く（fetchPayPal が呼び出しごとに
        // AbortController を起こす）。retrieve に何秒かかっていようと、
        // capture は満額のタイムアウトから始まる。
        const captureResponse = await fetchPayPal(
            `https://api.sandbox.paypal.com/v2/checkout/orders/${paymentId}/capture`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${Buffer.from(`${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
                },
            }
        );

        if (captureResponse.ok === false) {
            const errorBody = await captureResponse.text();
            throw new Error(
                `PayPal API responded with status ${captureResponse.status}: ${errorBody}`
            );
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
        //
        // ただし P2025 は CAS 不一致に固有のコードではない。トランザクション内の
        // order の並行削除や `paymentDetails.connect` の対象消失でも同じコードが返るため、
        // 無条件に正規化すると本当の障害が「決済確定済み」として報告される
        // （呼び出し側は「もう払えている」と信じて調査もリトライもしなくなる）。
        // 実際に確定済みへ変わっているかを再読で確かめ、そのときだけ正規化する
        // （stripe.ts の createStripePayment と同じ契約）。
        if (isRecordNotFound(error)) {
            let settled = false;
            try {
                const current = await db.order.findUnique({
                    where: { id: orderId },
                    select: { paymentStatus: true },
                });
                settled =
                    !!current && isSettledPaymentStatus(current.paymentStatus);
            } catch (reReadError: unknown) {
                // 再読自体が失敗した場合は判別できない。元の P2025 を失わないよう、
                // ここでは握りつぶさず記録だけして下の共通経路へ流す。
                console.error(
                    "[paypal:capturePayPalPayment] Failed to re-read order after P2025",
                    reReadError instanceof Error
                        ? {
                              error: reReadError.message,
                              stack: reReadError.stack,
                          }
                        : { error: reReadError }
                );
            }
            if (settled) {
                throw new Error("Order payment is already settled.");
            }
        }
        // 検証エラー（capture 前の retrieve 突合 / capture 応答突合）は意図した拒否のため、
        // 汎用メッセージで上書きせず透過させる。列挙は VERIFICATION_REJECTIONS が SSOT。
        if (isVerificationRejection(error)) {
            throw error;
        }
        throw new Error("Failed to capture PayPal payment");
    }
};
