import { notFound } from "next/navigation";
import {
    getAttributeDefinition,
    upsertAttributeOption,
    archiveAttributeOption,
    restoreAttributeOption,
} from "@/queries/attribute";
import AdminAttributeOptions from "@/components/dashboard/admin/admin-attribute-options";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
export const dynamic = "force-dynamic";
export default async function AdminAttributeOptionsPage({
    params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
    const { id } = await params;
    let definition;
    try {
        definition = await getAttributeDefinition(id);
    } catch {
        return (
            <SellerPage
                workspace="Administration"
                id="admin-attribute-options"
                title="Attribute options"
            >
                <LoadError subject="attribute options" />
            </SellerPage>
        );
    }
    if (definition?.type !== "ENUM") notFound();
    return (
        <AdminAttributeOptions
            definition={definition}
            actions={{
                saveAction: upsertAttributeOption,
                archiveAction: archiveAttributeOption,
                restoreAction: restoreAttributeOption,
            }}
        />
    );
}
