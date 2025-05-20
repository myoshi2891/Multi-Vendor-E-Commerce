import StoreDefaultShippingDetails from "@/components/dashboard/forms/store-default-shipping-details";
import { getStoreDefaultShippingDetails } from "@/queries/store";

export default async function SellerStoreShippingPage({
	params,
}: {
	params: { storeUrl: string };
}) {
	const shippingDetails = await getStoreDefaultShippingDetails(
		params.storeUrl
	);
	console.log(shippingDetails);

	return (
		<div>
			<StoreDefaultShippingDetails
				data={shippingDetails}
				storeUrl={params.storeUrl}
			/>
		</div>
	);
}
