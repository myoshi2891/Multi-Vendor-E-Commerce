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

const ShippingDetails: FC<Props> = (props) => {
	if (typeof props.shippingDetails === "boolean") return null;
	return <ShippingDetailsInner {...props} />;
};

const ShippingDetailsInner: FC<Props> = ({ shippingDetails, quantity, weight }) => {
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [quantity, shippingFeeMethod, shippingFee, extraShippingFee]);

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
							<span className="flex items-center text-sm font-bold">
								<span>
									Free Shipping to
									<span>{countryName}</span>
								</span>
							</span>
						) : (
							<span className="flex items-center text-sm font-bold">
								<span>
									Shipping to <span>{countryName}</span>
								</span>
								<span>&nbsp;for ${shippingTotal}</span>
							</span>
						)}
					</div>
					<ChevronRight className="w-3" />
				</div>
				<span className="ml-5 flex items-center text-sm">
					Service:&nbsp;
					<strong className="text-sm">{shippingService}</strong>
				</span>
				<span className="ml-5 flex items-center text-sm">
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
						quantity={quantity}
					/>
				)}
				<div
					onClick={() => setToggle((prev) => !prev)}
					className="ml-4 flex h-5 max-w-[calc(100%-2rem)] cursor-pointer items-center bg-gray-100 hover:bg-gray-200"
				>
					<div className="flex w-full items-center justify-between gap-x-1 px-2">
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
		</div>
	);
};

export default ShippingDetails;
