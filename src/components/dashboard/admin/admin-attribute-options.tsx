"use client";
import type { getAttributeDefinition } from "@/queries/attribute";
import { getAttributeOptionColumns } from "@/app/dashboard/admin/attributes/[id]/options/columns";
import DataTable from "@/components/ui/data-table";
import SellerPage from "../design/seller-page";
import AttributeOptionDetails from "../forms/attribute-option-details";
import attributeStyles from "./attribute.module.css";
import type { AttributeOptionActions } from "./attribute-actions";
export default function AdminAttributeOptions({
    definition,
    actions,
}: {
    definition: NonNullable<Awaited<ReturnType<typeof getAttributeDefinition>>>;
    actions: AttributeOptionActions;
}) {
    return (
        <div className={attributeStyles.surface}>
            <SellerPage
                workspace="Administration"
                id="admin-attribute-options"
                title={`${definition.name} options`}
                description={`/${definition.category.path} · key: ${definition.key}${definition.multiValued ? " · multi-valued" : ""}`}
            >
                {definition.archivedAt ? (
                    <p role="status">
                        This attribute is archived. Existing options are
                        retained.
                    </p>
                ) : (
                    <AttributeOptionDetails
                        definitionId={definition.id}
                        saveAction={actions.saveAction}
                    />
                )}
                <DataTable
                    design="seller"
                    data={definition.options}
                    columns={getAttributeOptionColumns(actions)}
                    filterValue="label"
                    searchPlaceholder="Search option label..."
                />
            </SellerPage>
        </div>
    );
}
