// Queries
import DataTable from "@/components/ui/data-table";
import { getAllStoreProducts } from "@/queries/product";
import { columns } from "./columns";
import { Plus } from "lucide-react";
import ProductDetails from "@/components/dashboard/forms/product-details";
import { getAllCategories } from "@/queries/category";
import { getAllOfferTags } from "@/queries/offer-tag";
import { getAllCountries } from "@/queries/country";

/**
 * Renders the seller product listing page for the store identified by `storeUrl`.
 *
 * The page displays a data table of the store's products and provides a "Create New Product"
 * modal pre-populated with categories, offer tags, and countries.
 *
 * @param params - A promise that resolves to an object containing the `storeUrl` for the active store
 * @returns A React element for the seller product listing page populated with products, categories, offer tags, and countries
 */
export default async function SellerProductPage({
	params,
}: {
	params: Promise<{ storeUrl: string }>;
}) {
	const { storeUrl } = await params;
	// Fetching products data from the database for the active store
	const [products, categories, offerTags, countries] = await Promise.all([
		getAllStoreProducts(storeUrl),
		getAllCategories(),
		getAllOfferTags(storeUrl),
		getAllCountries(),
	]);

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
					offerTags={offerTags}
					countries={countries}
					storeUrl={storeUrl}
				/>
			}
			newTabLink={`/dashboard/seller/stores/${storeUrl}/products/new`}
			filterValue="name"
			data={products}
			columns={columns}
			searchPlaceholder="Search product name..."
		/>
	);
}
