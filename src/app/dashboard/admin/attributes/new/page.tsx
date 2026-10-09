import { upsertAttributeDefinition } from "@/queries/attribute";
import AttributeDetails from "@/components/dashboard/forms/attribute-details";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
import { getAttributeCategoryOptions } from "../category-options";
export const dynamic = "force-dynamic";
export default async function AdminNewAttributePage() {
    const categories = await getAttributeCategoryOptions().catch(() => null);
    return (
        <SellerPage
            workspace="Administration"
            id="admin-new-attribute"
            title="Create attribute"
            description="Define a structured attribute inherited by descendant categories."
        >
            {categories ? (
                <AttributeDetails
                    saveAction={upsertAttributeDefinition}
                    categories={categories}
                />
            ) : (
                <LoadError subject="categories" />
            )}
        </SellerPage>
    );
}
