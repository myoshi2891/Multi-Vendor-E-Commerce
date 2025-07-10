"use client";
import OrderStatusTag from "@/components/shared/order-status";
import PaymentStatusTag from "@/components/shared/payment-status";
import { OrderStatus, PaymentStatus, UserOrderType } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Pagination from "../../shared/pagination";
import { getUserOrders } from "@/queries/profile";

export default function OrdersTable({
    orders,
    totalPages,
}: {
    orders: UserOrderType[];
    totalPages: number;
}) {
    const [data, setData] = useState<UserOrderType[]>(orders);
    // Pagination
    const [page, setPage] = useState<number>(1);
    const [totalDataPages, setTotalDataPages] = useState<number>(totalPages);

    useEffect(() => {
        const getData = async () => {
            const res = await getUserOrders("", "", "", page);
            if (res) {
                setData(res.orders);
                setTotalDataPages(res.totalPages);
            }
        };
        getData();
    }, [page]);
    return (
        <div>
            <div className="space-y-4">
                {/* Header */}
                {/* Table */}
                <div className="overflow-hidden">
                    <div className="bg-white p-6">
                        {/* Scrollable Table Container */}
                        <div className="scrollbar max-h-[700px] overflow-auto rounded-md border">
                            <table className="w-full min-w-max table-auto text-left">
                                <thead>
                                    <tr>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Orders
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Products
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Items
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Payment
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Delivery
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm">
                                            Total
                                        </th>
                                        <th className="cursor-pointer border-y p-4 text-sm"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((order) => {
                                        const totalItemsCount =
                                            order.groups.reduce(
                                                (total, group) =>
                                                    total + group._count.items,
                                                0
                                            );
                                        const images = Array.from(
                                            order.groups.flatMap((g) =>
                                                g.items.map((p) => p.image)
                                            )
                                        );
                                        return (
                                            <tr
                                                key={order.id}
                                                className="border-b"
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col">
                                                            <p className="block font-sans text-sm font-normal leading-normal antialiased">
                                                                #{order.id}
                                                            </p>
                                                            <p className="block font-sans text-sm font-normal leading-normal antialiased">
                                                                Placed on:{" "}
                                                                {order.createdAt.toDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex">
                                                        {images
                                                            .slice(0, 5)
                                                            .map((img, i) => (
                                                                <Image
                                                                    src={img}
                                                                    key={i}
                                                                    alt=""
                                                                    width={50}
                                                                    height={50}
                                                                    className="size-7 rounded-full object-cover shadow-sm"
                                                                    style={{
                                                                        transform: `translateX(-${i * 8}px)`,
                                                                    }}
                                                                />
                                                            ))}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {totalItemsCount} items
                                                </td>
                                                <td className="p-4 text-center">
                                                    <PaymentStatusTag
                                                        status={
                                                            order.paymentStatus as PaymentStatus
                                                        }
                                                        isTable
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <OrderStatusTag
                                                        status={
                                                            order.orderStatus as OrderStatus
                                                        }
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    ${order.total.toFixed(2)}
                                                </td>
                                                <td className="p-4">
                                                    <Link
                                                        href={`/order/${order.id}`}
                                                    >
                                                        <span className="cursor-pointer text-xs text-blue-primary hover:underline">
                                                            View
                                                        </span>
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <Pagination page={page} setPage={setPage} totalPages={totalPages} />
        </div>
    );
}
