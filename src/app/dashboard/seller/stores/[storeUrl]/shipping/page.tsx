import StoreDefaultShippingDetails from "@/components/dashboard/forms/store-default-shipping-details";
import {
	getStoreDefaultShippingDetails,
	getStoreShippingRates,
} from "@/queries/store";
import { redirect } from "next/navigation";

export default async function SellerStoreShippingPage({
	params,
}: {
	params: { storeUrl: string };
}) {
	const shippingDetails = await getStoreDefaultShippingDetails(
		params.storeUrl
	);
	if (!shippingDetails) return redirect("/");
	const shippingRates = await getStoreShippingRates(params.storeUrl);

	return (
		<div>
			<StoreDefaultShippingDetails
				data={shippingDetails}
				storeUrl={params.storeUrl}
			/>
		</div>
	);
}
