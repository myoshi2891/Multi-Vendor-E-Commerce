// Queries
import { getAllAttributeDefinitions } from "@/queries/attribute";

// Data table
import DataTable from "@/components/ui/data-table";

// Plus icon
import { Plus } from "lucide-react";

// Attribute details form
import AttributeDetails from "@/components/dashboard/forms/attribute-details";

// Columns
import { columns } from "./columns";
import { getAttributeCategoryOptions } from "./category-options";

export const dynamic = "force-dynamic";

export default async function AdminAttributesPage() {
    const [attributes, categories] = await Promise.all([
        getAllAttributeDefinitions(),
        getAttributeCategoryOptions(),
    ]);

    return (
        <DataTable
            actionButtonText={
                <>
                    <Plus size={15} />
                    Create attribute
                </>
            }
            modalChildren={<AttributeDetails categories={categories} />}
            newTabLink="/dashboard/admin/attributes/new"
            filterValue="name"
            data={attributes.map((attribute) => ({ ...attribute, categories }))}
            searchPlaceholder="Search attribute name..."
            columns={columns}
        />
    );
}
