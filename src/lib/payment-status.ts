import { PaymentStatus } from "@prisma/client";

/**
 * 決済が確定済み（不可逆）とみなす Order.paymentStatus 判定。
 *
 * これらの状態は決済プロバイダ側で資金移動が確定した結果であり、PaymentIntent /
 * capture の retrieve 結果で上書きしてはならない。createStripePaymentIntent は同一
 * 注文に対して都度新しい intent を生成するため、古い Pending/canceled intent も
 * metadata・金額・通貨の検証を通過してしまう。確定状態を保護しないと、古い intent
 * id を渡すだけで Paid を Cancelled へ退行させられる。
 *
 * Refunded / PartiallyRefunded / ChargeBack は返金・チャージバックの結果であり、
 * intent の状態から再導出できないため同様に保護する。
 *
 * NOTE: この判定は純粋なユーティリティであり Server Action ではない。`"use server"`
 * ファイル（`src/queries/stripe.ts` / `paypal.ts`）は全 export が async 関数である
 * 必要があるため、同期ヘルパーである本関数はここ（`src/lib/`）を SSOT とし、
 * Stripe / PayPal の両決済ガードから共有する。
 */
export const SETTLED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
    "Paid",
    "Refunded",
    "PartiallyRefunded",
    "ChargeBack",
];

/**
 * 与えられた `PaymentStatus` が確定済み（不可逆）かを判定する。
 */
export const isSettledPaymentStatus = (status: PaymentStatus): boolean =>
    SETTLED_PAYMENT_STATUSES.includes(status);
