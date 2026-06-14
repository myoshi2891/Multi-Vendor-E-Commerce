"use client";

// Tanstack React Table
import { ColumnDef } from "@tanstack/react-table";

// Types
import { OrderStatus, PaymentStatus, StoreOrderType } from "@/lib/types";

import PaymentStatusTag from "@/components/shared/payment-status";
import OrderStatusSelect from "@/components/dashboard/forms/order-status-select";
import StoreOrderSummary from "@/components/dashboard/shared/store-order-summary";
import {
    ProductImagesCell,
    ViewOrderButton,
} from "@/components/dashboard/shared/order-table-cells";

export const columns: ColumnDef<StoreOrderType>[] = [
    {
        accessorKey: "id",
        header: "Order",
        cell: ({ row }) => {
            return <span>{row.original.id}</span>;
        },
    },
    {
        accessorKey: "products",
        header: "Products",
        cell: ({ row }) => {
            const images = row.original.items.map((product) => product.image);
            return <ProductImagesCell images={images} />;
        },
    },
    {
        accessorKey: "paymentStatus",
        header: "Payment Status",
        cell: ({ row }) => {
            return (
                <div>
                    <PaymentStatusTag
                        status={
                            row.original.order.paymentStatus as PaymentStatus
                        }
                        isTable
                    />
                </div>
            );
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            return (
                <div>
                    <OrderStatusSelect
                        mode="seller"
                        groupId={row.original.id}
                        status={row.original.status as OrderStatus}
                        storeId={row.original.storeId}
                    />
                </div>
            );
        },
    },
    {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => {
            return <span>${row.original.total.toFixed(2)}</span>;
        },
    },

    {
        accessorKey: "open",
        header: "",
        cell: ({ row }) => {
            return (
                <div>
                    <OrderDetailsButton order={row.original} />
                </div>
            );
        },
    },
];

/**
 * 注文詳細モーダルのトリガー。seller 注文は単一 OrderGroup なので
 * `StoreOrderSummary` をそのまま 1 つ表示する。
 */
const OrderDetailsButton = ({ order }: { order: StoreOrderType }) => {
    return (
        <ViewOrderButton>
            <StoreOrderSummary group={order} />
        </ViewOrderButton>
    );
};
