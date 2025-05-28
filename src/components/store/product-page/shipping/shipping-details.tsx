"use client";
import { ProductShippingDetailsType } from "@/lib/types";
import { ChevronRight, Truck } from "lucide-react";
import { FC, useEffect, useState } from "react";
import ProductShippingFee from "./shipping-fee";
import { getShippingDatesRange } from "@/lib/utils";

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
	}, [quantity, countryName]);

	const { minDate, maxDate } = getShippingDatesRange(
		deliveryTimeMin,
		deliveryTimeMax
	);
	return (
		<div>
			<div className="space-y-1">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-x-1">
						<Truck className="w-4" />
						{shippingDetails.isFreeShipping ? (
							<span className="text-sm font-bold flex items-center">
								<span>
									Free Shipping to
									<span>{countryName}</span>
								</span>
							</span>
						) : (
							<span className="text-sm font-bold flex items-center">
								<span>
									Shipping to <span>{countryName}</span>
								</span>
								<span>&nbsp;for ${shippingTotal}</span>
							</span>
						)}
					</div>
					<ChevronRight className="w-3" />
				</div>
				<span className="flex items-center text-sm ml-5">
					Service:&nbsp;
					<strong className="text-sm">{shippingService}</strong>
				</span>
				<span className="flex items-center text-sm ml-5">
					Delivery:&nbsp;
					<strong className="text-sm">
						{minDate.slice(4)} - {maxDate.slice(4)}
					</strong>
				</span>
				{/* Product shipping fee */}
				{!shippingDetails.isFreeShipping && (
					<ProductShippingFee
						fee={shippingFee}
						extraFee={extraShippingFee}
						method={shippingFeeMethod}
						weight={weight}
						quantity={5}
					/>
				)}
			</div>
		</div>
	);
};

export default ShippingDetails;
