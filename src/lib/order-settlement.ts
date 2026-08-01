import { db } from "@/lib/db";
import { isSettledPaymentStatus } from "@/lib/payment-status";

/**
 * P2025（条件付き更新の 0 件マッチ）を捕まえた後に、注文が本当に確定済みへ
 * 変わっていたかを**再読して**判定する。
 *
 * P2025 は CAS 不一致に固有のコードではない。トランザクション内の order の並行削除や
 * `paymentDetails.connect` の対象消失でも同じコードが返るため、無条件に「決済確定済み」
 * へ正規化すると本当の障害が握り潰され、呼び出し側は「もう払えている」と信じて調査も
 * リトライもしなくなる。
 *
 * 再読自体が失敗した場合は確定済みかどうかを判別できない。元の P2025 を失わないよう
 * **throw せず `false` を返し**、記録だけして呼び出し側の汎用エラー経路へ流す。
 *
 * NOTE: この判定は Server Action ではない。`"use server"` ファイル
 * （`src/queries/stripe.ts` / `src/queries/paypal.ts`）から共有する必要があるが、
 * それらは全 export が async 関数である制約を持つため、`payment-status.ts` と同じ理由で
 * ここ（`src/lib/`）を SSOT とする。
 *
 * @param orderId - 再読する Order の id
 * @param logPrefix - 呼び出し元識別子（例: `"[Stripe:createStripePayment]"`）。
 *                    再読失敗時のログ本文と連結される。
 * @returns 再読結果が確定済みステータスなら `true`。未確定・注文不在・再読失敗は `false`
 */
export const hasOrderSettledAfterConflict = async (
    orderId: string,
    logPrefix: string
): Promise<boolean> => {
    try {
        const current = await db.order.findUnique({
            where: { id: orderId },
            select: { paymentStatus: true },
        });
        return !!current && isSettledPaymentStatus(current.paymentStatus);
    } catch (reReadError: unknown) {
        console.error(
            `${logPrefix} Failed to re-read order after P2025`,
            reReadError instanceof Error
                ? {
                      error: reReadError.message,
                      stack: reReadError.stack,
                  }
                : { error: reReadError }
        );
        return false;
    }
};
