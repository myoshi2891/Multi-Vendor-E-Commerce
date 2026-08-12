import { Prisma, ShippingFeeMethod } from "@prisma/client";

/**
 * 配送料を計算する
 *
 * 中間計算はすべて `Prisma.Decimal` で行う（`.claude/steering/tech.md` の金額規約）。
 * 旧実装は IEEE 754 の `number` で積み上げてから `Math.round((x + EPSILON) * 100) / 100`
 * で丸めていたが、EPSILON は 1 前後の大きさに合わせた**絶対値**の定数なので、
 * 100 倍したスケールで生じる誤差は補正できない。
 * 例: WEIGHT 方式で fee 0.15 × weight 1.45 × qty 10 は 10 進では厳密に 2.175 で
 * half-up なら 2.18 だが、`* 100` が 217.49999999999997 になるため旧実装は 2.17 を返した。
 *
 * 丸めは `toDecimalPlaces(2, ROUND_HALF_UP)` の 1 回だけ、`toNumber()` は return 境界のみ。
 *
 * @param shippingFeeMethod - 配送料計算方式 ("ITEM" | "WEIGHT" | "FIXED")
 * @param shippingFee - 基本配送料
 * @param extraShippingFee - 追加配送料（ITEM 方式で使用）
 * @param weight - 商品重量（WEIGHT 方式で使用）
 * @param quantity - 商品数量
 * @returns 計算された配送料（2桁に正規化）
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
