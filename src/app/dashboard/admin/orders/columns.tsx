"use client";

// Tanstack React Table
import { ColumnDef } from "@tanstack/react-table";

// Types
import {
    AdminOrderType,
    OrderStatus,
    PaymentStatus,
    StoreOrderType,
} from "@/lib/types";

import PaymentStatusTag from "@/components/shared/payment-status";
import OrderStatusSelect from "@/components/dashboard/forms/order-status-select";
import StoreOrderSummary from "@/components/dashboard/shared/store-order-summary";
import {
    ProductImagesCell,
    ViewOrderButton,
} from "@/components/dashboard/shared/order-table-cells";

type AdminOrderGroup = AdminOrderType["groups"][number];

/**
 * admin 注文（Order 起点・複数 OrderGroup を内包）の各 group を、
 * seller 用 `StoreOrderSummary` が期待する `StoreOrderType` 形状へ整形するアダプタ。
 *
 * `getAllOrders` の include では OrderGroup に `order` 逆参照が含まれないため、
 * 親 Order の `paymentStatus` / `shippingAddress` / `paymentDetails` を group に注入する。
 * admin 側の `shippingAddress.user` は全 User だが、`StoreOrderType` は `{ email }` のみを
 * 要求するため構造的部分型で代入可能（`any` 不使用）。
 */
const toStoreOrder = (
    order: AdminOrderType,
    group: AdminOrderGroup
): StoreOrderType => ({
    ...group,
    order: {
        paymentStatus: order.paymentStatus,
        shippingAddress: order.shippingAddress,
        paymentDetails: order.paymentDetails,
    },
});

export const columns: ColumnDef<AdminOrderType>[] = [
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
            const images = row.original.groups.flatMap((group) =>
                group.items.map((item) => item.image)
            );
            return <ProductImagesCell images={images} />;
        },
    },
    {
        accessorKey: "store",
        header: "Stores",
        cell: ({ row }) => {
            return (
                <div className="flex flex-col gap-1">
                    {row.original.groups.map((group) => (
                        <span key={group.id} className="text-sm">
                            {group.store.name}
                        </span>
                    ))}
                </div>
            );
        },
    },
    {
        accessorKey: "paymentStatus",
        header: "Payment Status",
        cell: ({ row }) => {
            return (
                <div>
                    <PaymentStatusTag
                        status={row.original.paymentStatus as PaymentStatus}
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
                <div className="flex flex-col gap-2">
                    {row.original.groups.map((group) => (
                        <OrderStatusSelect
                            key={group.id}
                            mode="admin"
                            groupId={group.id}
                            status={group.status as OrderStatus}
                        />
                    ))}
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
 * 注文詳細モーダルのトリガー。
 * admin 注文は複数 OrderGroup を内包するため、group ごとに `StoreOrderSummary` を表示する。
 */
const OrderDetailsButton = ({ order }: { order: AdminOrderType }) => {
    return (
        <ViewOrderButton>
            <div className="space-y-6">
                {order.groups.map((group) => (
                    <StoreOrderSummary
                        key={group.id}
                        group={toStoreOrder(order, group)}
                    />
                ))}
            </div>
        </ViewOrderButton>
    );
};
