// Queries
import { getAllStores } from "@/queries/store";
// Data table
import DataTable from "@/components/ui/data-table";
import { columns } from "./columns";
export default async function AdminStoresPage() {
	// Fetching stores data from the database
	const stores = await getAllStores();

	// Rendering the page with fetched categories
	return (
		<DataTable
			filterValue="name"
			data={stores}
			searchPlaceholder="Search store name ..."
			columns={columns}
		/>
	);
}
