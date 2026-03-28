// DB
import { db } from "@/lib/db";

import StoreDetails from "@/components/dashboard/forms/store-details";
import { redirect } from "next/navigation";
/**
 * Render the seller's store settings page for the store identified by `storeUrl`.
 *
 * @param params - A promise that resolves to an object with the route parameter `storeUrl`, used to look up the store.
 * @returns A React element displaying the store's settings via <StoreDetails />; if the store does not exist, a redirect to "/dashboard/seller/stores" is performed.
 */
export default async function SellerStoreSettingPage({
	params,
}: {
	params: Promise<{ storeUrl: string }>;
}) {
	const { storeUrl } = await params;
	const storeDetails = await db.store.findUnique({
		where: {
			url: storeUrl,
		},
	});
	if (!storeDetails) redirect("/dashboard/seller/stores");
	return (
		<div className="">
			<StoreDetails data={storeDetails} />
		</div>
	);
}
