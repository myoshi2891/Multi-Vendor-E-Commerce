import { Check } from "lucide-react";
import { Span } from "next/dist/trace";
import { FC } from "react";

interface Props {
	method: string;
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
	switch (method) {
		case "ITEM":
			return (
				<div className="w-full pb-1">
					{/* Notes */}
					<div className="w-full">
						<span className="text-xs flex gap-x-1">
							<Check className="min-w-3 max-w-3 stroke-green-400" />
							<span className="mt-1">
								This store calculates the delivery fee based on
								the number of items in the order.
							</span>
						</span>
						{fee !== extraFee && (
							<span className="text-xs flex gap-x-1">
								<Check className="min-w-3 max-w-3 stroke-green-400" />
								<span className="mt-1">
									If you purchase multiple items, you'll
									receive a discounted delivery fee.
								</span>
							</span>
						)}
					</div>
					<table className="w-full mt-1.5">
						<thead className="w-full">
							{fee === extraFee || extraFee === 0 ? (
								<tr
									className="grid gap-x-1 text-xs px-4"
									style={{ gridTemplateColumns: "4fr 1fr" }}
								>
									<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
										Fee per item
									</td>
									<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
										${fee}
									</td>
								</tr>
							) : (
								<div className="space-y-1">
									<tr
										className="grid gap-x-1 text-xs px-4"
										style={{
											gridTemplateColumns: "4fr 1fr",
										}}
									>
										<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
											Fee for First Item
										</td>
										<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
											${fee}
										</td>
									</tr>
									<tr
										className="grid gap-x-1 text-xs px-4"
										style={{
											gridTemplateColumns: "4fr 1fr",
										}}
									>
										<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
											Fee for Each Additional Item
										</td>
										<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
											${extraFee}
										</td>
									</tr>
								</div>
							)}
						</thead>
						<tbody>
							<tr
								className="grid gap-x-1 text-xs px-4 mt-1"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									Quantity
								</td>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									x{quantity}
								</td>
							</tr>
							<tr className="flex gap-x-1 text-xs px-4 mt-1 text-center font-semibold">
								<td className="w-full bg-black text-white px-1 py-1">
									{quantity === 1 || fee === extraFee ? (
										<span>
											${fee} (fee) x {quantity} (items) =
											${fee * quantity}
										</span>
									) : (
										<span>
											${fee} (first item) + {quantity - 1}{" "}
											(additional items) x ${extraFee} = $
											{fee + (quantity - 1) * extraFee}
										</span>
									)}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			);
			break;
		case "WEIGHT":
			return (
				<div className="w-full pb-1">
					{/* Notes */}
					<div className="w-full">
						<span className="text-xs flex gap-x-1">
							<Check className="min-w-3 max-w-3 stroke-green-400" />
							<span className="mt-1">
								This store calculates the delivery fee bases on
								product weight
							</span>
						</span>
					</div>
					<table className="w-full mt-1.5">
						<thead className="w-full">
							<tr
								className="grid gap-x-1 text-xs px-4"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									Fee per kg (1kg = 2,205lbs)
								</td>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									${fee}
								</td>
							</tr>
						</thead>
						<tbody>
							<tr
								className="grid gap-x-1 text-xs px-4 mt-1"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									Quantity
								</td>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									x{quantity}
								</td>
							</tr>
							<tr className="flex gap-x-1 text-xs px-4 mt-1 text-center font-semibold">
								<td className="w-full bg-black text-white px-1 py-1">
									<span>
										${fee} (fee) x {weight}kg (weight) x
										{quantity} (items) = $
										{fee * weight * quantity} (total fee)
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			);
			break;
		case "FIXED":
			return (
				<div className="w-full pb-1">
					{/* Notes */}
					<div className="w-full">
						<span className="text-xs flex gap-x-1">
							<Check className="min-w-3 max-w-3 stroke-green-400" />
							<span className="mt-1">
								This store calculates the delivery fee on a
								fixed price.
							</span>
						</span>
					</div>
					<table className="w-full mt-1.5">
						<thead className="w-full">
							<tr
								className="grid gap-x-1 text-xs px-4"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									Fee
								</td>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									${fee}
								</td>
							</tr>
						</thead>
						<tbody>
							<tr
								className="grid gap-x-1 text-xs px-4 mt-1"
								style={{ gridTemplateColumns: "4fr 1fr" }}
							>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									Quantity
								</td>
								<td className="w-full bg-gray-50 px-2 py-0.5 rounded-sm">
									x{quantity}
								</td>
							</tr>
							<tr className="flex gap-x-1 text-xs px-4 mt-1 text-center font-semibold">
								<td className="w-full bg-black text-white px-1 py-1">
									<span>
										${fee} (quantity doesn't affect shipping
										fee.)
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			);
			break;
		default:
			return null;
			break;
	}
};

export default ProductShippingFee;
