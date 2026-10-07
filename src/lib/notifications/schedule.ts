import { after } from "next/server";
import { logError } from "@/lib/log";
import { dispatchPendingDeliveries } from "./dispatch";

/**
 * commit 済みの配信を、レスポンスを返した後に送る（design §4.2 の速い経路）。
 * **tx の commit 後に呼ぶこと。**
 *
 * ここでの失敗は主処理の結果を変えない。送れなかった行は PENDING / SENDING のまま残り、
 * cron の sweeper（/api/cron/notifications）が拾い直す。
 * `after()` がリクエストの外（スクリプトや統合テスト）で使えない場合も throw しない。
 */
export const scheduleDispatch = (deliveryIds: readonly string[]): void => {
    if (deliveryIds.length === 0) return;

    try {
        after(async () => {
            try {
                await dispatchPendingDeliveries({
                    deliveryIds,
                    limit: deliveryIds.length,
                });
            } catch (error: unknown) {
                logError(
                    "[Notifications:scheduleDispatch] dispatch failed; sweeper will retry",
                    error
                );
            }
        });
    } catch (error: unknown) {
        logError(
            "[Notifications:scheduleDispatch] after() unavailable; sweeper will retry",
            error
        );
    }
};
