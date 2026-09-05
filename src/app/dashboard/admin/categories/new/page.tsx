import CategoryDetails from "@/components/dashboard/forms/category-details";
import { flattenCategoryTree } from "@/lib/category-tree";
import { getAllCategories } from "@/queries/category";
import React from "react";

export const dynamic = "force-dynamic";

export default async function AdminNewCategoryPage() {
	// 親選択の候補。pre-order の平坦化なので、選択肢の並びが木の形になる。
	const categories = flattenCategoryTree(await getAllCategories());

	return (
		<div className="w-full">
			<CategoryDetails categories={categories} />
		</div>
	);
}
