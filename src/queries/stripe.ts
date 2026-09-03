"use server";

import { db } from "@/lib/db";
import {
    isSettledPaymentStatus,
    SETTLED_PAYMENT_STATUSES,
} from "@/lib/payment-status";
import { hasOrderSettledAfterConflict } from "@/lib/order-settlement";
import { requireUser } from "@/lib/auth-guards";
import { PaymentStatus, Prisma } from "@prisma/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-02-24.acacia",
    // Additional Stripe options can be added here
});

/**
 * canceled intent を観測した際に「別キーで作り直す」回数の上限。
 *
 * 再作成キーは観測した canceled intent の id 由来なので、作り直した intent も
 * canceled なら次周でキーが前進する（無限ループにはならない）。それでも上限を
 * 置くのは、Stripe 側が canceled を返し続ける異常時に API 呼び出しを無制限に
 * 増やさないため。上限到達時は保存せず throw する。
 */
const MAX_INTENT_RECREATE_ATTEMPTS = 3;

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
    // 認可ガードは try の外に置く（tech.md「認可ガード」）——
    // 中に入れると catch が認可エラーを汎用エラーで上書きしうる。
    const user = await requireUser();

    try {
        // Fetch the order to get total price（IDOR 防止のため userId で絞り込み）
        const order = await db.order.findUnique({
            where: {
                id: orderId,
                userId: user.id,
            },
        });

        if (!order) throw new Error("Order not found.");

        // 確定済みの決済に新しい intent を作らせない。作成を許すと下で保存する
        // 「有効な intent id」が上書きされ、createStripePayment 側の一致確認を迂回できる。
        if (isSettledPaymentStatus(order.paymentStatus)) {
            throw new Error("Order payment is already settled.");
        }

        // Create a Stripe payment intent
        // metadata.orderId は Webhook (src/app/api/webhooks/stripe) で内部 Order を相関するために必須
        const amount = toStripeAmount(order.total);

        // 冪等キーが無いと、二重クリックやネットワーク再送のたびに新しい intent が
        // 作られて孤児化し、下の upsert が「有効な intent id」を上書きするため
        // 先行 intent で決済中のユーザーが createStripePayment で拒否される。
        //
        // Stripe は「同一キー・異なるパラメータ」の再送をエラーで拒否するため、
        // 金額をキーに含める。クーポン適用等で合計が正当に変われば別キーになり、
        // 同一パラメータの再送だけが同じ intent を返す。
        const intentParams: Stripe.PaymentIntentCreateParams = {
            amount,
            currency: "usd",
            automatic_payment_methods: { enabled: true },
            metadata: { orderId },
        };
        const idempotencyKey = `order_${orderId}_${amount}`;

        let paymentIntent = await stripe.paymentIntents.create(intentParams, {
            idempotencyKey,
        });

        // 冪等キーの保証（同じキー → 同じ intent）は、その intent が canceled に
        // なった後も効き続ける。canceled の client_secret は confirm できないため、
        // キーを固定したままだと当該注文はその金額のまま恒久的に決済不能になる。
        // canceled を観測したときだけ新しいキーで作り直す（通常 status では
        // 作り直さないので、二重送信に対する防御はそのまま維持される）。
        //
        // 再作成キーは**観測した canceled intent の id から決定論的に導出する**。
        // 乱数（randomUUID）にすると二重クリックのたびに別キー = 別 intent が
        // 作られて孤児が量産され、canceled 経路でだけ冪等性が失われる。
        // id 由来なら「同じ canceled を見た再送は同じキー → Stripe が同じ intent を
        // 返す」が成立し、かつ再作成後も canceled なら次周で id が変わるため
        // キーが自動的に前進する（ループが止まらない）。
        let recreateAttempts = 0;
        while (
            paymentIntent.status === "canceled" &&
            recreateAttempts < MAX_INTENT_RECREATE_ATTEMPTS
        ) {
            paymentIntent = await stripe.paymentIntents.create(intentParams, {
                idempotencyKey: `${idempotencyKey}_r_${paymentIntent.id}`,
            });
            recreateAttempts++;
        }

        // 上限まで前進させても canceled なら、その id を保存せずに失敗させる。
        // 保存すると createStripePayment の一致確認が confirm 不能な intent を
        // 「有効」と認めてしまい、決済不能の原因が下流に転嫁される。
        if (paymentIntent.status === "canceled") {
            throw new Error("Stripe payment intent could not be recreated.");
        }

        // この注文で「有効な」intent はこれ 1 つであることを記録する。
        // createStripePayment はこの id との一致を要求し、古い intent を拒否する。
        //
        // amount は Stripe の minor unit (paymentIntent.amount) ではなく order.total を
        // 保存する。PaymentDetails.amount は Decimal(12,2) = ドル建てであり、PayPal 側も
        // ドルで保存している。混在させると集計・表示が 100 倍ずれる。
        await db.paymentDetails.upsert({
            where: { orderId },
            update: {
                paymentIntentId: paymentIntent.id,
                paymentMethod: "Stripe",
                amount: order.total,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
                userId: user.id,
            },
            create: {
                paymentIntentId: paymentIntent.id,
                paymentMethod: "Stripe",
                amount: order.total,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
                orderId,
                userId: user.id,
            },
        });

        return {
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
        };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error creating payment intent:",
                error.message,
                error.stack
            );
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
    // 認可ガードは try の外に置く（tech.md「認可ガード」）——
    // 中に入れると catch が認可エラーを汎用エラーで上書きしうる。
    const user = await requireUser();

    try {
        // Fetch the order to get total price（IDOR 防止のため userId で絞り込み）
        const order = await db.order.findUnique({
            where: {
                id: orderId,
                userId: user.id,
            },
        });

        if (!order) throw new Error("Order not found.");

        // 確定済みの決済は intent の retrieve 結果で上書きしない。
        // 古い canceled intent を渡して Paid を Cancelled へ退行させる攻撃を防ぐ。
        if (isSettledPaymentStatus(order.paymentStatus)) {
            throw new Error("Order payment is already settled.");
        }

        // 権威的なソースは Stripe。クライアント値ではなく retrieve した intent から導出する。
        const paymentIntent =
            await stripe.paymentIntents.retrieve(paymentIntentId);

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

        // metadata・金額・通貨は同一注文の「古い」intent でも一致してしまうため、
        // createStripePaymentIntent が保存した有効な intent id との一致を要求する。
        // 記録が無い場合（本ガード導入前に作られた注文）は従来どおり通す。
        const activePayment = await db.paymentDetails.findUnique({
            where: { orderId },
            select: { paymentIntentId: true },
        });
        if (
            activePayment &&
            activePayment.paymentIntentId !== paymentIntent.id
        ) {
            throw new Error("Payment intent is not active for this order.");
        }

        const nextPaymentDetailsStatus =
            paymentIntent.status === "succeeded"
                ? "Completed"
                : paymentIntent.status;

        // 上の isSettledPaymentStatus チェックは read-then-act であり、読み取りから
        // 書き込みまでの間に webhook (src/app/api/webhooks/stripe) が Paid を
        // 書き込むと、後発の本 server action が Pending へ退行させてしまう。
        //
        // PaymentDetails と Order の更新を単一トランザクションに入れたうえで、
        // Order 側の where に「未確定であること」を含めて条件付き更新（CAS）にする。
        // 条件を満たさない場合 Prisma は P2025 を投げるので、確定済みとして扱う。
        const updatedOrder = await db.$transaction(async (tx) => {
            // amount は order.total（ドル建て）。Decimal(12,2) カラムに Stripe の
            // minor unit を入れない（createStripePaymentIntent 側と同じ理由）。
            const updatedPaymentDetails = await tx.paymentDetails.upsert({
                where: {
                    orderId,
                },
                update: {
                    paymentIntentId: paymentIntent.id,
                    paymentMethod: "Stripe",
                    amount: order.total,
                    currency: paymentIntent.currency,
                    status: nextPaymentDetailsStatus,
                    userId: user.id,
                },
                create: {
                    paymentIntentId: paymentIntent.id,
                    paymentMethod: "Stripe",
                    amount: order.total,
                    currency: paymentIntent.currency,
                    status: nextPaymentDetailsStatus,
                    orderId: orderId,
                    userId: user.id,
                },
            });

            // Update the order with payment details
            return tx.order.update({
                where: {
                    id: orderId,
                    paymentStatus: { notIn: [...SETTLED_PAYMENT_STATUSES] },
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
        });
        return updatedOrder;
    } catch (error: unknown) {
        // 条件付き更新が一致しなかった = 読み取り後に他経路が決済を確定させた。
        // 汎用エラーで潰さず、事前チェックと同じ意味のエラーへ正規化する。
        //
        // ただし P2025 は CAS 不一致に固有のコードではない。トランザクション内の
        // order の並行削除や paymentDetails.connect の対象消失でも同じコードが返るため、
        // 無条件に正規化すると本当の障害が「決済確定済み」として報告される。
        // 実際に確定済みへ変わっているかを再読で確かめ、そのときだけ正規化する。
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025"
        ) {
            if (
                await hasOrderSettledAfterConflict(
                    orderId,
                    "[Stripe:createStripePayment]"
                )
            ) {
                throw new Error("Order payment is already settled.");
            }
        }
        if (error instanceof Error) {
            console.error(
                "Error creating payment:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error creating payment:", error);
        }
        throw error;
    }
};
