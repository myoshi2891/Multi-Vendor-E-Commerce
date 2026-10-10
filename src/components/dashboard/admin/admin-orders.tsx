"use client";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { OrderStatus } from "@/lib/types";
import type { AdminOrderRow } from "@/lib/admin-orders";
import type { SellerOrderActions } from "@/lib/seller-orders";
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
import StatusEditor from "../seller/status-editor";
import SellerOrderSummary from "../seller/seller-order-summary";
import { ProductImagesCell } from "../shared/order-table-cells";
function Details({
    order,
    actions,
}: {
    order: AdminOrderRow;
    actions: SellerOrderActions;
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">View order {order.id}</Button>
            </DialogTrigger>
            <DialogContent className={`${styles.theme} ${styles.dialog}`}>
                <DialogHeader>
                    <DialogTitle>Order details</DialogTitle>
                    <DialogDescription>Order {order.id}</DialogDescription>
                </DialogHeader>
                {order.groups.map((group) => (
                    <section
                        key={group.id}
                        aria-label={group.storeName}
                        className={styles.panel}
                    >
                        <h2>{group.storeName}</h2>
                        <SellerOrderSummary order={group} actions={actions} />
                    </section>
                ))}
            </DialogContent>
        </Dialog>
    );
}
export function getAdminOrderColumns(
    actions: SellerOrderActions
): ColumnDef<AdminOrderRow>[] {
    return [
        { accessorKey: "id", header: "Order" },
        {
            id: "products",
            header: "Products",
            cell: ({ row }) => (
                <ProductImagesCell
                    images={row.original.groups.flatMap((group) =>
                        group.items.map((item) => item.image).filter(Boolean)
                    )}
                />
            ),
        },
        {
            id: "stores",
            header: "Stores",
            cell: ({ row }) => (
                <div>
                    {row.original.groups.map((group) => (
                        <p key={group.id}>{group.storeName}</p>
                    ))}
                </div>
            ),
        },
        { accessorKey: "paymentStatus", header: "Payment status" },
        {
            id: "status",
            header: "Status",
            cell: ({ row }) => (
                <div className="space-y-3">
                    {row.original.groups.map((group) => (
                        <StatusEditor
                            key={group.id}
                            label={`Order status ${group.id}`}
                            initialStatus={group.status}
                            options={Object.values(OrderStatus)}
                            saveAction={(value) =>
                                actions.updateGroupAction(
                                    group.storeId,
                                    group.id,
                                    value as OrderStatus
                                )
                            }
                        />
                    ))}
                </div>
            ),
        },
        {
            accessorKey: "total",
            header: "Total",
            cell: ({ row }) => <span>${row.original.total.toFixed(2)}</span>,
        },
        {
            id: "details",
            header: "Details",
            cell: ({ row }) => (
                <Details order={row.original} actions={actions} />
            ),
        },
    ];
}
export default function AdminOrders({
    orders,
    actions,
}: {
    orders: AdminOrderRow[];
    actions: SellerOrderActions;
}) {
    // 列定義を毎 render 作ると router.refresh() のたびに行内の要素が remount され、成功表示や
    // Dialog のフォーカス復帰先が失われる。refresh ごとに別参照になる Server Action は初回の参照を
    // 固定し、列定義を useMemo で固定する（seller-shipping.tsx と同じ）
    const [stableActions] = useState(() => actions);
    const columns = useMemo(
        () => getAdminOrderColumns(stableActions),
        [stableActions]
    );
    return (
        <SellerPage
            workspace="Administration"
            id="admin-orders"
            title="Orders"
            description="Review orders across stores and update fulfillment status."
        >
            <DataTable
                design="seller"
                data={orders}
                columns={columns}
                filterValue="id"
                searchPlaceholder="Search order by id ..."
            />
        </SellerPage>
    );
}
