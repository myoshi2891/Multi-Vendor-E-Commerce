"use client";

// Tanstack React Table
import { ColumnDef } from "@tanstack/react-table";

// Types
import { OrderStatus, PaymentStatus, StoreOrderType } from "@/lib/types";

// Toast
import { getTimeUntil } from "@/lib/utils";
import Image from "next/image";
import PaymentStatusTag from "@/components/shared/payment-status";
import OrderStatusTag from "@/components/shared/order-status";
import OrderStatusSelect from "@/components/dashboard/forms/order-status-select";

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
            return (
                <div className="flex flex-wrap gap-1">
                    {images.map((img, i) => (
                        <Image
                            key={i}
                            src={img}
                            alt={`product-${i}`}
                            width={100}
                            height={100}
                            className="size-7 rounded-full object-cover"
                            style={{
                                transform: `translateX(-${i * 15}px)`,
                            }}
                            priority
                        />
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
            return (
                <span>
                    ${row.original.total.toFixed(2)}
                </span>
            );
        },
    },
];
