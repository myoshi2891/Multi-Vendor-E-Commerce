import {
    getAllCategories,
    getCategory,
    upsertCategory,
    deleteCategory,
} from "@/queries/category";
import { flattenCategoryTree } from "@/lib/category-tree";
import AdminCategories from "@/components/dashboard/admin/admin-categories";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
export const dynamic = "force-dynamic";
export default async function AdminCategoriesPage() {
    const tree = await getAllCategories().catch(() => null);
    if (!tree)
        return (
            <SellerPage
                workspace="Administration"
                id="admin-categories"
                title="Categories"
            >
                <LoadError subject="categories" />
            </SellerPage>
        );
    return (
        <AdminCategories
            categories={flattenCategoryTree(tree)}
            actions={{
                loadAction: getCategory,
                saveAction: upsertCategory,
                deleteAction: deleteCategory,
            }}
        />
    );
}
