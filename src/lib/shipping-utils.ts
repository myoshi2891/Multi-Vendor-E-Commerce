import { Prisma, ShippingFeeMethod } from "@prisma/client";

/**
 * Calculates the shipping charge for the specified method and quantity.
 *
 * @param shippingFeeMethod - The shipping charge method: `"ITEM"`, `"WEIGHT"`, or `"FIXED"`.
 * @param shippingFee - The base shipping charge.
 * @param extraShippingFee - The additional per-item charge for the `"ITEM"` method.
 * @param weight - The item weight for the `"WEIGHT"` method.
 * @param quantity - The number of items.
 * @returns The shipping charge rounded to two decimal places, or `0` when the quantity is zero or less.
 */
export function computeShippingTotal(
	shippingFeeMethod: ShippingFeeMethod,
	shippingFee: number,
	extraShippingFee: number,
	weight: number,
	quantity: number
): number {
	// 早期ガード: quantity が 0 以下の場合は送料 0
	if (quantity <= 0) return 0;

	const fee = new Prisma.Decimal(shippingFee);
	let result: Prisma.Decimal;

	switch (shippingFeeMethod) {
		case "ITEM": {
			const qty = quantity > 1 ? quantity - 1 : 0;
			result = fee.add(new Prisma.Decimal(extraShippingFee).mul(qty));
			break;
		}
		case "WEIGHT":
			result = fee.mul(weight).mul(quantity);
			break;
		case "FIXED":
			result = fee;
			break;
	}

	// 丸めはここ 1 回だけ。half-up は旧実装 (Math.round) の挙動を維持する
	// —— banker's rounding に変えると .xx5 が偶数側へ倒れ、既存の期待値が動く。
	return result.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}
