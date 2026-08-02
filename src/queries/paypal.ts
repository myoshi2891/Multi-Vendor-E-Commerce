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
import { hasOrderSettledAfterConflict } from "@/lib/order-settlement";

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

/**
 * PayPal 応答の `amount.value` が `Prisma.Decimal` に安全に渡せる形かを判定する。
 *
 * `new Prisma.Decimal(null)` / `new Prisma.Decimal("abc")` は
 * `[DecimalError] Invalid argument` を **throw** する。この throw は金額検証の
 * `try` の内側で起きるため catch の汎用メッセージ
 * （"Failed to capture PayPal payment"）に化け、`isVerificationRejection` の
 * 素通しにも乗らない ——「金額が不正だった」という原因が呼び出し側にもログにも
 * 残らなくなる。Decimal に渡す**前**に弾いて、意図した mismatch へ収束させる。
 *
 * PayPal の金額は仕様上つねに 10 進文字列なので、文字列であることと
 * 10 進表記であることの両方を要求する（`"1e3"` のような指数表記も拒否する
 * —— Decimal は解釈できるが PayPal は返さないため、受理すると
 * 「想定外の応答」を静かに通すことになる）。
 */
const isDecimalString = (value: unknown): value is string =>
    typeof value === "string" && /^-?[0-9]+(\.[0-9]+)?$/.test(value);

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
 *
 * **本文の読み取りまでが予算の内側**であることが重要。`fetch` は
 * **ヘッダを受信した時点で解決**し、本文はまだ 1 バイトも読めていない。
 * ここで `clearTimeout` してから呼び出し側に `Response` を返すと、その後の
 * `json()` / `text()` は予算の外で走る —— PayPal が本文を送り渋る、あるいは
 * 接続が半開きのまま滞留すると、**そこで無期限に待つ**。AbortController は
 * 本文ストリームの中断も担うので、読み切るまでタイマーを生かしておく。
 *
 * そのため本関数は `Response` ではなく**読み取り済みの本文**を返す。呼び出し側で
 * `await response.json()` を書ける形にすると、その一行が必ず予算の外へ出てしまう。
 */
const fetchPayPal = async (
    url: string,
    init: RequestInit
): Promise<{ ok: boolean; status: number; body: string }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYPAL_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
        });
        // 成功・失敗のどちらでも本文は読む（失敗時はエラーメッセージに載せる）。
        // text() は json() と違いパースを伴わないため、非 JSON のエラー本文でも
        // ここで throw しない。JSON への変換は予算の外（呼び出し側）で行う。
        const body = await response.text();
        return { ok: response.ok, status: response.status, body };
    } finally {
        clearTimeout(timeoutId);
    }
};

/**
 * Clerk の `currentUser()` を取得し、未認証を拒否する共通前段。
 *
 * `currentUser()` は外部呼び出しなので try/catch でラップし、Clerk 由来の障害を
 * `Failed to fetch current user: …` へ写像する。ただし**意図的 throw である
 * `"Unauthenticated."` はそのまま透過させる** —— 汎用メッセージで潰すと、
 * 呼び出し側が文字列比較で認可エラーを見分けられなくなる。
 *
 * `logPrefix` を引数に取るのは createPayPalPayment / capturePayPalPayment で
 * ログの発生源を区別するため。ログ以外に両者の差分はない。
 */
const requirePayPalUser = async (
    logPrefix: string
): Promise<NonNullable<Awaited<ReturnType<typeof currentUser>>>> => {
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
                `${logPrefix} Failed to fetch current user`,
                error.message,
                error.stack
            );
        } else {
            console.error(`${logPrefix} Failed to fetch current user`, error);
        }
        throw new Error(`Failed to fetch current user: ${message}`);
    }
    if (!user) throw new Error("Unauthenticated.");
    return user;
};

/**
 * IDOR 防止: `userId` で絞った所有権付きの注文取得。
 *
 * `where` に `userId` を含めることが本関数の存在理由であり、PayPal API を叩く前
 * （= 金が動く前）に必ず通す。
 *
 * 例外メッセージは **`"Order not found"`（末尾ピリオド無し）**。`stripe.ts` 側は
 * `"Order not found."`（ピリオド有り）で、双方ともテストが固定しているため
 * 統一してはならない。本ヘルパーは PayPal 側専用。
 */
