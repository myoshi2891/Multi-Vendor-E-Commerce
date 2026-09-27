import { notFound } from "next/navigation";

// Queries
import { getAttributeDefinition } from "@/queries/attribute";

// Components
import DataTable from "@/components/ui/data-table";
import AttributeOptionDetails from "@/components/dashboard/forms/attribute-option-details";

// Columns
import { columns } from "./columns";

export const dynamic = "force-dynamic";

export default async function AdminAttributeOptionsPage({
    params,
}: Readonly<{
    params: Promise<{ id: string }>;
}>) {
    const { id } = await params;
    const definition = await getAttributeDefinition(id);
    if (definition?.type !== "ENUM") notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold">
                    {definition.name} options
                </h1>
                <p className="text-sm text-muted-foreground">
                    /{definition.category.path} · key: {definition.key}
                    {definition.multiValued ? " · multi-valued" : ""}
                </p>
            </div>
            {!definition.archivedAt && (
                <AttributeOptionDetails definitionId={definition.id} />
            )}
            <DataTable
                noHeader
                filterValue="label"
                data={definition.options}
                searchPlaceholder="Search option label..."
                columns={columns}
            />
        </div>
    );
}
