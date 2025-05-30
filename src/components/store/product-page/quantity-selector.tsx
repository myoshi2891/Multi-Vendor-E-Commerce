import { CartProductType } from "@/lib/types";
import { Size } from "@prisma/client";
import { Minus, Plus } from "lucide-react";
import { FC, useEffect } from "react";

interface QuantitySelectorProps {
	productId: string;
	variantId: string;
	sizeId: string | null;
	quantity: number;
	stock: number;
	handleChange: (property: keyof CartProductType, value: any) => void;
	sizes: Size[];
}

const QuantitySelector: FC<QuantitySelectorProps> = ({
	handleChange,
	productId,
	variantId,
	sizeId,
	quantity,
	stock,
	sizes,
}) => {
	// If no sizeId is provided, return null to prevent rendering the component
	if (!sizeId) return null;

	// useEffect hook to handle changes when sizeId updates
	useEffect(() => {
		handleChange("quantity", 1);
	}, [sizeId]);

	// Function to handle increasing the quantity of the product
	const handleIncrease = () => {
		if (quantity < stock) {
			handleChange("quantity", quantity + 1);
		}
	};

	// Function to handle decreasing the quantity of the product
	const handleDecrease = () => {
		if (quantity > 1) {
			handleChange("quantity", quantity - 1);
		}
	};

	return (
		<div className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg">
			<div className="w-full flex justify-between items-center gap-x-5">
				<div className="grow">
					<span className="block text-xs text-gray-500">
						Select quantity
					</span>
					<input
						type="number"
						className="w-full p-0 bg-transparent border-0 focus:outline-0 text-gray-800"
						min={1}
						value={quantity}
						readOnly
					/>
				</div>
				<div className="flex justify-end items-center gap-x-1.5">
					<button
						onClick={handleDecrease}
						className="size-6 inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-full border border-gray-200 bg-white shadow-sm focus:outline-none focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
						disabled={quantity === 1}
					>
						<Minus className="w-3" />
					</button>
					<button
						onClick={handleIncrease}
						className="size-6 inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-full border border-gray-200 bg-white shadow-sm focus:outline-none focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
						disabled={quantity === stock}
					>
						<Plus className="w-3" />
					</button>
				</div>
			</div>
		</div>
	);
};

export default QuantitySelector;
