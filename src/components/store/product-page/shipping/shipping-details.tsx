"use client";
import { ProductShippingDetailsType } from "@/lib/types";
import { ChevronDown, ChevronRight, ChevronUp, Truck } from "lucide-react";
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
	const [toggle, setToggle] = useState<boolean>(false);
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
				{!shippingDetails.isFreeShipping && toggle && (
					<ProductShippingFee
						fee={shippingFee}
						extraFee={extraShippingFee}
						method={shippingFeeMethod}
						weight={weight}
						quantity={5}
					/>
				)}
				<div
					onClick={() => setToggle((prev) => !prev)}
					className="max-w-[calc(100%-2rem)] ml-4 flex items-center bg-gray-100 hover:bg-gray-200 h-5 cursor-pointer"
				>
					<div className="w-full flex items-center justify-between gap-x-1 px-2">
						<span className="text-xs">
							{toggle ? "Hide" : "Shipping Fee Breakdown"}
						</span>
						{toggle ? (
							<ChevronUp className="w-4" />
						) : (
							<ChevronDown className="w-4" />
						)}
					</div>
				</div>
			</div>
			<div className="h-20"></div>
		</div>
	);
};

export default ShippingDetails;
