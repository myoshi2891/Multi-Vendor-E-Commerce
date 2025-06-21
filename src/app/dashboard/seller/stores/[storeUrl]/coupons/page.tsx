// Queries
import DataTable from "@/components/ui/data-table";
import { columns } from "./columns";
import { Plus } from "lucide-react";

export default async function SellerCouponsPage({
	params,
}: {
	params: { storeUrl: string };
}) {
	return (
		<div>
		{/* // <DataTable
		// 	actionButtonText={
		// 		<>
		// 			<Plus size={15} />
		// 			Create New Product
		// 		</>
		// 	}
		// 	modalChildren={
		// 		<ProductDetails
		// 			categories={categories}
		// 			// offerTags={}
		// 			storeUrl={params.storeUrl}
		// 		/>
		// 	}
		// 	newTabLink={`/dashboard/seller/stores/${params.storeUrl}/products/new`}
		// 	filterValue="name"
		// 	data={products}
		// 	columns={columns}
		// 	searchPlaceholder="Search product name..."
			// /> */}
			</div>
	);
}