const findOwnedPayPalOrder = async (
    orderId: string,
    userId: string,
    logPrefix: string
): Promise<Order> => {
    let order: Order | null;
    try {
        order = await db.order.findUnique({
            where: {
                id: orderId,
                userId,
            },
        });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "Order not found") {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof Error) {
            console.error(
                `${logPrefix} Failed to fetch order`,
                error.message,
                error.stack
            );
        } else {
            console.error(`${logPrefix} Failed to fetch order`, error);
        }
        throw new Error(`Failed to fetch order: ${message}`);
    }
    if (!order) throw new Error("Order not found");
    return order;
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
    const user = await requirePayPalUser("[paypal:createPayPalPayment]");

    // IDOR 防止: 注文所有権を確認してから PayPal API を呼ぶ
    const order = await findOwnedPayPalOrder(
        orderId,
        user.id,
        "[paypal:createPayPalPayment]"
    );

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
            throw new Error(
                `PayPal API responded with status ${response.status}: ${response.body}`
            );
        }

        const paymentData = JSON.parse(response.body);

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
    const user = await requirePayPalUser("[paypal:capturePayPalPayment]");

    // IDOR 防止: PayPal の capture 課金前に注文所有権を確認する
    const order = await findOwnedPayPalOrder(
        orderId,
        user.id,
        "[paypal:capturePayPalPayment]"
    );

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
            throw new Error(
                `PayPal API responded with status ${orderResponse.status}: ${orderResponse.body}`
            );
        }

        const orderData = JSON.parse(orderResponse.body);
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

        // `undefined` だけでなく `null` / 非数値も弾いてから Decimal に渡す。
        // `new Prisma.Decimal(null)` や `new Prisma.Decimal("abc")` は
        // `[DecimalError] Invalid argument` を投げ、下の catch が
        // "Failed to capture PayPal payment" で上書きするため、
        // 金額不一致という原因が呼び出し側にもログにも残らなくなる。
        if (
            orderCurrency !== "USD" ||
            !isDecimalString(orderValue) ||
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
            throw new Error(
                `PayPal API responded with status ${captureResponse.status}: ${captureResponse.body}`
            );
        }

        const captureData = JSON.parse(captureResponse.body);

        const capture =
            captureData.purchase_units?.[0]?.payments?.captures?.[0];
        // custom_id は purchase_units[0].custom_id（作成時に orderId を格納）に載る。
        // PayPal の応答バージョンによっては capture 側にも複製されるため、
        // 「どちらの位置に載っていてもよい」を許容する。
        // ただし `a ?? b` で束ねると最初の非 nullish で短絡し、外側が一致した時点で
        // capture 側は一度も検査されない。capture オブジェクトこそ実際の資金移動を
        // 表すため、外側だけ自注文に相関し内側が別注文を指す応答が通過してしまう。
        // 位置は問わないが、存在するものは**すべて** orderId と一致することを要求する。
        const presentCustomIds = [
            captureData.purchase_units?.[0]?.custom_id,
            capture?.custom_id,
        ].filter((value): value is string => typeof value === "string");

        // 相関検証は status を問わず、あらゆる状態書き込みより前に行う。
        // status 分岐の後ろに置くと、他人の PayPal Order の DENIED/DECLINED 応答で
        // 自分の注文を Failed へ落とせてしまう（検証コードに到達しない書き込み経路）。
        // どちらの位置にも載っていない応答は相関を確認できないため拒否する
        // （`undefined !== orderId` で throw していた従来挙動の維持）。
        if (
            presentCustomIds.length === 0 ||
            presentCustomIds.some((customId) => customId !== orderId)
        ) {
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
        if (
            isRecordNotFound(error) &&
            (await hasOrderSettledAfterConflict(
                orderId,
                "[paypal:capturePayPalPayment]"
            ))
        ) {
            throw new Error("Order payment is already settled.");
        }
        // 検証エラー（capture 前の retrieve 突合 / capture 応答突合）は意図した拒否のため、
        // 汎用メッセージで上書きせず透過させる。列挙は VERIFICATION_REJECTIONS が SSOT。
        if (isVerificationRejection(error)) {
            throw error;
        }
        throw new Error("Failed to capture PayPal payment");
    }
};
