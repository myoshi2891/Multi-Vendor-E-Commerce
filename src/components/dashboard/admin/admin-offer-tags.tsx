"use client";
import { useMemo, useState } from "react";
import type { OfferTag } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import type {
    getOfferTag,
    upsertOfferTag,
    deleteOfferTag,
} from "@/queries/offer-tag";
import DataTable from "@/components/ui/data-table";
import SellerPage from "../design/seller-page";
import ConfirmDelete from "../design/confirm-delete";
import OfferTagForm from "./offer-tag-form";
import MasterDialog from "./master-dialog";
export type OfferTagActions = {
    loadAction: typeof getOfferTag;
    saveAction: typeof upsertOfferTag;
    deleteAction: typeof deleteOfferTag;
};
export function getOfferTagColumns(
    actions: OfferTagActions
): ColumnDef<OfferTag>[] {
    return [
        { accessorKey: "name", header: "Name" },
        {
            accessorKey: "url",
            header: "URL",
            cell: ({ row }) => <span>/{row.original.url}</span>,
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <div className="space-y-3">
                    <MasterDialog
                        label={`Edit offer tag ${row.original.name}`}
                        loadAction={() => actions.loadAction(row.original.id)}
                    >
                        {(data, onBusyChange) => (
                            <OfferTagForm
                                data={data}
                                saveAction={actions.saveAction}
                                onBusyChange={onBusyChange}
                            />
                        )}
                    </MasterDialog>
                    <ConfirmDelete
                        label={`offer tag ${row.original.name}`}
                        deleteAction={() =>
                            actions.deleteAction(row.original.id)
                        }
                    />
                </div>
            ),
        },
    ];
}
export default function AdminOfferTags({
    tags,
    actions,
}: {
    tags: OfferTag[];
    actions: OfferTagActions;
}) {
    // 列定義を毎 render 作ると router.refresh() のたびに行内の要素が remount され、成功表示や
    // Dialog のフォーカス復帰先が失われる。refresh ごとに別参照になる Server Action は初回の参照を
    // 固定し、列定義を useMemo で固定する（seller-shipping.tsx と同じ）
    const [stableActions] = useState(() => actions);
    const columns = useMemo(
        () => getOfferTagColumns(stableActions),
        [stableActions]
    );
    return (
        <SellerPage
            workspace="Administration"
            id="admin-offer-tags"
            title="Offer tags"
            description="Manage the offer labels used to discover the collection."
        >
            <div>
                <MasterDialog<OfferTag> label="Create New Offer Tag">
                    {(_, onBusyChange) => (
                        <OfferTagForm
                            saveAction={actions.saveAction}
                            onBusyChange={onBusyChange}
                        />
                    )}
                </MasterDialog>
            </div>
            <DataTable
                design="seller"
                data={tags}
                columns={columns}
                filterValue="name"
                searchPlaceholder="Search offer tag name ..."
                newTabLink="/dashboard/admin/offer-tags/new"
            />
        </SellerPage>
    );
}
