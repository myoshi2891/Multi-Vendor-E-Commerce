"use client";
import { useMemo, useState } from "react";
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
// 親候補の categories は引数ではなく表データ（table.options.data）から読む。引数にすると refresh の
// たびに新しい配列となり、列定義が作り直されて行が remount されるため
export function getCategoryColumns(
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
            cell: ({ row, table }) => (
                <div className="space-y-3">
                    <MasterDialog
                        label={`Edit category ${row.original.name}`}
                        loadAction={() => actions.loadAction(row.original.id)}
                    >
                        {(data, onBusyChange) => (
                            <CategoryForm
                                data={data}
                                categories={table.options.data}
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
    // 列定義を毎 render 作ると router.refresh() のたびに行内の要素が remount され、成功表示や
    // Dialog のフォーカス復帰先が失われる。refresh ごとに別参照になる Server Action は初回の参照を
    // 固定し、列定義を useMemo で固定する（seller-shipping.tsx と同じ）
    const [stableActions] = useState(() => actions);
    const columns = useMemo(
        () => getCategoryColumns(stableActions),
        [stableActions]
    );
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
                columns={columns}
                filterValue="name"
                searchPlaceholder="Search category name ..."
                newTabLink="/dashboard/admin/categories/new"
            />
        </SellerPage>
    );
}
