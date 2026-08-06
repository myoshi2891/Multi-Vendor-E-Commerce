import { db } from "@/lib/db";
import { PaymentStatus } from "@prisma/client";
import { headers } from "next/headers";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-02-24.acacia",
});

const HANDLED_EVENT_TYPES = new Set<string>([
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "charge.refunded",
]);

type StripeChargeObject = Stripe.Charge;
type StripePaymentIntentObject = Stripe.PaymentIntent;

/**
 * Stripe Webhook イベントを paymentStatus にマップする。
 * charge.refunded は amount_refunded と amount を比較して全額/部分を判定する。
 */
const resolvePaymentStatus = (event: Stripe.Event): PaymentStatus | null => {
    switch (event.type) {
        case "payment_intent.succeeded":
            return "Paid";
        case "payment_intent.payment_failed":
            return "Failed";
        case "charge.refunded": {
            const charge = event.data.object as StripeChargeObject;
            return charge.amount_refunded >= charge.amount
                ? "Refunded"
                : "PartiallyRefunded";
        }
        default:
            return null;
    }
};

/**
 * イベントオブジェクトから metadata.orderId と paymentIntentId を抽出する。
 * charge イベントでは object.payment_intent が PaymentIntent の ID。
 */
const extractCorrelationIds = (
    event: Stripe.Event
): { orderId: string | undefined; paymentIntentId: string | undefined } => {
    if (event.type === "charge.refunded") {
        const charge = event.data.object as StripeChargeObject;
        return {
            orderId: charge.metadata?.orderId,
            paymentIntentId:
                typeof charge.payment_intent === "string"
                    ? charge.payment_intent
                    : (charge.payment_intent?.id ?? undefined),
        };
    }
    const intent = event.data.object as StripePaymentIntentObject;
    return {
        orderId: intent.metadata?.orderId,
        paymentIntentId: intent.id,
    };
};

/**
 * Stripe イベントから currency を取り出す。PaymentIntent / Charge いずれも
 * currency をトップレベルに持つ。
 *
 * amount は**意図的に取り出さない**。`PaymentDetails.amount` は `Decimal(12,2)` の
 * ドル建てであり、Stripe event の amount は minor unit (cents) のため、
 * ここから配線すると 100 倍ずれる（src/queries/stripe.ts の同期パスも `order.total` を保存する）。
 */
const extractCurrency = (event: Stripe.Event): string => {
    const obj = event.data.object as StripePaymentIntentObject | StripeChargeObject;
    return obj.currency;
};

/**
 * Handle Stripe webhook POST requests with signature verification and idempotent
 * Order/PaymentDetails updates for payment_intent.succeeded / payment_intent.payment_failed /
 * charge.refunded events.
 *
 * @param req - The incoming HTTP Request containing the raw webhook payload
 * @returns 200 on success or ignored event; 400 on signature/metadata failure;
 *          404 if Order not found; 500 on internal error
 */
export async function POST(req: Request) {
    const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    if (!STRIPE_WEBHOOK_SECRET) {
        throw new Error(
            "Please add STRIPE_WEBHOOK_SECRET from Stripe Dashboard to .env or .env.local"
        );
    }

    const headerPayload = await headers();
    const signature = headerPayload.get("stripe-signature");
    if (!signature) {
        return new Response("Missing stripe-signature header", { status: 400 });
    }

    // Stripe 署名検証は raw bytes が必要。req.text() で取得する。
    const body = await req.text();

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            STRIPE_WEBHOOK_SECRET
        );
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[webhooks:stripe] Signature verification failed",
                error.message,
                error.stack
            );
        } else {
            console.error("[webhooks:stripe] Signature verification failed", error);
        }
        return new Response("Invalid signature", { status: 400 });
    }

    // 未知イベントは 200 で no-op（Stripe Dashboard で再送ループを起こさないため）
    if (!HANDLED_EVENT_TYPES.has(event.type)) {
        return new Response("Ignored", { status: 200 });
    }

    const { orderId, paymentIntentId } = extractCorrelationIds(event);
    if (!orderId) {
        return new Response("Missing metadata.orderId", { status: 400 });
    }
    if (!paymentIntentId) {
        return new Response("Missing paymentIntentId", { status: 400 });
    }

    const paymentStatus = resolvePaymentStatus(event);
    if (!paymentStatus) {
        // HANDLED_EVENT_TYPES に含まれていながら paymentStatus にマップできない場合は no-op
        return new Response("Ignored", { status: 200 });
    }

    try {
        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order) {
            return new Response("Order not found", { status: 404 });
        }

        // amount は event の cents ではなく order.total（ドル建て）を保存する。
        // PaymentDetails.amount は Decimal(12,2) で、同期パス (src/queries/stripe.ts) も
        // PayPal 経路も order.total を書く。混在させると集計・表示が 100 倍ずれる。
        // currency のみ event の実値を使う。
        const currency = extractCurrency(event);

        // 冪等性: paymentIntentId を持つ PaymentDetails を upsert（orderId が unique）。
        // PaymentDetails と Order の更新はアトミックに行い、片方だけ反映される状態を防ぐ。
        await db.$transaction(async (tx) => {
            await tx.paymentDetails.upsert({
                where: { orderId },
                // update 分岐にも amount / currency を持たせる。持たないと
                // プロバイダー切替（PayPal → Stripe）で前 provider の値が残る。
                update: {
                    paymentIntentId,
                    paymentMethod: "Stripe",
                    status: paymentStatus,
                    amount: order.total,
                    currency,
                    userId: order.userId,
                },
                create: {
                    paymentIntentId,
                    paymentMethod: "Stripe",
                    status: paymentStatus,
                    amount: order.total,
                    currency,
                    orderId,
                    userId: order.userId,
                },
            });

            await tx.order.update({
                where: { id: orderId },
                data: {
                    paymentStatus,
                    paymentMethod: "Stripe",
                },
            });
        });

        return new Response("OK", { status: 200 });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[webhooks:stripe] Failed to apply event",
                error.message,
                error.stack
            );
        } else {
            console.error("[webhooks:stripe] Failed to apply event", error);
        }
        return new Response("Internal Server Error", { status: 500 });
    }
}
