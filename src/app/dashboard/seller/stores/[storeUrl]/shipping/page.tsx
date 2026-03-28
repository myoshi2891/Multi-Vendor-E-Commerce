import StoreDefaultShippingDetails from "@/components/dashboard/forms/store-default-shipping-details";
import DataTable from "@/components/ui/data-table";
import {
	getStoreDefaultShippingDetails,
	getStoreShippingRates,
} from "@/queries/store";
import { redirect } from "next/navigation";
import { columns } from "./columns";

/**
 * Renders the seller store shipping page by loading and displaying the store's default shipping details and shipping rates.
 *
 * @param params - A promise that resolves to route parameters containing `storeUrl`, the store identifier used to fetch shipping data.
 * @returns The page JSX containing `StoreDefaultShippingDetails` and a `DataTable` of shipping rates for the store. If the shipping details or rates cannot be loaded, the request is redirected to the site root (`/`).
 */
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
