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

import Image from "next/image";
import PaymentStatusTag from "@/components/shared/payment-status";
import OrderStatusSelect from "@/components/dashboard/forms/order-status-select";
import { Expand } from "lucide-react";
import { useModal } from "@/providers/modal-provider";
import CustomModal from "@/components/dashboard/shared/custom-modal";
import StoreOrderSummary from "@/components/dashboard/shared/store-order-summary";

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
            return (
                <div className="flex flex-wrap gap-1">
                    {images.map((img, i) => (
                        <Image
                            key={`${img}-${i}`}
                            src={img}
                            alt={`product-${i}`}
                            width={100}
                            height={100}
                            className="size-7 rounded-full object-cover"
                            style={{
                                transform: `translateX(-${i * 15}px)`,
                            }}
                        />
                    ))}
                </div>
            );
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
                    <ViewOrderButton order={row.original} />
                </div>
            );
        },
    },
];

/**
 * 注文詳細モーダルを開くボタン。
 * admin 注文は複数 OrderGroup を内包するため、group ごとに `StoreOrderSummary` を表示する。
 */
const ViewOrderButton = ({ order }: { order: AdminOrderType }) => {
    const { setOpen } = useModal();
    return (
        <button
            className="group relative isolation-auto z-10 mx-auto flex items-center justify-center gap-2 overflow-hidden rounded-full border-2 bg-[#0A0D2D] px-4 py-2 font-sans text-lg text-gray-50 backdrop-blur-md before:absolute before:-left-full before:-z-10 before:aspect-square before:w-full before:scale-150 before:rounded-full before:transition-all before:duration-700 hover:text-gray-50 before:hover:left-0 before:hover:bg-blue-primary before:hover:duration-700 lg:font-semibold"
            onClick={() => {
                setOpen(
                    <CustomModal maxWidth="!max-w-3xl">
                        <div className="space-y-6">
                            {order.groups.map((group) => (
                                <StoreOrderSummary
                                    key={group.id}
                                    group={toStoreOrder(order, group)}
                                />
                            ))}
                        </div>
                    </CustomModal>
                );
            }}
        >
            View
            <span className="grid size-7 place-items-center rounded-full bg-white">
                <Expand className="w-5 stroke-black" />
            </span>
        </button>
    );
};
