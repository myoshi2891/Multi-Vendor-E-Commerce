import { Coupon } from "@prisma/client";

/**
 * クーポンが現在有効か（isActive かつ有効期間内）を判定する。
 * `placeOrder` と `updateCheckoutProductWithLatest` で別々の不完全な判定
 * （isActive のみ／期間のみ）が行われ、カート表示額と確定注文額がズレる
 * 不整合があったため一元化した。
 */
export const isCouponCurrentlyValid = (
    coupon: Pick<Coupon, "isActive" | "startDate" | "endDate">
): boolean => {
    if (!coupon.isActive) return false;

    const currentDate = new Date();
    const startDate = new Date(coupon.startDate);
    const endDate = new Date(coupon.endDate);

    return currentDate >= startDate && currentDate <= endDate;
};
