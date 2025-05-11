// Queries
import DataTable from "@/components/ui/data-table";
import { getAllStoreProducts } from "@/queries/product";
import { columns } from "./columns";
import { Plus } from "lucide-react";
import ProductDetails from "@/components/dashboard/forms/product-details";
import { getAllCategories } from "@/queries/category";

export default async function SellerProductPage({
	params,
}: {
	params: { storeUrl: string };
}) {
	// Fetching products data from the database for the active store
	const products = await getAllStoreProducts(params.storeUrl);

	const categories = await getAllCategories();
	// const offerTags = await getAllOfferTags();

	return (
		<DataTable
			actionButtonText={
				<>
					<Plus size={15} />
					Create New Product
				</>
			}
			modalChildren={
				<ProductDetails
					categories={categories}
					// offerTags={}
					storeUrl={params.storeUrl}
				/>
			}
			newTabLink={`/dashboard/seller/stores/${params.storeUrl}/products/new`}
			filterValue="name"
			data={products}
			columns={columns}
			searchPlaceholder="Search product name..."
		/>
	);
}
