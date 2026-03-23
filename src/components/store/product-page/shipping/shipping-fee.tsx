import { Check } from "lucide-react";
import { FC } from "react";
import { computeShippingTotal } from "@/lib/shipping-utils";
import { ShippingFeeMethod } from "@prisma/client";

interface Props {
	method: ShippingFeeMethod;
	fee: number;
	extraFee: number;
	weight: number;
	quantity: number;
}

const ProductShippingFee: FC<Props> = ({
	method,
	fee,
	extraFee,
	weight,
	quantity,
}) => {
	const total = computeShippingTotal(method, fee, extraFee, weight, quantity);
	switch (method) {
		case "ITEM":
			return (
				<div className="w-full pb-1">
					{/* Notes */}
					<div className="w-full">
						<span className="flex gap-x-1 text-xs">
							<Check className="min-w-3 max-w-3 stroke-green-400" />
							<span className="mt-1">
								This store calculates the delivery fee based on
								the number of items in the order.
							</span>
						</span>
						{fee !== extraFee && (
							<span className="flex gap-x-1 text-xs">
								<Check className="min-w-3 max-w-3 stroke-green-400" />
								<span className="mt-1">
									If you purchase multiple items, you&apos;ll
									receive a discounted delivery fee.
								</span>
							</span>
						)}
					</div>
					<table className="mt-1.5 w-full">
						<thead className="w-full">
							{fee === extraFee ? (
								<tr
									className="grid gap-x-1 px-4 text-xs"
									style={{ gridTemplateColumns: "4fr 1fr" }}
								>
									<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 text-left font-normal">
										Fee per item
									</th>
									<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 text-left font-normal">
										${fee}
									</th>
								</tr>
							) : (
								<>
									<tr
										className="grid gap-x-1 px-4 text-xs"
										style={{
											gridTemplateColumns: "4fr 1fr",
										}}
									>
										<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 text-left font-normal">
											Fee for First Item
										</th>
										<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 text-left font-normal">
											${fee}
										</th>
									</tr>
									<tr
										className="mt-1 grid gap-x-1 px-4 text-xs"
										style={{
											gridTemplateColumns: "4fr 1fr",
										}}
									>
										<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 text-left font-normal">
											Fee for Each Additional Item
										</th>
										<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 text-left font-normal">
											${extraFee}
										</th>
									</tr>
								</>
							)}
						</thead>
						<tbody>
							<tr
								className="mt-1 grid gap-x-1 px-4 text-xs"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<td className="w-full rounded-sm bg-gray-50 px-2 py-0.5">
									Quantity
								</td>
								<td className="w-full rounded-sm bg-gray-50 px-2 py-0.5">
									x{quantity}
								</td>
							</tr>
							<tr className="mt-1 flex gap-x-1 px-4 text-center text-xs font-semibold">
								<td colSpan={2} className="w-full bg-black p-1 text-white">
									{quantity === 1 || fee === extraFee ? (
										<span>
											${fee} (fee) x {quantity} (items) =
											${total}
										</span>
									) : (
										<span>
											${fee} (first item) + {quantity - 1}{" "}
											(additional items) x ${extraFee} = $
											{total}
										</span>
									)}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			);
		case "WEIGHT":
			return (
				<div className="w-full pb-1">
					{/* Notes */}
					<div className="w-full">
						<span className="flex gap-x-1 text-xs">
							<Check className="min-w-3 max-w-3 stroke-green-400" />
							<span className="mt-1">
								This store calculates the delivery fee based on
								product weight
							</span>
						</span>
					</div>
					<table className="mt-1.5 w-full">
						<thead className="w-full">
							<tr
								className="grid gap-x-1 px-4 text-xs"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 font-normal text-left">
									Fee per kg (1 kg = 2.205 lb)
								</th>
								<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 font-normal text-left">
									${fee}
								</th>
							</tr>
						</thead>
						<tbody>
							<tr
								className="mt-1 grid gap-x-1 px-4 text-xs"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<td className="w-full rounded-sm bg-gray-50 px-2 py-0.5">
									Quantity
								</td>
								<td className="w-full rounded-sm bg-gray-50 px-2 py-0.5">
									x{quantity}
								</td>
							</tr>
							<tr className="mt-1 flex gap-x-1 px-4 text-center text-xs font-semibold">
								<td colSpan={2} className="w-full bg-black p-1 text-white">
									<span>
										${fee} (fee) x {weight}kg (weight) x{" "}
										{quantity} (items) = $
										{total} (total fee)
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			);
		case "FIXED":
			return (
				<div className="w-full pb-1">
					{/* Notes */}
					<div className="w-full">
						<span className="flex gap-x-1 text-xs">
							<Check className="min-w-3 max-w-3 stroke-green-400" />
							<span className="mt-1">
								This store calculates the delivery fee on a
								fixed price.
							</span>
						</span>
					</div>
					<table className="mt-1.5 w-full">
						<thead className="w-full">
							<tr
								className="grid gap-x-1 px-4 text-xs"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 font-normal text-left">
									Fee
								</th>
								<th scope="col" className="w-full rounded-sm bg-gray-50 px-2 py-0.5 font-normal text-left">
									${fee}
								</th>
							</tr>
						</thead>
						<tbody>
							<tr
								className="mt-1 grid gap-x-1 px-4 text-xs"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<td className="w-full rounded-sm bg-gray-50 px-2 py-0.5">
									Quantity
								</td>
								<td className="w-full rounded-sm bg-gray-50 px-2 py-0.5">
									x{quantity}
								</td>
							</tr>
							<tr className="mt-1 flex gap-x-1 px-4 text-center text-xs font-semibold">
								<td colSpan={2} className="w-full bg-black p-1 text-white">
									<span>
										${fee} (quantity doesn&apos;t affect shipping
										fee.)
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			);
		default:
			return null;
	}
};

export default ProductShippingFee;
