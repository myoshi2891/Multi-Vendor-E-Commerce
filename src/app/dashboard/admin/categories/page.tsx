// Queries
import { getAllCategories } from "@/queries/category";
// カテゴリツリー（materialized path）の共通ヘルパー
import { flattenCategoryTree } from "@/lib/category-tree";
// Data table
import DataTable from "@/components/ui/data-table";
import { Plus } from "lucide-react";
import CategoryDetails from "@/components/dashboard/forms/category-details";
import { columns } from "./columns";

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
	// `getAllCategories` はルートノードの配列（children 付き）を返すため、
	// そのまま DataTable に渡すとルートしか行にならない。1 テーブルで全階層を
	// 扱う（plan 068 で SubCategory の別ルートを廃止した）ので、pre-order で
	// 平坦化してから渡す —— 並び順は getAllCategories の
	// orderBy [depth, sortOrder, name] が決めており、ここでは並べ替えない。
	const categoryTree = await getAllCategories();

	// Checkig if no categories are found
	if (!categoryTree) return null;

	const categories = flattenCategoryTree(categoryTree);

	// Rendering the page with fetched categories
	return (
		<DataTable
			actionButtonText={
				<>
					<Plus size={15} />
					Create New Category
				</>
			}
			modalChildren={<CategoryDetails categories={categories} />}
			newTabLink="/dashboard/admin/categories/new"
			filterValue="name"
			data={categories}
			searchPlaceholder="Search category name ..."
			columns={columns}
		/>
	);
}
