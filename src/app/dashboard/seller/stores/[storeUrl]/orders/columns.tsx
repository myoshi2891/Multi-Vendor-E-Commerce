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
import { Expand } from "lucide-react";
import { useModal } from "@/providers/modal-provider";
import CustomModal from "@/components/dashboard/shared/custom-modal";
import StoreOrderSummary from "@/components/dashboard/shared/store-order-summary";

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
            return <span>${row.original.total.toFixed(2)}</span>;
        },
    },
    {
        accessorKey: "open",
        header: "",
        cell: ({ row }) => {
            const { setOpen } = useModal();
            return (
                <div>
                    <button
                        className="group relative isolation-auto z-10 mx-auto flex items-center justify-center gap-2 overflow-hidden rounded-full border-2 bg-[#0A0D2D] px-4 py-2 font-sans text-lg text-gray-50 backdrop-blur-md before:absolute before:-left-full before:-z-10 before:aspect-square before:w-full before:scale-150 before:rounded-full before:transition-all before:duration-700 hover:text-gray-50 before:hover:left-0 before:hover:bg-blue-primary before:hover:duration-700 lg:font-semibold"
                        onClick={() => {
                            setOpen(
                                <CustomModal maxWidth="!max-w-3xl">
                                    <StoreOrderSummary group={row.original} />
                                </CustomModal>
                            );
                        }}
                    >
                        View
                        <span className="grid size-7 place-items-center rounded-full bg-white">
                            <Expand className="w-5 stroke-black" />
                        </span>
                    </button>
                </div>
            );
        },
    },
];
