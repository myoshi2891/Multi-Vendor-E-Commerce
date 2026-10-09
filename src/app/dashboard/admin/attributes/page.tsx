import {
    getAllAttributeDefinitions,
    upsertAttributeDefinition,
    archiveAttributeDefinition,
    restoreAttributeDefinition,
    changeAttributeTypeToNumber,
} from "@/queries/attribute";
import AdminAttributes from "@/components/dashboard/admin/admin-attributes";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
import { getAttributeCategoryOptions } from "./category-options";
export const dynamic = "force-dynamic";
export default async function AdminAttributesPage() {
    const result = await Promise.all([
        getAllAttributeDefinitions(),
        getAttributeCategoryOptions(),
    ]).catch(() => null);
    if (!result)
        return (
            <SellerPage
                workspace="Administration"
                id="admin-attributes"
                title="Attributes"
            >
                <LoadError subject="attributes" />
            </SellerPage>
        );
    return (
        <AdminAttributes
            attributes={result[0]}
            categories={result[1]}
            actions={{
                saveAction: upsertAttributeDefinition,
                archiveAction: archiveAttributeDefinition,
                restoreAction: restoreAttributeDefinition,
                convertAction: changeAttributeTypeToNumber,
            }}
        />
    );
}
