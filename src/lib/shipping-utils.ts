/**
 * 配送料を計算する
 *
 * @param shippingFeeMethod - 配送料計算方式 ("ITEM" | "WEIGHT" | "FIXED")
 * @param shippingFee - 基本配送料
 * @param extraShippingFee - 追加配送料（ITEM 方式で使用）
 * @param weight - 商品重量（WEIGHT 方式で使用）
 * @param quantity - 商品数量
 * @returns 計算された配送料（2桁に正規化）
 */
export function computeShippingTotal(
	shippingFeeMethod: string,
	shippingFee: number,
	extraShippingFee: number,
	weight: number,
	quantity: number
): number {
	// 早期ガード: quantity が 0 以下の場合は送料 0
	if (quantity <= 0) return 0;

	let result: number;

	switch (shippingFeeMethod) {
		case "ITEM": {
			const qty = quantity > 1 ? quantity - 1 : 0;
			result = shippingFee + qty * extraShippingFee;
			break;
		}
		case "WEIGHT":
			result = shippingFee * weight * quantity;
			break;
		case "FIXED":
			result = shippingFee;
			break;
		default:
			result = shippingFee;
			break;
	}

	// 浮動小数点誤差を防ぐため 2 桁に正規化
	return Math.round(result * 100) / 100;
}
