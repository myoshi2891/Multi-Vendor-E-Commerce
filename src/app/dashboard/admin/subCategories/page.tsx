// Data table
import SubCategoryDetails from "@/components/dashboard/forms/subCategory-details";
import DataTable from "@/components/ui/data-table";
// Queries
import { getAllCategories } from "@/queries/category";
import { getAllSubCategories } from "@/queries/subCategory";
import { Plus } from "lucide-react";
import { columns } from "./columns";

export default async function AdminSubCategoriesPage() {
	// Fetching subCategories data from the database
	const subCategories = await getAllSubCategories();

	// Checking if no subcategories are found
	if (!subCategories) return null;

	// Fetching categories data from the database
	const categories = await getAllCategories();

	// Checking if no categories are found
	if (!categories) return null;

	// Rendering the page with fetched subCategories
	return (
		<DataTable
			actionButtonText={
				<>
					<Plus size={15} />
					Create SubCategory
				</>
			}
			modalChildren={<SubCategoryDetails categories={categories} />}
			filterValue="name"
			data={subCategories}
			searchPlaceholder="Search subCategory name..."
			columns={columns}
		/>
	);
	return <div>AdminSubCategoriesPage</div>;
}
