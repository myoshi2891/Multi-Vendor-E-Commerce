import { db } from "@/lib/db";
import { PaymentStatus } from "@prisma/client";
import { headers } from "next/headers";

const PAYPAL_API_BASE =
    process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

const HANDLED_EVENT_TYPES = new Set<string>([
    "PAYMENT.CAPTURE.COMPLETED",
    "PAYMENT.CAPTURE.DENIED",
    "PAYMENT.CAPTURE.REFUNDED",
]);

const REQUIRED_PAYPAL_HEADERS = [
    "paypal-transmission-id",
    "paypal-transmission-time",
    "paypal-transmission-sig",
    "paypal-cert-url",
    "paypal-auth-algo",
] as const;

type PayPalWebhookEvent = {
    event_type: string;
    resource?: {
        id?: string;
        custom_id?: string;
        status?: string;
    };
};

/**
 * PayPal イベントタイプを内部 PaymentStatus にマップする。
 * PAYMENT.CAPTURE.REFUNDED は resource が返金レコードのため部分/全額の即時判定は不可。
 * 詳細な判定が必要な場合は元 capture を別途 fetch する設計が必要（将来課題）。
 */
const resolvePaymentStatus = (eventType: string): PaymentStatus | null => {
    switch (eventType) {
        case "PAYMENT.CAPTURE.COMPLETED":
            return "Paid";
        case "PAYMENT.CAPTURE.DENIED":
            return "Failed";
        case "PAYMENT.CAPTURE.REFUNDED":
            return "Refunded";
        default:
            return null;
    }
};

/**
 * /v1/oauth2/token から access_token を取得する。client_id / secret は Basic auth で送る。
 * 外向き fetch は 10s で abort する（src/queries/paypal.ts と統一）。
 */
const fetchPayPalAccessToken = async (): Promise<string> => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_SECRET;
    if (!clientId || !secret) {
        throw new Error("PayPal client credentials are not configured");
    }
    const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
            signal: controller.signal,
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `PayPal OAuth token request failed: ${response.status} ${errorBody}`
            );
        }
        const data: { access_token?: string } = await response.json();
        if (!data.access_token) {
            throw new Error("PayPal OAuth response missing access_token");
        }
        return data.access_token;
    } finally {
        clearTimeout(timeoutId);
    }
};

/**
 * PayPal verify-webhook-signature API を呼んで verification_status を返す。
 * 外向き fetch は 10s で abort する（src/queries/paypal.ts と統一）。
 */
const verifyPayPalSignature = async (
    headerMap: Record<string, string>,
    webhookId: string,
    event: unknown,
    accessToken: string
): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(
            `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    auth_algo: headerMap["paypal-auth-algo"],
                    cert_url: headerMap["paypal-cert-url"],
                    transmission_id: headerMap["paypal-transmission-id"],
                    transmission_sig: headerMap["paypal-transmission-sig"],
                    transmission_time: headerMap["paypal-transmission-time"],
                    webhook_id: webhookId,
                    webhook_event: event,
                }),
                signal: controller.signal,
            }
        );
        if (!response.ok) {
            return false;
        }
        const data: { verification_status?: string } = await response.json();
        return data.verification_status === "SUCCESS";
    } finally {
        clearTimeout(timeoutId);
    }
};

/**
 * Handle PayPal webhook POST requests, verify signature via PayPal's
 * verify-webhook-signature API, and idempotently update Order/PaymentDetails
 * for PAYMENT.CAPTURE.COMPLETED / DENIED / REFUNDED events.
 *
 * @param req - The incoming HTTP Request containing the webhook JSON payload
 * @returns 200 on success or ignored event; 400 on signature/metadata failure;
 *          404 if Order not found; 500 on internal error
 */
export async function POST(req: Request) {
    const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
    if (!PAYPAL_WEBHOOK_ID) {
        throw new Error(
            "Please add PAYPAL_WEBHOOK_ID from PayPal Developer Dashboard to .env or .env.local"
        );
    }

    const headerPayload = await headers();
    const headerMap: Record<string, string> = {};
    for (const key of REQUIRED_PAYPAL_HEADERS) {
        const value = headerPayload.get(key);
        if (!value) {
            return new Response(`Missing ${key} header`, { status: 400 });
        }
        headerMap[key] = value;
    }

    let event: PayPalWebhookEvent;
    try {
        event = (await req.json()) as PayPalWebhookEvent;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[webhooks:paypal] Failed to parse body",
                error.message,
                error.stack
            );
        }
        return new Response("Invalid JSON body", { status: 400 });
    }

    // 署名検証: PayPal API を呼ぶ
    try {
        const accessToken = await fetchPayPalAccessToken();
        const verified = await verifyPayPalSignature(
            headerMap,
            PAYPAL_WEBHOOK_ID,
            event,
            accessToken
        );
        if (!verified) {
            return new Response("Invalid signature", { status: 400 });
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[webhooks:paypal] Signature verification error",
                error.message,
                error.stack
            );
        } else {
            console.error("[webhooks:paypal] Signature verification error", error);
        }
        return new Response("Signature verification failed", { status: 400 });
    }

    if (!HANDLED_EVENT_TYPES.has(event.event_type)) {
        return new Response("Ignored", { status: 200 });
    }

    const orderId = event.resource?.custom_id;
    const captureId = event.resource?.id;
    if (!orderId) {
        return new Response("Missing resource.custom_id", { status: 400 });
    }
    if (!captureId) {
        return new Response("Missing resource.id", { status: 400 });
    }

    const paymentStatus = resolvePaymentStatus(event.event_type);
    if (!paymentStatus) {
        return new Response("Ignored", { status: 200 });
    }

    try {
        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order) {
            return new Response("Order not found", { status: 404 });
        }

        // 冪等性: orderId が unique。capture id を paymentIntentId カラムに格納する。
        // PaymentDetails と Order の更新はアトミックに行い、片方だけ反映される状態を防ぐ。
        await db.$transaction(async (tx) => {
            await tx.paymentDetails.upsert({
                where: { orderId },
                update: {
                    paymentIntentId: captureId,
                    paymentMethod: "Paypal",
                    status: paymentStatus,
                    userId: order.userId,
                },
                create: {
                    paymentIntentId: captureId,
                    paymentMethod: "Paypal",
                    status: paymentStatus,
                    amount: order.total,
                    currency: "usd",
                    orderId,
                    userId: order.userId,
                },
            });

            await tx.order.update({
                where: { id: orderId },
                data: {
                    paymentStatus,
                    paymentMethod: "PayPal",
                },
            });
        });

        return new Response("OK", { status: 200 });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[webhooks:paypal] Failed to apply event",
                error.message,
                error.stack
            );
        } else {
            console.error("[webhooks:paypal] Failed to apply event", error);
        }
        return new Response("Internal Server Error", { status: 500 });
    }
}
