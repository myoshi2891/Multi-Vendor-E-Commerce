import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { FC } from "react";

interface SimplifiedSize {
	id: string;
	size: string;
	quantity: number;
	price: number;
	discount: number;
}

interface Props {
	sizeId?: string | undefined;
	sizes: SimplifiedSize[];
	isCard?: boolean;
}

const ProductPrice: FC<Props> = ({ sizeId, sizes, isCard }) => {
	// Check if the sizes array is either undefined or empty
	// If no sizes are available, simply return from the function, performing no further
	if (!sizes || sizes.length === 0) return null;

	// Scenario 1: No sizeId passed, calculate range of prices and total quantity
	if (!sizeId) {
		// Calculate discounted prices for all sizes
		const discountedPrices = sizes.map(
			(size) => size.price * (1 - size.discount / 100)
		);

		const totalQuantity = sizes.reduce(
			(total, size) => total + size.quantity,
			0
		);
		const minPrice = Math.min(...discountedPrices).toFixed(2);
		const maxPrice = Math.max(...discountedPrices).toFixed(2);

		// If all prices are the same, return a single price; otherwise, return a range of prices
		const priceDisplay =
			minPrice === maxPrice
				? `$${minPrice}`
				: `$${minPrice} - $${maxPrice}`;

		// If a discount exist when minPrice=maxPrice
		let discount = 0;
		if (minPrice === maxPrice) {
			let check_discount = sizes.find((s) => s.discount > 0);
			if (check_discount) {
				discount = check_discount.discount;
			}
		}
		return (
			<div className="">
				<div className="text-orange-primary inline-block font-bold leading-none mr-2.5">
					<span
						className={cn("inline-block text-4xl text-nowrap", {
							"text-lg": isCard,
						})}
					>
						{priceDisplay}
					</span>
				</div>
				{!sizeId && !isCard && (
					<div className="text-orange-background text-xs leading-4 mt-1">
						<span>Note : Select a size to see the exact price</span>
					</div>
				)}
				{!sizeId && !isCard && (
					<p className="mt-2 text-xs">{totalQuantity} pieces</p>
				)}
			</div>
		);
	}

	// Scenario 2: SizeId passed, find the specific size and return its details
	const selectedSize = sizes.find((size) => size.id === sizeId);

	if (!selectedSize) return <></>;

	// Calculate the price after the discount
	const discountedPrice =
		selectedSize.price * (1 - selectedSize.discount / 100);
	return (
		<div className="">
			<div className="text-orange-primary inline-block font-bold leading-none mr-2.5">
				<span className="inline-block text-4xl">
					${discountedPrice.toFixed(2)}
				</span>
			</div>
			{selectedSize.price !== discountedPrice && (
				<span className="text-[#999] inline-block text-xl font-normal leading-6 mr-2 lime-through">
					${selectedSize.price.toFixed(2)}
				</span>
			)}
			{selectedSize.discount > 0 && (
				<span className="inline-block text-orange-secondary text-xl leading-6">
					{selectedSize.discount}% off
				</span>
			)}
			<p className="mt-2 text-xs">{selectedSize.quantity} pieces</p>
		</div>
	);
};

export default ProductPrice;
