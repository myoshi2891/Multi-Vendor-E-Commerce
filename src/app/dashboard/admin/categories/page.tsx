// Queries
import { getAllCategories } from "@/queries/category";
// Data table
import DataTable from "@/components/ui/data-table";
import { Plus } from "lucide-react";
import CategoryDetails from "@/components/dashboard/forms/category-details";
export default async function AdminCategoriesPage() {
	// Fetching stores data from the database
	const categories = await getAllCategories();

	// Checkig if no categories are found
	if (!categories) return null;

	const CLOUDINARY_CLOUD_KEY = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_NAME;
	if (!CLOUDINARY_CLOUD_KEY) return null;

	// Rendering the page with fetched categories
	return (
		<DataTable
			actionButtonText={
				<>
					<Plus size={15} />
					Create New Category
				</>
			}
			modalChildren={
				<CategoryDetails cloudinary_key={CLOUDINARY_CLOUD_KEY} />
			}
			filterValue="name"
			data={categories}
			searchPlaceholder="Search category name ..."
			columns={[]}
		/>
	);
}
