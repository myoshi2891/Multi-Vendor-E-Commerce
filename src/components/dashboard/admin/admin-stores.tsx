"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import type { updateStoreStatus, deleteStore } from "@/queries/store";
import { StoreStatus } from "@/lib/types";
import type { AdminStoreRow } from "@/lib/admin-stores";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/ui/data-table";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import SellerPage from "../design/seller-page";
import styles from "../design/seller.module.css";
import ConfirmDelete from "../design/confirm-delete";
import StatusEditor from "../seller/status-editor";
type Actions = {
    updateStatusAction: typeof updateStoreStatus;
    deleteAction: typeof deleteStore;
};
function StoreState({
    store,
    actions,
}: {
    store: AdminStoreRow;
    actions: Actions;
}) {
    return (
        <StatusEditor
            label={`Store status ${store.name}`}
            initialStatus={store.status}
            options={Object.values(StoreStatus)}
            saveAction={(value) =>
                actions.updateStatusAction(store.id, value as StoreStatus)
            }
        />
    );
}
function Details({
    store,
    actions,
}: {
    store: AdminStoreRow;
    actions: Actions;
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">View store {store.name}</Button>
            </DialogTrigger>
            <DialogContent className={`${styles.theme} ${styles.dialog}`}>
                <DialogHeader>
                    <DialogTitle>{store.name}</DialogTitle>
                    <DialogDescription>
                        Store details · {store.id}
                    </DialogDescription>
                </DialogHeader>
                {store.cover && (
                    <Image
                        src={store.cover}
                        alt={`${store.name} cover`}
                        width={800}
                        height={300}
                        className="max-h-64 w-full object-cover"
                    />
                )}
                {store.logo && (
                    <Image
                        src={store.logo}
                        alt={`${store.name} logo`}
                        width={96}
                        height={96}
                        className="size-24 object-cover"
                    />
                )}
                <p>{store.description}</p>
                <StoreState store={store} actions={actions} />
                <dl className={styles.grid}>
                    {[
                        ["Email", store.email],
                        ["Phone", store.phone],
                        ["URL", `/${store.url}`],
                        ...store.shipping,
                    ].map(([label, value]) => (
                        <div key={label}>
                            <dt className="text-sm text-muted-foreground">
                                {label}
                            </dt>
                            <dd>{value}</dd>
                        </div>
                    ))}
                </dl>
            </DialogContent>
        </Dialog>
    );
}
export function getAdminStoreColumns(
    actions: Actions
): ColumnDef<AdminStoreRow>[] {
    return [
        {
            id: "image",
            header: "Images",
            cell: ({ row }) =>
                row.original.logo ? (
                    <Image
                        src={row.original.logo}
                        alt={row.original.name}
                        width={96}
                        height={96}
                        className="size-24 object-cover"
                    />
                ) : (
                    <span>No image</span>
                ),
        },
        { accessorKey: "name", header: "Name" },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => (
                <p className="line-clamp-3">{row.original.description}</p>
            ),
        },
        { accessorKey: "url", header: "URL" },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <StoreState
                    key={`${row.original.id}:${row.original.status}`}
                    store={row.original}
                    actions={actions}
                />
            ),
        },
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
                    <Details store={row.original} actions={actions} />
                    <ConfirmDelete
                        label={`store ${row.original.name}`}
                        deleteAction={() =>
                            actions.deleteAction(row.original.id)
                        }
                    />
                </div>
            ),
        },
    ];
}
export default function AdminStores({
    stores,
    actions,
}: {
    stores: AdminStoreRow[];
    actions: Actions;
}) {
    // 列定義を毎 render 作ると router.refresh() のたびに行内の要素が remount され、成功表示や
    // Dialog のフォーカス復帰先が失われる。refresh ごとに別参照になる Server Action は初回の参照を
    // 固定し、列定義を useMemo で固定する（seller-shipping.tsx と同じ）
    const [stableActions] = useState(() => actions);
    const columns = useMemo(
        () => getAdminStoreColumns(stableActions),
        [stableActions]
    );
    return (
        <SellerPage
            workspace="Administration"
            id="admin-stores"
            title="Stores"
            description="Review stores, their shipping details and approval status."
        >
            <DataTable
                design="seller"
                data={stores}
                columns={columns}
                filterValue="name"
                searchPlaceholder="Search store name ..."
            />
        </SellerPage>
    );
}
