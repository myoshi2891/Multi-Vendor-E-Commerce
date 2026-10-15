import { ProductStatus } from "@/lib/types";

/**
 * 返品ポリシーの判定（plan 088 / docs/design/returns-rma/design.md §6）。
 *
 * 返品できる日数は 2 層: プラットフォームの既定値（環境変数 `RETURN_WINDOW_DAYS_DEFAULT`）と、
 * 店舗ごとの上書き（`Store.returnWindowDays`。NULL なら既定値）。受付ページの表示と申請の判定は
 * 同じ関数から導き、定数の「30 日」と食い違わないようにする。
 */

const FALLBACK_RETURN_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * プラットフォームの既定の返品日数。`trim()` 後に空なら 30、0 以上の整数でなければ throw する
 * （tech.md「環境変数の数値変換」。設定ミスのまま黙って既定値に落とさない）。
 */
export const getPlatformReturnWindowDays = (): number => {
    const raw = process.env.RETURN_WINDOW_DAYS_DEFAULT?.trim();
    if (!raw) return FALLBACK_RETURN_WINDOW_DAYS;
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 0) {
        throw new Error(
            `Invalid RETURN_WINDOW_DAYS_DEFAULT: ${process.env.RETURN_WINDOW_DAYS_DEFAULT}`
        );
    }
    return days;
};

/** 店舗の上書きがあればそれを、無ければ（店舗が無い場合も）プラットフォームの既定値を返す */
export const resolveReturnWindowDays = (
    store: { returnWindowDays: number | null } | null
): number => store?.returnWindowDays ?? getPlatformReturnWindowDays();

export type ReturnEligibilityInput = {
    itemStatus: string;
    /** 注文の作成時刻（不変）。updatedAt は後からの書き換えで動くので使わない */
    orderCreatedAt: Date;
    /** OrderGroup の配達予定日数の上限（配達完了の時刻が無いための近似・design §6） */
    shippingDeliveryMax: number;
    acceptsReturns: boolean;
    returnWindowDays: number;
};

/** 返品の期限 = 注文日 + 配達予定日数の上限 + 返品できる日数 */
export const getReturnDeadline = (
    input: Pick<
        ReturnEligibilityInput,
        "orderCreatedAt" | "shippingDeliveryMax" | "returnWindowDays"
    >
): Date =>
    new Date(
        input.orderCreatedAt.getTime() +
            (input.shippingDeliveryMax + input.returnWindowDays) * DAY_MS
    );

/**
 * 適格 = item が Delivered かつ期限内かつ店舗が返品を受け付けている。
 * plan 022 で `deliveredAt` が入ったら、基準時刻を置き換える（design §6）。
 */
export const isReturnEligible = (
    input: ReturnEligibilityInput,
    now: Date = new Date()
): boolean =>
    input.acceptsReturns &&
    input.itemStatus === ProductStatus.Delivered &&
    now.getTime() <= getReturnDeadline(input).getTime();
