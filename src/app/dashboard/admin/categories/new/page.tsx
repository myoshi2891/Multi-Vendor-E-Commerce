import CategoryForm from "@/components/dashboard/admin/category-form";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
import { flattenCategoryTree } from "@/lib/category-tree";
import { getAllCategories, upsertCategory } from "@/queries/category";
export const dynamic = "force-dynamic";
export default async function AdminNewCategoryPage() {
    const tree = await getAllCategories().catch(() => null);
    return (
        <SellerPage
            workspace="Administration"
            id="admin-new-category"
            title="Create category"
            description="Add a department or a child category to the catalog."
        >
            {tree ? (
                <CategoryForm
                    categories={flattenCategoryTree(tree)}
                    saveAction={upsertCategory}
                />
            ) : (
                <LoadError subject="parent categories" />
            )}
        </SellerPage>
    );
}
