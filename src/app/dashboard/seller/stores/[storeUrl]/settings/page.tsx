// DB
import { db } from "@/lib/db";

import StoreDetails from "@/components/dashboard/forms/store-details";
import { redirect } from "next/navigation";
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
