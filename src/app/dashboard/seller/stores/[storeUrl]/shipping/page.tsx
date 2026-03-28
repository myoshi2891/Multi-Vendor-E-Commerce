import StoreDefaultShippingDetails from "@/components/dashboard/forms/store-default-shipping-details";
import DataTable from "@/components/ui/data-table";
import {
	getStoreDefaultShippingDetails,
	getStoreShippingRates,
} from "@/queries/store";
import { redirect } from "next/navigation";
import { columns } from "./columns";

export default async function SellerStoreShippingPage({
	params,
}: {
	params: Promise<{ storeUrl: string }>;
}) {
	const { storeUrl } = await params;
	const shippingDetails = await getStoreDefaultShippingDetails(
		storeUrl
	);
	const shippingRates = await getStoreShippingRates(storeUrl);
	if (!shippingDetails || !shippingRates) return redirect("/");

	return (
		<div>
			<StoreDefaultShippingDetails
				data={shippingDetails}
				storeUrl={storeUrl}
			/>
			<DataTable
				filterValue="countryName"
				data={shippingRates}
				columns={columns}
				searchPlaceholder="Search by country name..."
			/>
		</div>
	);
}
