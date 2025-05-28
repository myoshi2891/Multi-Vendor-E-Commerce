"use client";
import { ProductShippingDetailsType } from "@/lib/types";
import { Truck } from "lucide-react";
import { FC, useEffect, useState } from "react";

interface Props {
	shippingDetails: ProductShippingDetailsType;
	quantity: number;
	weight: number;
}

const ShippingDetails: FC<Props> = ({ shippingDetails, quantity, weight }) => {
	if (typeof shippingDetails === "boolean") return null;
	const {
		countryName,
		deliveryTimeMax,
		deliveryTimeMin,
		shippingFee,
		extraShippingFee,
		returnPolicy,
		shippingFeeMethod,
		shippingService,
	} = shippingDetails;

	const [shippingTotal, setShippingTotal] = useState<number>();
	useEffect(() => {
		switch (shippingFeeMethod) {
			case "ITEM":
				let qty = quantity - 1;
				setShippingTotal(shippingFee + qty * extraShippingFee);
				break;
			case "WEIGHT":
				setShippingTotal(shippingFee * quantity);
				break;
			case "FIXED":
				setShippingTotal(shippingFee);
				break;
			default:
				break;
		}
	}, [quantity]);
	return (
		<div>
			<div className="space-y-1">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-x-1">
						<Truck className="w-4" />
						{shippingDetails.isFreeShipping ? (
							<span className="text-sm font-bold flex items-center">
								<span>
									Free Shipping to&nbsp;
									<span>{countryName}</span>
								</span>
							</span>
						) : (
							<span className="text-sm font-bold flex items-center">
								<span>
									Shipping to&nbsp;<span>{countryName}</span>
								</span>
								<span>&nbsp;for ${shippingTotal}</span>
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default ShippingDetails;
