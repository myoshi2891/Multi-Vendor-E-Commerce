import { flattenCategoryTree } from "@/lib/category-tree";
import { getAllCategories } from "@/queries/category";
import type { AttributeCategoryOption } from "@/components/dashboard/forms/attribute-details";

/**
 * 属性定義フォームのカテゴリ選択肢（全階層・pre-order）。
 * 属性はどの深さのノードにも定義でき、子孫へ継承される（design.md §3）。
 */
export const getAttributeCategoryOptions = async (): Promise<
    AttributeCategoryOption[]
> => {
    const tree = await getAllCategories();
    return flattenCategoryTree(tree).map(({ id, name, path, depth }) => ({
        id,
        name,
        path,
        depth,
    }));
};
