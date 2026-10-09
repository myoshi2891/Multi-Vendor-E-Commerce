"use client";
import {
    AttributeCategoriesProvider,
    columns,
    type AttributeRow,
} from "@/app/dashboard/admin/attributes/columns";
import type { AttributeCategoryOption } from "../forms/attribute-details";
import AttributeDetails from "../forms/attribute-details";
import type { AttributeActions } from "./attribute-actions";
import DataTable from "@/components/ui/data-table";
import SellerPage from "../design/seller-page";
import MasterDialog from "./master-dialog";
export default function AdminAttributes({
    attributes,
    categories,
    actions,
}: {
    attributes: AttributeRow[];
    categories: AttributeCategoryOption[];
    actions: AttributeActions;
}) {
    return (
        <AttributeCategoriesProvider categories={categories} actions={actions}>
            <SellerPage
                workspace="Administration"
                id="admin-attributes"
                title="Attributes"
                description="Manage structured attributes inherited by descendant categories."
            >
                <div>
                    <MasterDialog label="Create attribute">
                        {(_, onBusyChange) => (
                            <AttributeDetails
                                categories={categories}
                                saveAction={actions.saveAction}
                                onBusyChange={onBusyChange}
                            />
                        )}
                    </MasterDialog>
                </div>
                <DataTable
                    design="seller"
                    columns={columns}
                    data={attributes}
                    filterValue="name"
                    searchPlaceholder="Search attribute name..."
                    newTabLink="/dashboard/admin/attributes/new"
                />
            </SellerPage>
        </AttributeCategoriesProvider>
    );
}
