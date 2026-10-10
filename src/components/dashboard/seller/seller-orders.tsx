"use client";
import { useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { OrderStatus } from "@/lib/types";
import type { SellerOrderRow, SellerOrderActions } from "@/lib/seller-orders";
import { STORE_ORDERS_MAX } from "@/lib/store-constants";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/ui/data-table";
import { ProductImagesCell } from "../shared/order-table-cells";
import CustomModal from "../shared/custom-modal";
import { useModal } from "@/providers/modal-provider";
import styles from "../design/seller.module.css";
import SellerPage from "../design/seller-page";
import StatusEditor from "./status-editor";
import SellerOrderSummary from "./seller-order-summary";
function OrderDetails({
    order,
    actions,
}: {
    order: SellerOrderRow;
    actions: SellerOrderActions;
}) {
    const { setOpen } = useModal(),
        trigger = useRef<HTMLButtonElement>(null);
    return (
        <Button
            ref={trigger}
            className={styles.control}
            type="button"
            variant="outline"
            onClick={() =>
                setOpen(
                    <CustomModal
                        design="seller"
                        heading="Order details"
                        returnFocusTo={trigger}
                    >
                        <SellerOrderSummary order={order} actions={actions} />
                    </CustomModal>
                )
            }
        >
            View order {order.id}
        </Button>
    );
}
export function getSellerOrderColumns(
    actions: SellerOrderActions
): ColumnDef<SellerOrderRow>[] {
    return [
        {
            accessorKey: "id",
            header: "Order",
            cell: ({ row }) => <span>{row.original.id}</span>,
        },
        {
            accessorKey: "products",
            header: "Products",
            cell: ({ row }) => (
                <div>
                    <ProductImagesCell
                        images={row.original.items
                            .map((item) => item.image)
                            .filter(Boolean)}
                    />
                    {row.original.items.map((item) => (
                        <p key={item.id}>{item.name}</p>
                    ))}
                </div>
            ),
        },
        {
            accessorKey: "paymentStatus",
            header: "Payment status",
            cell: ({ row }) => (
                <span
                    className={styles.paymentState}
                    data-payment-state={row.original.paymentStatus}
                >
                    {row.original.paymentStatus}
                </span>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <StatusEditor
                    key={`${row.original.id}:${row.original.status}`}
                    label={`Order status ${row.original.id}`}
                    initialStatus={row.original.status}
                    options={Object.values(OrderStatus)}
                    saveAction={(value) =>
                        actions.updateGroupAction(
                            row.original.storeId,
                            row.original.id,
                            value as OrderStatus
                        )
                    }
                />
            ),
        },
        {
            accessorKey: "total",
            header: "Total",
            cell: ({ row }) => <span>${row.original.total.toFixed(2)}</span>,
        },
        {
            id: "open",
            header: "Details",
            cell: ({ row }) => (
                <OrderDetails order={row.original} actions={actions} />
            ),
        },
    ];
}
export default function SellerOrders({
    orders,
    actions,
}: {
    orders: SellerOrderRow[];
    actions: SellerOrderActions;
}) {
    // 列定義を毎 render 作ると router.refresh() のたびに行内の要素が remount され、成功表示や
    // Dialog のフォーカス復帰先が失われる。refresh ごとに別参照になる Server Action は初回の参照を
    // 固定し、列定義を useMemo で固定する（seller-shipping.tsx と同じ）
    const [stableActions] = useState(() => actions);
    const columns = useMemo(
        () => getSellerOrderColumns(stableActions),
        [stableActions]
    );
    return (
        <SellerPage
            id="store-orders"
            title="Orders"
            description="Review orders and update fulfillment status."
        >
            <p className="text-sm text-muted-foreground">
                Showing up to the latest {STORE_ORDERS_MAX} orders.
            </p>
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
