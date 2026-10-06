"use client";
import Image from "next/image";
import type { Category } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import type {
    getCategory,
    upsertCategory,
    deleteCategory,
} from "@/queries/category";
import DataTable from "@/components/ui/data-table";
import SellerPage from "../design/seller-page";
import ConfirmDelete from "../design/confirm-delete";
import CategoryForm from "./category-form";
import MasterDialog from "./master-dialog";
export type CategoryActions = {
    loadAction: typeof getCategory;
    saveAction: typeof upsertCategory;
    deleteAction: typeof deleteCategory;
};
export function getCategoryColumns(
    categories: Category[],
    actions: CategoryActions
): ColumnDef<Category>[] {
    return [
        {
            id: "image",
            header: "Image",
            cell: ({ row }) => (
                <Image
                    src={row.original.image}
                    alt={row.original.name}
                    width={80}
                    height={80}
                    className="size-20 object-cover"
                />
            ),
        },
        {
            accessorKey: "name",
            header: "Name",
            cell: ({ row }) => (
                <span style={{ paddingLeft: row.original.depth * 16 }}>
                    {row.original.name}
                </span>
            ),
        },
        {
            accessorKey: "url",
            header: "URL",
            cell: ({ row }) => <span>/{row.original.url}</span>,
        },
        {
            id: "parent",
            header: "Parent",
            cell: ({ row }) => (
                <span>
                    {row.original.path.includes("/")
                        ? `/${row.original.path.split("/").at(-2)}`
                        : "—"}
                </span>
            ),
        },
        { accessorKey: "sortOrder", header: "Order" },
        {
            accessorKey: "featured",
            header: "Featured",
            cell: ({ row }) => (
                <span>{row.original.featured ? "Featured" : "Standard"}</span>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <div className="space-y-3">
                    <MasterDialog
                        label={`Edit category ${row.original.name}`}
                        loadAction={() => actions.loadAction(row.original.id)}
                    >
                        {(data, onBusyChange) => (
                            <CategoryForm
                                data={data}
                                categories={categories}
                                saveAction={actions.saveAction}
                                onBusyChange={onBusyChange}
                            />
                        )}
                    </MasterDialog>
                    <ConfirmDelete
                        label={`category ${row.original.name}`}
                        deleteAction={() =>
                            actions.deleteAction(row.original.id)
                        }
                    />
                </div>
            ),
        },
    ];
}
export default function AdminCategories({
    categories,
    actions,
}: {
    categories: Category[];
    actions: CategoryActions;
}) {
    return (
        <SellerPage
            workspace="Administration"
            id="admin-categories"
            title="Categories"
            description="Manage catalog hierarchy, images and featured categories."
        >
            <div>
                <MasterDialog<Category> label="Create New Category">
                    {(_, onBusyChange) => (
                        <CategoryForm
                            categories={categories}
                            saveAction={actions.saveAction}
                            onBusyChange={onBusyChange}
                        />
                    )}
                </MasterDialog>
            </div>
            <DataTable
                design="seller"
                data={categories}
                columns={getCategoryColumns(categories, actions)}
                filterValue="name"
                searchPlaceholder="Search category name ..."
                newTabLink="/dashboard/admin/categories/new"
            />
        </SellerPage>
    );
}
